from abc import ABC, abstractmethod
from typing import Iterable
from typing import Dict, Optional, Tuple, Union
from pydantic import BaseModel
from enum import IntEnum


class DimensionTypes(IntEnum):
    INFINITY = 0
    RANGE = 1
    WORD = 2


class BaseSettingsSchema(BaseModel):
    start: Optional[str]
    end: Optional[str]
    count: Optional[int]
    step: Optional[int] = 1


class Dimension(ABC):
    def __init__(self, dim_type: DimensionTypes, dim: Union[str, Tuple[str, str]], settings: Dict[str, str], dim_name: str) -> None:
        self.dim_type = dim_type
        self.dim = dim
        self.settings = self.SettingsSchema(**settings)
        self.dim_name = dim_name
        super().__init__()

    class SettingsSchema(BaseSettingsSchema):
        pass

    @property
    @abstractmethod
    def NAME():
        pass

    @staticmethod
    @abstractmethod
    def is_dimension(self, start_value: str, end_value: str) -> bool:
        pass

    @abstractmethod
    def get_index(self, value: str) -> int:
        """Return the zero-based index of a value in the dimension."""
        pass

    @abstractmethod
    def generator() -> Iterable[str]:
        pass
