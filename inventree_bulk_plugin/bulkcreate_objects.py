from typing import Generic, Literal, TypeVar, Union
from django.db import transaction
from django.apps import apps
from rest_framework.response import Response
from rest_framework import status

from stock.models import StockLocation
from part.models import PartCategory, Part

from .BulkGenerator.utils import str2bool
from .BulkGenerator.BulkGenerator import FieldDefinition, ParseChildReturnElement, ParseChildReturnType


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


ModelType = TypeVar("ModelType")


class BulkCreateObject(Generic[ModelType]):
    name: str
    template_type: str
    generate_type: Literal["tree", "single"] = "tree"
    model: ModelType
    fields: dict[str, FieldDefinition]

    def __init__(self, query_params: dict[str, str]) -> None:
        self.query_params = query_params

        for field in self.fields.values():
            if field.model and not hasattr(field, "model_class"):
                model = get_model(field.model[0])
                if not model:
                    raise ValueError(f"Model '{field.model[0]}' not found.")

                setattr(field, "model_class", model)

    def create_object(self, data: ParseChildReturnElement, **kwargs):
        properties = {}
        for k, v in data[0].items():
            if field := self.fields.get(k, None):
                if field.model:
                    model = getattr(field, "model_class")
                    obj = model.objects.get(pk=v)
                    v = obj
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

            try:
                with transaction.atomic():
                    recursive_bulk_create(self.parent, objects)
                return created_objects
            except Exception as e:  # pragma: no cover
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if self.generate_type == "single":
            created_objects = []

            try:
                with transaction.atomic():
                    for o in objects:
                        created_objects.append(self.create_object(o))
                return created_objects
            except Exception as e:  # pragma: no cover
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return []  # pragma: no cover

    def get_context(self) -> Union[dict, Response]:
        if self.generate_type == "tree":
            parent_id = self.query_params.get("parent_id", None)
            is_create = str2bool(self.query_params.get("create", "false"))
            if not parent_id:
                if is_create:
                    return Response({"error": "parent_id query parameter missing"}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    # add default placeholders if parent_id is not set
                    return {"gen": {k: f"<parent '{f.name}'>" for k, f in self.fields.items()}}

            try:
                parent = self.model.objects.get(pk=parent_id)
                self.parent = parent
                parent_dict = {key: getattr(parent, key) for key in self.fields.keys() if hasattr(parent, key)}
                return {"gen": parent_dict}
            except self.model.DoesNotExist:
                return Response({"error": f"object with id '{parent_id}' cannot be found"}, status=status.HTTP_404_NOT_FOUND)

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
        "default_location_id": FieldDefinition("Default location", field_type="number", description="This must evaluate to a valid stock location id."),
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
        "default_location": FieldDefinition("Default Location", field_type="model", model="stock.StockLocation"),
        "default_supplier": FieldDefinition("Default Supplier part", field_type="model", model="company.SupplierPart"),
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

        # TODO
        # "creation_user"
        # "parameters"
        # "initial_stock"
        # "initial_supplier"
        # "attachments"
    }

    def create_object(self, data: ParseChildReturnElement):
        return super().create_object(data, category=self.category)

    def get_context(self) -> dict | Response:
        parent_id = self.query_params.get("parent_id", None)
        ctx = super().get_context()

        if parent_id:
            try:
                category = PartCategory.objects.get(pk=parent_id)
                self.category = category
                category_dict = {key: getattr(category, key) for key in self.fields.keys() if hasattr(category, key)}
                return {**ctx, "category": category_dict}
            except self.model.DoesNotExist:
                return Response({"error": f"category with id '{parent_id}' cannot be found"}, status=status.HTTP_404_NOT_FOUND)


bulkcreate_objects: dict[str, type[BulkCreateObject]] = {
    "STOCK_LOCATION": StockLocationBulkCreateObject,
    "PART_CATEGORY": PartCategoryBulkCreateObject,
    "PART": PartBulkCreateObject,
}
