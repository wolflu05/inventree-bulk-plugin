import itertools
from enum import Enum
from typing import Dict, Tuple, Union
import string

from .generator import Generator, BaseSettingsSchema, GeneratorTypes


class CasingTypes(Enum):
    upper = "upper"
    lower = "lower"


class AlphaGenerator(Generator):
    NAME = "ALPHA"

    def __init__(self, gen_type: GeneratorTypes, gen: Union[str, Tuple[str, str]], settings: Dict[str, str], gen_name: str) -> None:
        super().__init__(gen_type, gen, settings, gen_name)

        if gen_type == GeneratorTypes.RANGE:
            self.settings.casing = (CasingTypes.lower if gen[0].islower() else CasingTypes.upper)

        self.letters = ""
        if self.settings.casing == CasingTypes.lower:
            self.letters = string.ascii_lowercase
        elif self.settings.casing == CasingTypes.upper:
            self.letters = string.ascii_uppercase

    class SettingsSchema(BaseSettingsSchema):
        casing: CasingTypes = CasingTypes.lower

    @staticmethod
    def is_generator(start_value, end_value):
        return start_value.isalpha() and end_value.isalpha() and (start_value.islower() == end_value.islower())

    def get_index(self, value):
        return self._get_alpha_index(value) - 1

    def generator(self):
        for i in itertools.count(1):
            for p in itertools.product(self.letters, repeat=i):
                yield ''.join(p)

    @classmethod
    def _get_alpha_index(cls, x: str) -> int:
        """Return the zero-based index of alphanumeric values."""
        if x == "":
            return 0
        res = 1 + ord(x[-1].upper()) - ord('A') + 26 * cls._get_alpha_index(x[:-1])
        return res
