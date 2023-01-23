import itertools
from typing import Optional
from .generator import Generator, BaseSettingsSchema


class NumericGenerator(Generator):
    NAME = "NUMERIC"

    class SettingsSchema(BaseSettingsSchema):
        start: Optional[int] = 1

    @staticmethod
    def is_generator(start_value, end_value):
        return (start_value.isdigit() and end_value.isdigit())

    def get_index(self, value):
        return int(value)

    def generator(self):
        return (str(i) for i in itertools.count())
