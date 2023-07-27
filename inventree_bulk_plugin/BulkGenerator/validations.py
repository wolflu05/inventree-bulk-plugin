from typing import List, Optional, Dict, Union, Tuple
from pydantic import BaseModel, PrivateAttr


BulkDefinitionChildDimensions = Optional[List[str]]
BulkDefinitionChildCount = Optional[List[Union[int, None]]]


class BulkDefinitionChild(BaseModel):
    parent_name_match: Optional[str] = ".*"
    extends: Optional[str] = None
    dimensions: BulkDefinitionChildDimensions = []
    generate: Optional[Dict[str, str]] = {}
    count: BulkDefinitionChildCount = []
    child: Optional["BulkDefinitionChild"] = None
    childs: Optional[List["BulkDefinitionChild"]] = []

    _generated: List[Tuple[Dict[str, str], "_generated"]] = PrivateAttr([])
    _parent: Optional["BulkDefinitionChild"] = PrivateAttr(None)


class BulkDefinitionChildTemplate(BulkDefinitionChild):
    name: str


class BulkDefinitionSettings(BaseModel):
    count_from: Optional[int] = 1
    leading_zeros: Optional[bool] = True


class BulkDefinitionSchema(BaseModel):
    version: str
    input: Dict[str, str]
    settings: Optional[BulkDefinitionSettings] = BulkDefinitionSettings()
    templates: List["BulkDefinitionChildTemplate"]
    output: "BulkDefinitionChild"
