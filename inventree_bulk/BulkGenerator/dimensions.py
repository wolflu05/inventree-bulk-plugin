import itertools
import string
import re


def numeric_generator():
    return itertools.count(0)


def alpha_generator(letters=string.ascii_uppercase):
    for i in itertools.count(0):
        for p in itertools.product(letters, repeat=i):
            yield ''.join(p)


def get_alpha_generator(letters=string.ascii_uppercase):
    return lambda: alpha_generator(letters)


def try_int(x):
    if x.isdigit():
        return int(x)
    return x


def get_alpha_index(x):
    if x == "":
        return 0
    return 1 + ord(x[-1].upper()) - ord('A') + 26 * get_alpha_index(x[:-1])


def get_dimension_type(dim, count, default_start=1):
    if m := re.search(r"(.+)-(.+)", dim):
        a, b = try_int(m.group(1)), try_int(m.group(2))

        if type(a) is not type(b):
            raise ValueError(f"'{dim}' is not of same type")

        if isinstance(a, int):
            return numeric_generator, (int(a), int(b) + 1)

        if isinstance(a, str):
            if a.islower() and b.islower():
                letters = string.ascii_lowercase
            elif a.isupper() and b.isupper():
                letters = string.ascii_uppercase
            else:
                raise ValueError(f"'{dim}' is not supported with mixed upper/lower range")

            start, end = get_alpha_index(a), get_alpha_index(b) + 1
            if count is not None:
                end = min(start + count, end)

            return get_alpha_generator(letters), (start, end)

    if dim in DIMENSIONS_GENERATORS:
        if count is None:
            raise ValueError(f"'{dim}' is an infinity generator, count expected")

        if dim != "NUMERIC":
            default_start = 1

        return DIMENSIONS_GENERATORS[dim], (default_start, default_start + count)

    raise ValueError(f"Unknown dimmension '{dim}'")


DIMENSIONS_GENERATORS = {
    "NUMERIC": numeric_generator,
    "ALPHA_UPPER": get_alpha_generator(string.ascii_uppercase),
    "ALPHA_LOWER": get_alpha_generator(string.ascii_lowercase),
}
