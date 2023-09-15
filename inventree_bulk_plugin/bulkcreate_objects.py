import io
import re
import requests
import json
from dataclasses import dataclass
from typing import Any, Callable, Generic, Literal, Optional, TypeVar, Union
from pathlib import Path
from django.db import transaction
from django.db.models import Model
from django.apps import apps
from django.urls import reverse
from django.core.files import File
from django.core.files.base import ContentFile
from django.conf import settings
from rest_framework.request import Request
from djmoney.contrib.exchange.models import Rate

from stock.models import StockLocation
from part.models import PartCategory, Part, PartParameter, PartParameterTemplate, PartCategoryParameterTemplate, PartAttachment, PartRelated
from company.models import Company, ManufacturerPart, SupplierPart
from stock.models import StockItem
from common.models import InvenTreeSetting
from InvenTree.status_codes import StockStatus
from InvenTree.helpers_model import download_image_from_url
from plugin import registry

from .BulkGenerator.utils import str2bool, str2int, str2float
from .BulkGenerator.BulkGenerator import BaseFieldDefinition, ParseChildReturnElement, ParseChildReturnType


def get_model(model_name: str):
    try:
        (app, mdl) = model_name.lower().strip().split('.')
    except ValueError:
        return None

    app_models = apps.all_models.get(app, None)

    if app_models is None:
        return None

    model = app_models.get(mdl, None)

    return model


def get_model_instance(model: Model, pk: str, limit_choices={}, error_msg="", allow_multiple=False):
    if isinstance(pk, Model):
        return pk

    try:
        filters = {"pk": int(pk)}
    except ValueError:
        # value is not an pk, try casting it from json to a python dict
        try:
            filters = json.loads(pk)
        except Exception:
            raise ValueError(f"Cannot parse json query string {error_msg}")

    try:
        if allow_multiple:
            return model.objects.filter(**filters, **limit_choices)
        return model.objects.get(**filters, **limit_choices)
    except model.DoesNotExist:
        raise ValueError(f"Model '{model._meta}' where {({**filters, **limit_choices})} not found {error_msg}")
    except model.MultipleObjectsReturned:
        raise ValueError(
            f"Model '{model._meta}' where {({**filters, **limit_choices})} returned multiple models {error_msg}")


def cast_model(value: str, *, field: "FieldDefinition" = None):
    if not field.model or not field.model[2]:
        return value

    _, limit_choices, model = field.model

    # raises value error if object with pk=value doesn't exist
    get_model_instance(model, value, limit_choices, allow_multiple=field.allow_multiple)

    return value


def cast_select(value: str, *, field: "FieldDefinition" = None, create=False):
    options = field.options or field.get_options()
    if value not in options.keys():
        raise ValueError(
            f"'{value}' is not a valid option, choose one of: {', '.join(options.keys())}.")
    return value


@dataclass
class FieldDefinition(BaseFieldDefinition):
    name: str
    field_type: Literal["text", "boolean", "number", "float", "model", "select", "list", "object"] = "text"
    cast_func: Callable[[str], Any] = None
    description: Optional[str] = None
    required: bool = False
    model: Union[str, tuple[str, dict], tuple[str, dict, Model], None] = None
    allow_multiple: Optional[bool] = False
    api_url: Optional[str] = None
    items_type: Optional["FieldDefinition"] = None
    fields: Optional[dict[str, "FieldDefinition"]] = None
    default: Optional[Any] = None
    get_default: Optional[Any] = None
    options: Optional[list[dict[str, str]]] = None
    get_options: Optional[Callable[[], list[dict[str, str]]]] = None

    type_casts = {
        "text": lambda x, **kwargs: str(x),
        "boolean": lambda x, **kwargs: str2bool(x),
        "number": lambda x, **kwargs: str2int(x),
        "float": lambda x, **kwargs: str2float(x),
        "model": cast_model,
        "select": cast_select,
    }

    def __post_init__(self):
        if self.cast_func is None and (cast_func := self.type_casts.get(self.field_type, None)):
            self.cast_func = cast_func

        if isinstance(self.model, str):
            self.model = (self.model, {})

        if self.model and len(self.model) == 2:
            model_class = get_model(self.model[0])
            if not model_class:
                raise ValueError(f"Model '{self.model[0]}' not found.")
            self.model = (self.model[0], self.model[1], model_class)

    def get_api_url(self):
        if not self.model:
            return None

        if self.api_url:
            return self.api_url

        try:
            model_class = self.model[2]
            return model_class.get_api_url()
        except Exception:
            pass

        # Some other model types are hard-coded
        hardcoded_models = {
            'auth.user': 'api-user-list',
            'auth.group': 'api-group-list',
        }

        model_table = f'{model_class._meta.app_label}.{model_class._meta.model_name}'

        if url := hardcoded_models[model_table]:
            return reverse(url)

        return None  # pragma: no cover


ModelType = TypeVar("ModelType")


class BulkCreateObject(Generic[ModelType]):
    name: str
    template_type: str
    generate_type: Literal["tree", "single"] = "tree"
    model: ModelType
    fields: Optional[dict[str, FieldDefinition]]
    get_fields: Optional[Callable[[], dict[str, FieldDefinition]]]

    def __init__(self, request: Request) -> None:
        self.request = request

        if hasattr(self, "get_fields"):
            self.fields = self.get_fields()

    def create_object(self, data: ParseChildReturnElement, **kwargs):
        """Create an objects, the properties from data can override the kwargs."""
        properties = {}
        for k, v in data[0].items():
            if field := self.fields.get(k, None):
                if field.model and field.model[2]:
                    _, limit_choices, model = field.model
                    v = get_model_instance(model, v, limit_choices)
                properties[k] = v

        return self.model.objects.create(**{**kwargs, **properties})

    def create_objects(self, objects: ParseChildReturnType) -> list[ModelType]:
        if self.generate_type == "tree":
            created_objects = []

            def recursive_bulk_create(parent: ModelType, childs: ParseChildReturnType):
                for c in childs:
                    obj = self.create_object(c, parent=parent)
                    created_objects.append(obj)

                    recursive_bulk_create(obj, c[1])

            with transaction.atomic():
                recursive_bulk_create(self.parent, objects)
            return created_objects

        if self.generate_type == "single":
            created_objects = []

            with transaction.atomic():
                for o in objects:
                    created_objects.append(self.create_object(o))
            return created_objects

        return []  # pragma: no cover

    def get_context(self) -> dict:
        if self.generate_type == "tree":
            parent_id = self.request.query_params.get("parent_id", None)
            is_create = str2bool(self.request.query_params.get("create", "false"))
            if not parent_id:
                if is_create:
                    raise ValueError("parent_id query parameter missing")
                else:
                    # add default placeholders if parent_id is not set
                    return {"gen": {k: f"<parent '{f.name}'>" for k, f in self.fields.items()}}

            try:
                parent = self.model.objects.get(pk=parent_id)
                self.parent = parent
                parent_dict = {key: getattr(parent, key) for key in self.fields.keys() if hasattr(parent, key)}
                return {"gen": parent_dict}
            except self.model.DoesNotExist:
                raise ValueError(f"object with id '{parent_id}' cannot be found")

        return {}  # pragma: no cover


class StockLocationBulkCreateObject(BulkCreateObject[StockLocation]):
    name = "Stock Location"
    template_type = "STOCK_LOCATION"
    generate_type = "tree"
    model = StockLocation

    fields = {
        "name": FieldDefinition("Name", required=True),
        "description": FieldDefinition("Description"),
        "structural": FieldDefinition("Structural", field_type="boolean"),
        "external": FieldDefinition("External", field_type="boolean"),
        "icon": FieldDefinition("Icon"),
    }


class PartCategoryBulkCreateObject(BulkCreateObject[PartCategory]):
    name = "Part Category"
    template_type = "PART_CATEGORY"
    generate_type = "tree"
    model = PartCategory

    fields = {
        "name": FieldDefinition("Name", required=True),
        "description": FieldDefinition("Description"),
        "default_location": FieldDefinition("Default location", field_type="model", model=("stock.StockLocation", {"structural": False})),
        "default_keywords": FieldDefinition("Default keywords"),
        "structural": FieldDefinition("Structural", field_type="boolean"),
        "icon": FieldDefinition("Icon"),
    }


class PartBulkCreateObject(BulkCreateObject[Part]):
    name = "Part"
    template_type = "PART"
    generate_type = "tree"
    model = Part

    def get_fields(self):
        return {
            "name": FieldDefinition("Name", required=True),
            "description": FieldDefinition("Description"),
            "category": FieldDefinition("Category", field_type="model", model="part.PartCategory", description="If not set, defaults to current category"),
            "variant_of": FieldDefinition("Variant of", field_type="model", model=("part.Part", {"is_template": True})),
            "keywords": FieldDefinition("Keywords"),
            "IPN": FieldDefinition("IPN"),
            "revision": FieldDefinition("Revision"),
            "is_template": FieldDefinition("Is Template", field_type="boolean"),
            "link": FieldDefinition("Link"),
            "default_location": FieldDefinition("Default Location", field_type="model", model=("stock.StockLocation", {"structural": False})),
            "default_expiry": FieldDefinition("Default Expiry", field_type="number", description="Expiry time (in days) for stock items of this part"),
            "minimum_stock": FieldDefinition("Minimum Stock", field_type="number", description="Minimum allowed stock level"),
            "units": FieldDefinition("Units", description="Units of measure for this part"),
            "salable": FieldDefinition("Salable", field_type="boolean"),
            "assembly": FieldDefinition("Assembly", field_type="boolean"),
            "component": FieldDefinition("Component", field_type="boolean"),
            "purchaseable": FieldDefinition("Purchaseable", field_type="boolean"),
            "trackable": FieldDefinition("Trackable", field_type="boolean"),
            "active": FieldDefinition("Active", field_type="boolean"),
            "virtual": FieldDefinition("Virtual", field_type="boolean"),
            "notes": FieldDefinition("Notes"),
            "responsible": FieldDefinition("Responsible", field_type="model", model="auth.user"),
            # model does not exist, so a custom processor will be used in the frontend
            "image": FieldDefinition("Image", field_type="model", api_url="/api/part/thumbs/", model=("_part.part_image", {}, None), description="You can use any already uploaded part picture here, or reference an external URL."),
            "parameters": FieldDefinition(
                "Parameters",
                field_type="list",
                get_default=self.get_parameters_default,
                items_type=FieldDefinition(
                    "",
                    field_type="object",
                    fields={
                        "template": FieldDefinition("Template", field_type="model", model="part.PartParameterTemplate", required=True),
                        "value": FieldDefinition("Value", required=True)
                    },
                    required=True,
                )),
            "attachments": FieldDefinition(
                "Attachments",
                description="Either provide a link or a url to a file that should be downloaded on create.",
                field_type="list",
                items_type=FieldDefinition(
                    "",
                    field_type="object",
                    fields={
                        "comment": FieldDefinition("Comment", required=True),
                        "link": FieldDefinition("Link"),
                        "file_url": FieldDefinition("File Url"),
                        "file_name": FieldDefinition("File name"),
                        "file_headers": FieldDefinition("File headers", description="Provide headers that should be used to download the file in json format."),
                    },
                    required=True,
                )),
            "supplier": FieldDefinition(
                "Supplier",
                field_type="object",
                fields={
                    "supplier": FieldDefinition("Supplier", field_type="model", model=("company.Company", {'is_supplier': True}), required=True),
                    "SKU": FieldDefinition("SKU", required=True),
                    "description": FieldDefinition("Description"),
                    "link": FieldDefinition("Link"),
                    "note": FieldDefinition("Note"),
                    "packaging": FieldDefinition("Packaging"),
                    "pack_quantity": FieldDefinition("Pack Quantity", description="Total quantity supplied in a single pack. Leave empty for single items."),
                    "multiple": FieldDefinition("Multiple", field_type="number"),
                    "_make_default": FieldDefinition("Make default", field_type="boolean", description="Make this supplier part the default for this part."),
                }),
            "manufacturer": FieldDefinition(
                "Manufacturer",
                field_type="object",
                fields={
                    "manufacturer": FieldDefinition("Manufacturer", field_type="model", model=("company.Company", {'is_manufacturer': True}), required=True),
                    "MPN": FieldDefinition("MPN", required=True),
                    "description": FieldDefinition("Description"),
                    "link": FieldDefinition("Link"),
                }),
            "stock": FieldDefinition(
                "Stock",
                field_type="object",
                fields={
                    "quantity": FieldDefinition("Quantity", field_type="float", required=True),
                    "location": FieldDefinition("Location", field_type="model", model=("stock.StockLocation", {"structural": False}), required=True),
                    "batch": FieldDefinition("Batch"),
                    "link": FieldDefinition("Link"),
                    "review_needed": FieldDefinition("Review needed", field_type="boolean"),
                    "delete_on_deplete": FieldDefinition("Delete on deplete", field_type="boolean"),
                    "status": FieldDefinition("Status", field_type="select", get_options=self.get_stock_status_options, default="10"),
                    "notes": FieldDefinition("Note"),
                    "packaging": FieldDefinition("Packaging"),
                    "purchase_price": FieldDefinition("Purchase price", field_type="float"),
                    "purchase_price_currency": FieldDefinition("Currency", field_type="select", get_options=self.get_currencies_options, get_default=self.get_currency_default),
                }
            ),
            "related_parts": FieldDefinition(
                "Related parts",
                field_type="list",
                items_type=FieldDefinition(
                    "",
                    field_type="model",
                    required=True,
                    model="part.part",
                    allow_multiple=True,
                )
            )
        }

    def create_objects(self, objects: ParseChildReturnType) -> list[Part]:
        # download images outside of db transaction
        self.part_images = {}
        for part_data in objects:
            if url := part_data[0].get("image", None):
                # check if image is relative
                if not re.match(r"^(?:[a-z+]+:)?//", url):
                    continue

                # check if image has already been downloaded
                if url in self.part_images:
                    continue

                self.part_images[url] = None

                # check if image download is enabled
                if not InvenTreeSetting.get_setting('INVENTREE_DOWNLOAD_FROM_URL'):
                    raise ValueError("Downloading images from remote URL is not enabled")

                try:
                    self.part_images[url] = download_image_from_url(part_data[0]["image"])
                except Exception as exc:
                    raise ValueError(str(exc))

        # download attachments outside of db transaction
        self.attachments = {}
        for attachment_data in [a for p in objects for a in p[0].get("attachments", [])]:
            if attachment_data.get("link", None) and attachment_data.get("file_url", None):
                raise ValueError("Either provide a link or an attachment.")

            file_url = attachment_data.get("file_url", None)
            if file_url and file_url not in self.attachments:
                try:
                    default_headers = json.loads(registry.get_plugin(
                        "inventree-bulk-plugin").get_setting("DEFAULT_DOWNLOAD_HEADERS"))
                    headers = json.loads(attachment_data.get("file_headers", "{}"))
                    r = requests.get(file_url, allow_redirects=True, headers={**default_headers, **headers})
                    r.raise_for_status()
                    filename = attachment_data.get("file_name", None) or file_url.split("/")[-1]
                    self.attachments[file_url] = File(ContentFile(r.content), filename)
                except Exception as e:
                    raise ValueError(f"{e}")

        return super().create_objects(objects)

    def create_object(self, data: ParseChildReturnElement, *, parent: Optional[Part] = None):
        # remove relations from data to create them separately
        parameters = data[0].pop("parameters", [])
        attachments = data[0].pop("attachments", [])
        supplier_data = data[0].pop("supplier", None)
        manufacturer_data = data[0].pop("manufacturer", None)
        stock_data = data[0].pop("stock", None)
        related_parts = data[0].pop("related_parts", None)

        # define fields that should be skipped for duplicating
        skip_duplicate_fields = ["parameters", "attachments", "supplier",
                                 "manufacturer", "stock", "related_parts", "default_supplier", "category", "variant_of", "is_template"]
        if not InvenTreeSetting.get_setting("PART_ALLOW_DUPLICATE_IPN"):
            skip_duplicate_fields.append("IPN")

        # check variant_of
        if parent:
            if not parent.is_template:
                raise ValueError(
                    f"Part '{data[0]['name']}' cannot be a variant of '{parent.name}' because the parent is not a template part.")
            data[0]["variant_of"] = parent

            # copy everything from parent if not set
            for k in self.fields:
                if k not in data[0] and (value := getattr(parent, k, None)):
                    # skip copying specific fields
                    if k in skip_duplicate_fields:
                        continue

                    if k == "image":
                        data[0][k] = value.name
                    else:
                        data[0][k] = value

        # use local image if available
        image = data[0].pop("image", None)
        if image:
            # maybe use already saved image with same url
            if image in self.part_images and isinstance(self.part_images[image], str):
                image = self.part_images[image]
            elif not re.match(r"^(?:[a-z+]+:)?//", image):
                # try use local image
                if not (Path(settings.MEDIA_ROOT.joinpath(image))).is_file():
                    raise ValueError(f"Image '{image}' for part '{data[0]['name']}' does not exist")
            data[0]["image"] = image

        # create part
        part: Part = super().create_object(
            data,
            category=self.category,
            creation_user=self.request.user,
        )

        # use remote image if available
        if image and image in self.part_images:
            remote_img = self.part_images[image]

            fmt = remote_img.format or 'PNG'
            buffer = io.BytesIO()
            remote_img.save(buffer, format=fmt)

            # Construct a simplified name for the image
            filename = f"part_{part.pk}_image.{fmt.lower()}"

            part.image.save(
                filename,
                ContentFile(buffer.getvalue()),
            )

            # image has now been saved, update it to not save it again for the next part using the same url
            self.part_images[image] = part.image.name

        # create parameters
        if parent:
            part.copy_parameters_from(parent)

        for parameter in parameters:
            template = get_model_instance(PartParameterTemplate, parameter["template"], {}, f"for {part.name}")
            PartParameter.objects.create(part=part, template=template, data=parameter['value'])

        # create attachments
        for attachment in attachments:
            PartAttachment.objects.create(
                part=part,
                link=attachment.get("link", None),
                comment=attachment["comment"],
                attachment=self.attachments.get(attachment.get("file_url", None), None),
                user=self.request.user,
            )

        # create manufacturer part
        manufacturer_part = None
        if manufacturer_data:
            manufacturer_pk = manufacturer_data.pop("manufacturer", None)
            manufacturer = get_model_instance(Company, manufacturer_pk, {"is_manufacturer": True}, f"for {part.name}")

            manufacturer_part = ManufacturerPart.objects.create(
                part=part,
                manufacturer=manufacturer,
                **manufacturer_data,
            )

        # create supplier part
        supplier_part = None
        if supplier_data:
            supplier_pk = supplier_data.pop("supplier", None)
            _make_default = supplier_data.pop("_make_default", False)
            supplier = get_model_instance(Company, supplier_pk, {"is_supplier": True}, f"for {part.name}")

            supplier_part = SupplierPart.objects.create(
                part=part,
                supplier=supplier,
                manufacturer_part=manufacturer_part,
                **supplier_data,
            )

            # if wanted, make this supplier part the default for this part
            if _make_default:
                part.default_supplier = supplier_part
                part.save()

        # create initial stock
        if stock_data:
            location_pk = stock_data.pop("location", None)
            location = get_model_instance(StockLocation, location_pk, {}, f"for {part.name}")

            stock_item = StockItem(
                part=part,
                location=location,
                supplier_part=supplier_part,
                **stock_data,
            )
            stock_item.save(user=self.request.user)

        # create related parts
        if related_parts:
            # use set to filter out parts that are selected by multiple filters
            related_parts_set = set()
            for related_part in related_parts:
                related_parts_query = get_model_instance(
                    Part, related_part, {}, f"for {part.name}", allow_multiple=True).exclude(pk=part.pk)
                related_parts_set.update(related_parts_query)

            for related_part in related_parts_set:
                PartRelated.objects.create(part_1=part, part_2=related_part)

        return part

    def get_context(self) -> dict:
        parent_id = self.request.query_params.get("parent_id", None)
        self.category = None

        # no super call is invoked here, because we handle the parent fetching a bit different in this function
        ctx = {}
        self.parent = None

        # try to add template part (of which this part is a variant of) as 'par.gen.<...>' context
        schema = self.request.data.get("template", {})
        if not isinstance(schema, dict):
            schema = json.loads(schema)
        if variant_of := schema.get("output", {}).get("generate", {}).get("variant_of", None):
            template_part = get_model_instance(Part, variant_of, {"is_template": True}, "for variant_of field")
            self.parent = template_part  # set parent, used in self.create_objects(...) later
            ctx["gen"] = {key: getattr(template_part, key) for key in self.fields.keys() if hasattr(template_part, key)}

        if not parent_id:
            return ctx

        try:
            part_category_fields = PartCategoryBulkCreateObject(self.request).fields
            self.category = PartCategory.objects.get(pk=parent_id)
            category_dict = {key: getattr(self.category, key)
                             for key in part_category_fields.keys() if hasattr(self.category, key)}
            return {**ctx, "category": category_dict}
        except PartCategory.DoesNotExist:
            raise ValueError(f"category with id '{parent_id}' cannot be found")

    def get_parameters_default(self):
        parent_id = self.request.query_params.get("parent_id", None)

        # if parent_id (category_id) is set, try to get the category default parameters
        if parent_id:
            try:
                categories = PartCategory.objects.get(pk=parent_id).get_ancestors(include_self=True)
                parameters = PartCategoryParameterTemplate.objects.filter(category__in=categories)

                # if no parameter is found for this category, add one default empty parameter
                if len(parameters) == 0:
                    return [{"template": "", "value": ""}]

                return [{"template": str(c.parameter_template.id), "value": c.default_value} for c in parameters]
            except Exception:  # pragma: no cover
                pass

        return None

    def get_currencies_options(self):
        return {r.currency: r.currency for r in Rate.objects.all()}

    def get_stock_status_options(self):
        return {f"{x.value}": f"{x.name} ({x.value})" for x in StockStatus.values()}

    def get_currency_default(self):
        return InvenTreeSetting.get_setting('INVENTREE_DEFAULT_CURRENCY', 'USD')


bulkcreate_objects: dict[str, type[BulkCreateObject]] = {
    "STOCK_LOCATION": StockLocationBulkCreateObject,
    "PART_CATEGORY": PartCategoryBulkCreateObject,
    "PART": PartBulkCreateObject,
}
