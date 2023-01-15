import itertools
from typing import Optional
from .dimension import Dimension, BaseSettingsSchema


class Numeric(Dimension):
    NAME = "NUMERIC"

    class SettingsSchema(BaseSettingsSchema):
        start: Optional[int] = 1

    @staticmethod
    def is_dimension(start_value, end_value):
        return (start_value.isdigit() and end_value.isdigit())

    def get_index(self, value):
        return int(value)

    def generator(self):
        return itertools.count()
