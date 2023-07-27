from abc import ABC, abstractmethod
from typing import Iterable
from typing import Dict, Optional, Tuple, Union
from pydantic import BaseModel
from enum import IntEnum


class GeneratorTypes(IntEnum):
    INFINITY = 0
    RANGE = 1
    WORD = 2


class BaseSettingsSchema(BaseModel):
    start: Optional[str] = None
    end: Optional[str] = None
    count: Optional[int] = None
    step: Optional[int] = 1


class Generator(ABC):
    def __init__(self, gen_type: GeneratorTypes, gen: Union[str, Tuple[str, str]], settings: Dict[str, str], gen_name: str) -> None:
        self.gen_type = gen_type
        self.gen = gen
        self.settings = self.SettingsSchema(**settings)
        self.gen_name = gen_name
        super().__init__()

    class SettingsSchema(BaseSettingsSchema):
        pass

    @property
    @abstractmethod
    def NAME():
        pass  # pragma: no cover

    @staticmethod
    @abstractmethod
    def is_generator(start_value: str, end_value: str) -> bool:
        pass  # pragma: no cover

    @abstractmethod
    def get_index(self, value: str) -> int:
        """Return the zero-based index of a value in the generator."""
        pass  # pragma: no cover

    @abstractmethod
    def generator() -> Iterable[str]:
        pass  # pragma: no cover
