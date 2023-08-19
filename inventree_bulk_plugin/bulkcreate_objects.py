from dataclasses import dataclass
from typing import Any, Callable, Generic, Literal, Optional, TypeVar, Union
from django.db import transaction
from django.db.models import Model
from django.apps import apps
from rest_framework.request import Request

from stock.models import StockLocation
from part.models import PartCategory, Part, PartParameter, PartParameterTemplate, PartCategoryParameterTemplate, PartAttachment
from company.models import Company, ManufacturerPart, SupplierPart
from stock.models import StockItem
from InvenTree.status_codes import StockStatus

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


@dataclass
class FieldDefinition(BaseFieldDefinition):
    name: str
    field_type: Literal["text", "boolean", "number", "float", "model", "list", "object"] = "text"
    cast_func: Callable[[str], Any] = None
    description: Optional[str] = None
    required: bool = False
    model: Union[str, tuple[str, dict], tuple[str, dict, Model], None] = None
    items_type: Optional["FieldDefinition"] = None
    fields: Optional[dict[str, "FieldDefinition"]] = None
    default: Optional[Any] = None
    get_default: Optional[Any] = None

    type_casts = {
        "text": str,
        "boolean": str2bool,
        "number": str2int,
        "float": str2float,
        "model": str2int,
    }

    default_descriptions = {
        "boolean": "This must evaluate to something that can be casted to a boolean (e.g. 'true' or 'false').",
        "number": "This must evaluate to something that can be casted as number.",
        "float": "This must evaluate to something that can be casted as float (e.g. '3.1415').",
    }

    def __post_init__(self):
        if self.cast_func is None and (cast_func := self.type_casts.get(self.field_type, None)):
            self.cast_func = cast_func

        if not self.description and self.field_type in self.default_descriptions:
            self.description = self.default_descriptions.get(self.field_type, None)

        if isinstance(self.model, str):
            self.model = (self.model, {})

        if self.model and len(self.model) == 2:
            model_class = get_model(self.model[0])
            if not model_class:
                raise ValueError(f"Model '{self.model[0]}' not found.")
            self.model = (self.model[0], self.model[1], model_class)


def get_model_instance(model: Model, pk, limit_choices={}, error_msg=""):
    try:
        return model.objects.get(pk=pk, **limit_choices)
    except model.DoesNotExist:
        raise ValueError(f"Model '{model._meta}' where {({'pk': pk,**limit_choices})} not found {error_msg}")


ModelType = TypeVar("ModelType")


class BulkCreateObject(Generic[ModelType]):
    name: str
    template_type: str
    generate_type: Literal["tree", "single"] = "tree"
    model: ModelType
    fields: dict[str, FieldDefinition]

    def __init__(self, request: Request) -> None:
        self.request = request

    def create_object(self, data: ParseChildReturnElement, **kwargs):
        properties = {}
        for k, v in data[0].items():
            if field := self.fields.get(k, None):
                if field.model:
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
        "default_location": FieldDefinition("Default location", field_type="model", model="stock.StockLocation"),
        "default_keywords": FieldDefinition("Default keywords"),
        "structural": FieldDefinition("Structural", field_type="boolean"),
        "icon": FieldDefinition("Icon"),
    }


class PartBulkCreateObject(BulkCreateObject[Part]):
    name = "Part"
    template_type = "PART"
    generate_type = "single"
    model = Part

    fields = {
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
        "image": FieldDefinition("Image"),
        "parameters": FieldDefinition(
            "Parameters",
            field_type="list",
            get_default="get_parameters_default",
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
                "status": FieldDefinition("Status", description="Either define the numeric status code or the name in all uppercase, like OK, DAMAGED, ..."),
                "notes": FieldDefinition("Note"),
                "packaging": FieldDefinition("Packaging"),
                "purchase_price": FieldDefinition("Purchase price"),
                "purchase_price_currency": FieldDefinition("Currency"),
            }
        ),
    }

    def create_object(self, data: ParseChildReturnElement):
        # remove relations from data to create them separately
        parameters = data[0].pop("parameters", [])
        attachments = data[0].pop("attachments", [])
        supplier_data = data[0].pop("supplier", None)
        manufacturer_data = data[0].pop("manufacturer", None)
        stock_data = data[0].pop("stock", None)

        # create part
        part = super().create_object(
            data,
            category=self.category,
            creation_user=self.request.user,
        )

        # create parameters
        for parameter in parameters:
            template = get_model_instance(PartParameterTemplate, parameter["template"], f"for {part.name}")
            PartParameter.objects.create(part=part, template=template, data=parameter['value'])

        # create attachments
        for attachment in attachments:
            # TODO: download attachment if link available
            PartAttachment.objects.create(
                part=part,
                link=attachment.get("link", None),
                comment=attachment["comment"],
                user=self.request.user
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
            status = stock_data.pop("status", None)
            location = get_model_instance(StockLocation, location_pk, {}, f"for {part.name}")

            # convert status to numeric StatusCode value
            if status:
                if (status_int := str2int(status)) is not None:
                    status_code = getattr(StockStatus.values(status_int), "value", None)
                else:
                    status_code = StockStatus.names().get(status, None)

                if status_code is None:
                    raise ValueError(
                        f"Stock status '{status}' for part '{part.name}' not found, use one of {', '.join(StockStatus.names().keys())}")

                stock_data["status"] = status_code

            stock_item = StockItem(
                part=part,
                location=location,
                supplier_part=supplier_part,
                **stock_data,
            )
            stock_item.save(user=self.request.user)

        return part

    def get_context(self) -> dict:
        parent_id = self.request.query_params.get("parent_id", None)
        self.category = None

        ctx = super().get_context()

        if not parent_id:
            return ctx

        try:
            category = PartCategory.objects.get(pk=parent_id)
            self.category = category
            category_dict = {key: getattr(category, key)
                             for key in PartCategoryBulkCreateObject.fields.keys() if hasattr(category, key)}
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
            except Exception:
                pass

        return None


bulkcreate_objects: dict[str, type[BulkCreateObject]] = {
    "STOCK_LOCATION": StockLocationBulkCreateObject,
    "PART_CATEGORY": PartCategoryBulkCreateObject,
    "PART": PartBulkCreateObject,
}
