import re
from typing import List, Optional, Dict, Union, Tuple
from pydantic import BaseModel, FieldValidationInfo, PrivateAttr, field_validator
from pydantic_core import PydanticCustomError
from jinja2.exceptions import TemplateError

from .template import Template


BulkDefinitionChildDimensions = Optional[List[str]]
BulkDefinitionChildCount = Optional[List[Union[int, None]]]


class BulkDefinitionChild(BaseModel):
    parent_name_match: Optional[str] = "true"
    extends: Optional[str] = None
    global_context: Optional[str] = ""
    dimensions: BulkDefinitionChildDimensions = []
    generate: Optional[dict] = {}
    count: BulkDefinitionChildCount = []
    child: Optional["BulkDefinitionChild"] = None
    childs: Optional[List["BulkDefinitionChild"]] = []

    _generated: List[Tuple[Dict[str, str], "_generated"]] = PrivateAttr([])
    _parent: Optional["BulkDefinitionChild"] = PrivateAttr(None)


class BulkDefinitionChildTemplate(BulkDefinitionChild):
    name: str


class BulkDefinitionSchema(BaseModel):
    apply_input: bool = False  # is not part of the definition schema, but used to determine if the input should be applied

    version: str
    input: Dict[str, str]
    templates: List["BulkDefinitionChildTemplate"]
    output: "BulkDefinitionChild"

    @field_validator("templates", "output", mode="before", check_fields=True)
    @classmethod
    def apply_input_hook(cls, value, field_info: FieldValidationInfo):
        errors = list[str]()

        def _apply_input(value, path: str):
            if isinstance(value, dict):
                for k, v in value.items():
                    value[k] = _apply_input(v, f"{path}.{k}")
            elif isinstance(value, list):
                for i, v in enumerate(value):
                    value[i] = _apply_input(v, f"{path}.{i}")
            elif isinstance(value, str):
                use_extra_contexts = [r".*\.generate\..*$", r".*\.parent_name_match", r".*\.global_context"]

                try:
                    # if path ends with one in use_extra_contexts, only validate the template,
                    # because the full variable context is not available to this time
                    if any(re.match(pattern, path) for pattern in use_extra_contexts):
                        Template(value).validate()
                    else:
                        template = Template(value).compile()
                        rendered_value = template.render(inp=field_info.data["input"])
                        if field_info.data["apply_input"]:
                            value = rendered_value
                except TemplateError as e:
                    errors.append(f'{path}: {e} (template="{value}")')

            return value

        # recursively walk through the provided data structure and validate/apply template
        _apply_input(value, field_info.field_name)

        if len(errors) > 0:
            raise PydanticCustomError("template_error", "\n".join(errors))

        return value
