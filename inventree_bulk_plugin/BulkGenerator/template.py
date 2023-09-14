import csv
import json
import io
from jinja2 import Environment


def to_csv(value, **kwargs):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=value[0].keys(), **kwargs)
    writer.writeheader()
    for line in value:
        writer.writerow(line)
    return output.getvalue()


def from_csv(value, **kwargs):
    return list(csv.DictReader(io.StringIO(value), **kwargs))


def to_json(value, **kwargs):
    return json.dumps(value, **kwargs)


def from_json(value, **kwargs):
    return json.loads(value, **kwargs)


template_filters = {
    "to_csv": to_csv,
    "from_csv": from_csv,
    "to_json": to_json,
    "from_json": from_json
}

env = Environment(variable_start_string="{{", variable_end_string="}}", extensions=["jinja2.ext.debug"])
env.filters.update(template_filters)


class Template:
    def __init__(self, template_str: str, **kwargs) -> None:
        self.ctx = kwargs.get("ctx", {})
        self.template_str = template_str

    def validate(self):
        env.parse(self.template_str)
        return True

    def compile(self):
        return env.from_string(str(self.template_str), self.ctx)
