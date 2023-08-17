from dataclasses import dataclass
from typing import Any, Callable, Generic, Literal, Optional, TypeVar, Union
from django.db import transaction
from django.db.models import Model
from django.apps import apps

from stock.models import StockLocation
from part.models import PartCategory, Part

from .BulkGenerator.utils import str2bool, str2int
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
    field_type: Literal["text", "boolean", "number", "model"] = "text"
    cast_func: Callable[[str], Any] = None
    description: Optional[str] = None
    required: bool = False
    model: Union[str, tuple[str, dict], tuple[str, dict, Model], None] = None

    type_casts = {
        "text": str,
        "boolean": str2bool,
        "number": str2int,
        "model": str2int,
    }

    default_descriptions = {
        "boolean": "This must evaluate to something that can be casted to a boolean (e.g. 'true' or 'false').",
        "number": "This must evaluate to something that can be casted as number.",
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


ModelType = TypeVar("ModelType")


class BulkCreateObject(Generic[ModelType]):
    name: str
    template_type: str
    generate_type: Literal["tree", "single"] = "tree"
    model: ModelType
    fields: dict[str, FieldDefinition]

    def __init__(self, query_params: dict[str, str]) -> None:
        self.query_params = query_params

    def create_object(self, data: ParseChildReturnElement, **kwargs):
        properties = {}
        for k, v in data[0].items():
            if field := self.fields.get(k, None):
                if field.model:
                    _, limit_choices, model = field.model
                    v = model.objects.get(pk=v, **limit_choices)
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
            parent_id = self.query_params.get("parent_id", None)
            is_create = str2bool(self.query_params.get("create", "false"))
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

    def get_context(self) -> dict:
        parent_id = self.query_params.get("parent_id", None)
        ctx = super().get_context()

        if parent_id:
            try:
                category = PartCategory.objects.get(pk=parent_id)
                self.category = category
                category_dict = {key: getattr(category, key) for key in self.fields.keys() if hasattr(category, key)}
                return {**ctx, "category": category_dict}
            except self.model.DoesNotExist:
                raise ValueError(f"category with id '{parent_id}' cannot be found")


bulkcreate_objects: dict[str, type[BulkCreateObject]] = {
    "STOCK_LOCATION": StockLocationBulkCreateObject,
    "PART_CATEGORY": PartCategoryBulkCreateObject,
    "PART": PartBulkCreateObject,
}
