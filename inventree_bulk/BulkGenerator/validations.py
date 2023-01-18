from typing import List, Optional, Dict, Union, Tuple
from pydantic import BaseModel, PrivateAttr


class BulkDefinitionChild(BaseModel):
    parent_name_match: Optional[str] = ".*"
    extends: Optional[str]
    dimensions: Optional[List[str]] = []
    generate: Optional[Dict[str, str]] = {}
    count: Optional[List[Union[int, None]]] = []
    child: Optional["BulkDefinitionChild"]
    childs: Optional[List["BulkDefinitionChild"]] = []

    _generated: List[Tuple[Dict[str, str],
                           "BulkDefinitionChild._generated"]] = PrivateAttr([])
    _parent: Optional["BulkDefinitionChild"] = PrivateAttr(None)


class BulkDefinitionChildTemplate(BulkDefinitionChild):
    name: str


class BulkDefinitionSettings(BaseModel):
    count_from: Optional[int] = 1
    leading_zeros: Optional[bool] = True


BulkDefinitionChildTemplate


class BulkDefinitionSchema(BaseModel):
    version: str
    input: Dict[str, Union[int, str]]
    settings: Optional[BulkDefinitionSettings] = BulkDefinitionSettings()
    templates: List["BulkDefinitionChildTemplate"]
    output: "BulkDefinitionChild"