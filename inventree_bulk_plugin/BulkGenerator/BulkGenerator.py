import itertools
from typing import Any, Iterable

from jinja2.exceptions import TemplateError

from ..version import BULK_PLUGIN_VERSION
from .validations import BulkDefinitionChild, BulkDefinitionChildCount, BulkDefinitionChildDimensions, BulkDefinitionChildTemplate, BulkDefinitionSchema
from .dimensions import get_dimension_values
from .utils import version_tuple
from .template import Template


def apply_template(obj: BulkDefinitionChild, template: BulkDefinitionChildTemplate):
    for k in template.model_fields.keys():
        # only templates have names
        if k == "name":
            continue

        obj_attr = getattr(obj, k, None)
        template_attr = getattr(template, k, None)

        if template_attr is None:
            continue

        if k in ['childs'] and isinstance(obj_attr, list) and isinstance(template_attr, list):
            if len(obj_attr) == 0:
                setattr(obj, k, template_attr)

        if k in ['count', 'dimensions']:
            for i, (t_val, o_val) in enumerate(itertools.zip_longest(template_attr or [], obj_attr or [], fillvalue=None)):
                if (o_val is None or o_val == "") and (t_val is not None or t_val != ""):
                    if i < len(obj_attr):
                        obj_attr[i] = t_val
                    else:
                        obj_attr.append(t_val)

        if k in ["generate"] and type(template_attr) is dict:
            for key, value in template_attr.items():
                existing_value = obj_attr.get(key, "")
                if existing_value == "" and value != "":
                    obj_attr[key] = value

        if obj_attr is None:
            setattr(obj, k, template_attr)

    return obj


class DimStr(str):
    """String that also has a len attribute."""
    def __new__(cls, value, *args, **kwargs) -> None:
        return super(DimStr, cls).__new__(cls, value)

    def __init__(self, value, length):
        self.len = length


class BulkGenerator:
    def __init__(self, inp, fields=None):
        self.inp = inp
        self.schema: BulkDefinitionSchema = None
        self.fields = fields

    def generate(self, parent_ctx: dict[str, Any] = {}):
        self.validate(apply_input=True)
        return self.parse_child(self.schema.output, parent_ctx)

    def validate(self, apply_input=False):
        self.schema = BulkDefinitionSchema(**self.inp, apply_input=apply_input)

        version = version_tuple(self.schema.version)
        curr_version = version_tuple(BULK_PLUGIN_VERSION)

        if version[0] != curr_version[0]:
            raise ValueError(
                f"The server runs on v{BULK_PLUGIN_VERSION} which is incompatible to v{self.schema.version}.")

    def get_default_context(self):
        return {"inp": self.schema.input}

    ParseChildReturnType = list[tuple[dict[str, str], list["ParseChildReturnType"]]]

    def parse_child(self, child: BulkDefinitionChild, parent_ctx: dict[str, Any] = {}) -> ParseChildReturnType:
        res = []
        child_ctx = []

        # merge extend template
        if child.extends:
            template = next(
                filter(lambda x: x.name == child.extends, self.schema.templates), None)
            if template is None:
                raise ValueError(f"template {child.extends} is not defined")

            child = apply_template(child, template)

        # generate
        render = self.compile_child_templates(child)
        product = []
        dimensions = []
        if len(child.dimensions) > 0:
            dimensions = self.get_dimensions(child.dimensions, child.count)
            product = list(itertools.product(*dimensions, repeat=1))
        else:
            # no dimensions
            product = [()]

        # get length from dimensions
        dimensions = list(map(len, dimensions))

        default_context = self.get_default_context()
        ctx = {'par': parent_ctx, 'len': len(product)}
        for p in product:
            dim = {(i + 1): DimStr(x, dimensions[i]) for i, x in enumerate(p)}
            product_ctx = {**default_context, **ctx, 'dim': dim}
            generate_values = render(**product_ctx)
            res.append((generate_values, []))
            child_ctx.append({**ctx, 'dim': dim, 'gen': generate_values})

        # merge child/childs
        if child.child:
            # define base_child template
            base_child = child.child

            # extend all childs with the base_child
            child.childs = list(
                map(lambda c: apply_template(c, base_child), child.childs))

            # if only the base_child as template is specified, append the base child to the childs
            if len(child.childs) == 0:
                child.childs.append(base_child)

        # parse childs
        for i, generated in enumerate(res):
            has_matched = False

            # search for matching child
            for c in child.childs:
                try:
                    match = Template(c.parent_name_match).compile().render(**default_context, par=child_ctx[i])
                    if match.lower() not in ['1', 'y', 'yes', 't', 'true', 'ok', 'on']:
                        continue
                except TemplateError as e:
                    raise ValueError(f"Invalid generator template '{c.parent_name_match}'\nException: {e}")

                has_matched = True

                # add child items if child found
                res[i][1].extend(self.parse_child(c, child_ctx[i]))
                break

            if not has_matched and len(child.childs) > 0:
                raise ValueError("No match for " + generated[0]['name'])

        return res

    def get_dimensions(self, dimensions: BulkDefinitionChildDimensions, count: BulkDefinitionChildCount) -> list[Iterable[str]]:
        seq = []
        for d, c in itertools.zip_longest(dimensions, count, fillvalue=None):
            seq.append(get_dimension_values(d, c))

        return seq

    def compile_child_templates(self, child: BulkDefinitionChild):
        # check required fields
        if self.fields:
            for k, v in self.fields.items():
                if v.get("required", False) and k not in child.generate:
                    raise ValueError(f"'{k}' is missing in generated keys")

        def get_wrapper(key):
            cast_func = None
            field_required = False
            if self.fields and (field := self.fields.get(key, None)):
                if func := field.get("cast_func", None):
                    cast_func = func
                if required := field.get("required", None):
                    field_required = required

            def wrapper(v):
                if field_required and v == "":
                    raise ValueError(f"'{key}' is a required field, but template returned empty string")
                if cast_func:
                    return cast_func(v)
                return v
            return wrapper

        compiled_templates = {}
        for key, template_str in child.generate.items():
            if self.fields and key not in self.fields:
                raise ValueError(f"'{key}' is not allowed to be generated")

            try:
                compiled_templates[key] = Template(template_str).compile(), get_wrapper(key)
            except TemplateError as e:  # pragma: no cover
                # catch this error in any case it bypasses validation somehow because an error is not handled during ast creation but occurred on compile
                raise ValueError(f"Invalid generator template '{template_str}'\nException: {e}")

        def render(**ctx):
            try:
                return {key: wrapper(template.render(**ctx)) for key, (template, wrapper) in compiled_templates.items()}
            except TemplateError as e:
                raise ValueError(f"Exception: {e}")

        return render
