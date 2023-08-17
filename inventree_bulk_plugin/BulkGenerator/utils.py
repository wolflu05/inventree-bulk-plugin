def version_tuple(v: str):
    return tuple(map(int, v.split(".")))


def str2bool(text):
    return str(text).lower() in ['1', 'y', 'yes', 't', 'true', 'ok', 'on', ]


def str2int(text, default=None):
    try:
        return int(text)
    except Exception:
        return default
