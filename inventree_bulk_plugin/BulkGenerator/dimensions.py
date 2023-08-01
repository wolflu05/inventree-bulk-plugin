import itertools
import re
from typing import Iterable, Tuple, Union

from .generators import GENERATORS
from .generators.generator import Generator, GeneratorTypes


def parse_dimension(dimension: str) -> list[tuple[GeneratorTypes, Union[str, tuple[str, str]], dict, str]]:
    res = []
    for gen_match in re.finditer(r"(?:(?:(\w+)-(\w+))|(\*?\w+))(?:\((.*?)\))?(?:,|$)", dimension):
        settings = {}
        if gen_match.group(4):
            for setting_match in re.finditer(r"([A-Za-z_]+?)(?:=)([^=]+)(?:,|$)", gen_match.group(4)):
                settings[setting_match.group(1)] = setting_match.group(2)

        # decide if word/infinity generator or start-end is given
        if gen_match.group(3) is not None:
            gen = gen_match.group(3).lstrip("*")
            gen_type = (GeneratorTypes.INFINITY if gen_match.group(3).startswith("*") else GeneratorTypes.WORD)
        else:
            gen = (gen_match.group(1), gen_match.group(2))
            gen_type = GeneratorTypes.RANGE

        res.append((gen_type, gen, settings, gen_match.group(0).rstrip(",")))

    return res


def match_generator(generators: list[Generator], gen_type: GeneratorTypes, gen: Union[str, Tuple[str, str]]) -> Union[Generator, None]:
    for generator in generators:
        if gen_type == GeneratorTypes.INFINITY and generator.NAME == gen:
            return generator
        elif gen_type == GeneratorTypes.RANGE and generator.is_generator(*gen):
            return generator

    return None


def get_dimension_values(dimension: str, global_count: Union[int, None]) -> Iterable[str]:
    seq = []
    parsed_dimension = parse_dimension(dimension)
    for gen_type, gen, settings, gen_name in parsed_dimension:
        if gen_type == GeneratorTypes.WORD:
            def generator():
                yield gen
            seq.append((generator(), 0, 1, 1))
        else:
            gen_class = match_generator(GENERATORS, gen_type, gen)

            if gen_class is None:
                raise ValueError(f"No generator named: '{gen_name}'")

            gen_instance: Generator = gen_class(gen_type, gen, settings, gen_name)

            start_idx, end_idx = 0, None

            # start/end/count only works for Infinity generators
            if gen_type == GeneratorTypes.INFINITY:
                if (start := gen_instance.settings.start) is not None:
                    start_idx = gen_instance.get_index(start)
                if (end := gen_instance.settings.end) is not None:
                    end_idx = gen_instance.get_index(end)

                # count has a higher priority than start/end
                if (count := gen_instance.settings.count) is not None:
                    end_idx = start_idx + count - 1

            # for range generators we have to calculate start and end index
            if gen_type == GeneratorTypes.RANGE:
                start_idx = gen_instance.get_index(gen[0])
                end_idx = gen_instance.get_index(gen[1])

            # if end is set, end_idx needs to be one bigger as last index that should be generated
            if end_idx is not None:
                end_idx = end_idx + 1

            step = gen_instance.settings.step

            seq.append((gen_instance.generator(), start_idx, end_idx, step))

    # generate result, islice objects with no end will take all available space to generate global_count elements
    res = []
    for (generator, start_idx, end_idx, step), (gen_type, gen, settings, gen_name) in zip(seq, parsed_dimension):
        length = None
        if None not in [start_idx, end_idx]:
            length = (end_idx - start_idx) * step

        if global_count is None and length is None:
            raise ValueError(f"Missing count for generator: '{gen_name}' or dimension count")

        if global_count is not None:
            if (remaining_items := global_count - len(res)) <= 0:
                break

            end_idx = min(start_idx + remaining_items * step, end_idx or float("inf"))

        res.extend(itertools.islice(generator, start_idx, end_idx, step))

    return res
