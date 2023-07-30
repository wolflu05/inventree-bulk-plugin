from jinja2 import Environment

env = Environment(variable_start_string="{{", variable_end_string="}}")


class Template:
    def __init__(self, template_str: str) -> None:
        self.template_str = template_str

    def validate(self):
        env.parse(self.template_str)
        return True

    def compile(self):
        return env.from_string(self.template_str)
