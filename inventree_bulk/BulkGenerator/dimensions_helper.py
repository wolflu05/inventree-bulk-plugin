import itertools
import re
from typing import Iterable, Tuple, Union

from .dimensions import DIMENSIONS
from .dimensions.dimension import Dimension, DimensionTypes


def parse_dimension(dimension):
    res = []
    for dim_match in re.finditer(r"(?:(?:(\w+)-(\w+))|(\*?\w+))(?:{(.*?)})?(?:,|$)", dimension):
        settings = {}
        if dim_match.group(4):
            for setting_match in re.finditer(r"([A-Za-z_]+?)(?:=)([^=]+)(?:,|$)", dim_match.group(4)):
                settings[setting_match.group(1)] = setting_match.group(2)

        # decide if one word/infinity dimension or start-end is given
        if dim_match.group(3) is not None:
            dim = dim_match.group(3).lstrip("*")
            dim_type = (DimensionTypes.INFINITY if dim_match.group(3).startswith("*") else DimensionTypes.WORD)
        else:
            dim = (dim_match.group(1), dim_match.group(2))
            dim_type = DimensionTypes.RANGE

        res.append((dim_type, dim, settings, dim_match.group(0)))

    return res


def match_generator(dim_type: DimensionTypes, dim: Union[str, Tuple[str, str]]) -> Dimension | None:
    for dimension in DIMENSIONS:
        if dim_type == DimensionTypes.INFINITY and dimension.NAME == dim:
            return dimension
        elif dim_type == DimensionTypes.RANGE and dimension.is_dimension(*dim):
            return dimension


def get_dimension_values(dimension: str, global_count: int, settings: dict) -> Iterable[str]:
    seq = []
    parsed_dimensions = parse_dimension(dimension)
    for dim_type, dim, settings, dim_name in parsed_dimensions:
        if dim_type == DimensionTypes.WORD:
            def generator():
                yield dim
            seq.append((generator(), 0, 1, 1))
        else:
            dimension_class = match_generator(dim_type, dim)

            if dimension_class is None:
                raise ValueError(f"No generator for dimension: '{dim_name}'")

            dimension_instance: Dimension = dimension_class(dim_type, dim, settings, dim_name)

            start_idx, end_idx = 0, None

            # start/end/count only works for Infinity generators
            if dim_type == DimensionTypes.INFINITY:
                if (start := dimension_instance.settings.start) is not None:
                    start_idx = dimension_instance.get_index(start)
                if (end := dimension_instance.settings.end) is not None:
                    end_idx = dimension_instance.get_index(end)

                # count has a higher priority than start/end
                if (count := dimension_instance.settings.count) is not None:
                    end_idx = start_idx + count - 1

            # for range generators we have to calculate start and end index from the dimension
            if dim_type == DimensionTypes.RANGE:
                start_idx = dimension_instance.get_index(dim[0])
                end_idx = dimension_instance.get_index(dim[1])

            # if end is set, end_idx needs to be one bigger as last index that should be generated
            if end_idx is not None:
                end_idx = end_idx + 1

            step = dimension_instance.settings.step

            seq.append((dimension_instance.generator(), start_idx, end_idx, step))

    # generate result, islice objects with no end will take all available space to generate global_count elements
    res = []
    for (generator, start_idx, end_idx, step), (dim_type, dim, settings, dim_name) in zip(seq, parsed_dimensions):
        length = None
        if None not in [start_idx, end_idx]:
            length = (end_idx - start_idx) * step

        if global_count is None and length is None:
            raise ValueError(f"Missing count for dimension: '{dim_name}' or global count")

        if global_count is not None:
            if (remaining_items := global_count - len(res)) <= 0:
                break

            end_idx = min(start_idx + remaining_items * step, end_idx or float("inf"))

        res.extend(itertools.islice(generator, start_idx, end_idx, step))

    return res
