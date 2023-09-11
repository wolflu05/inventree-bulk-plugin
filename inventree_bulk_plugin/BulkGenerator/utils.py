def version_tuple(v: str):
    return tuple(map(int, v.split(".")))


def str2bool(text):
    string = str(text).lower()
    if string in ['1', 'y', 'yes', 't', 'true', 'ok', 'on', ]:
        return True
    elif string in ['0', 'n', 'no', 'f', 'false', 'off', ]:
        return False

    raise ValueError(f"'{text}' cannot be casted to a boolean, either use 'true' or 'false'.")


def str2int(text, default=None):
    try:
        return int(text)
    except Exception:
        return default


def str2float(text, default=None):
    try:
        return float(text)
    except Exception:
        return default
