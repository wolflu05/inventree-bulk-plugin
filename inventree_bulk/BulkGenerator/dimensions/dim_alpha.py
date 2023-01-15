import itertools
from enum import Enum
from typing import Dict, Tuple, Union
import string

from .dimension import Dimension, BaseSettingsSchema, DimensionTypes


class CasingTypes(Enum):
    upper = "upper"
    lower = "lower"


class Alpha(Dimension):
    NAME = "ALPHA"

    def __init__(self, dim_type: DimensionTypes, dim: Union[str, Tuple[str, str]], settings: Dict[str, str], dim_name: str) -> None:
        super().__init__(dim_type, dim, settings, dim_name)

        if dim_type == DimensionTypes.RANGE:
            self.settings.casing = (CasingTypes.lower if dim[0].islower() else CasingTypes.upper)

        self.letters = ""
        if self.settings.casing == CasingTypes.lower:
            self.letters = string.ascii_lowercase
        elif self.settings.casing == CasingTypes.upper:
            self.letters = string.ascii_uppercase

    class SettingsSchema(BaseSettingsSchema):
        casing: CasingTypes = CasingTypes.lower

    @staticmethod
    def is_dimension(start_value, end_value):
        return start_value.islower() == end_value.islower()

    def get_index(self, value):
        return self._get_alpha_index(value) - 1

    def generator(self):
        for i in itertools.count(1):
            for p in itertools.product(self.letters, repeat=i):
                yield ''.join(p)

    @classmethod
    def _get_alpha_index(cls, x) -> int:
        """Return the zero-based index of alphanumeric values."""
        if x == "":
            return 0
        res = 1 + ord(x[-1].upper()) - ord('A') + 26 * cls._get_alpha_index(x[:-1])
        return res
