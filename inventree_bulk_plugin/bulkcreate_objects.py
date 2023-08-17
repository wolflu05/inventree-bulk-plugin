from typing import Generic, Literal, TypeVar, Union
from rest_framework.response import Response
from rest_framework import status
from inventree_bulk_plugin.BulkGenerator.utils import str2bool

from stock.models import StockLocation
from part.models import PartCategory

from .BulkGenerator.BulkGenerator import FieldDefinition, ParseChildReturnType


ModelType = TypeVar("ModelType")


class BulkCreateObject(Generic[ModelType]):
    name: str
    template_type: str
    generate_type: Literal["tree"] = "tree"
    model: ModelType
    fields: dict[str, FieldDefinition]

    def __init__(self, query_params: dict[str, str]) -> None:
        self.query_params = query_params

    def create_objects(self, objects: ParseChildReturnType) -> list[ModelType]:
        if self.generate_type == "tree":
            created_objects = []

            def recursive_bulk_create(parent, childs):
                for c in childs:
                    properties = {}
                    for k, v in c[0].items():
                        if k in self.fields:
                            properties[k] = v

                    obj = self.model.objects.create(
                        **properties,
                        parent=parent
                    )
                    created_objects.append(obj)

                    recursive_bulk_create(obj, c[1])

            try:
                recursive_bulk_create(self.parent, objects)
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
        "default_location_id": FieldDefinition("Default location", field_type="number"),
        "default_keywords": FieldDefinition("Default keywords"),
        "structural": FieldDefinition("Structural", field_type="boolean"),
        "icon": FieldDefinition("Icon"),
    }


bulkcreate_objects: dict[str, type[BulkCreateObject]] = {
    "STOCK_LOCATION": StockLocationBulkCreateObject,
    "PART_CATEGORY": PartCategoryBulkCreateObject,
}
