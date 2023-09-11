from dataclasses import dataclass
import itertools
from typing import Any, Callable, Iterable, Literal, Optional, Union

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


@dataclass
class BaseFieldDefinition:
    name: str
    field_type: Literal["text", "list", "object"] = "text"
    cast_func: Callable[[str], Any] = None
    required: bool = False
    items_type: Optional["BaseFieldDefinition"] = None
    fields: Optional[dict[str, "BaseFieldDefinition"]] = None


FieldType = Union[BaseFieldDefinition, dict[str, BaseFieldDefinition], list[BaseFieldDefinition]]


ParseChildReturnElement = tuple[dict[str, str], list["ParseChildReturnType"]]
ParseChildReturnType = list[ParseChildReturnElement]


class BulkGenerator:
    def __init__(self, inp, fields: dict[str, BaseFieldDefinition]):
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
        render = self.compile_generate_fields(self.fields, child.generate, child.global_context)
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

    def compile_generate_fields(self, fields: FieldType, generate: dict, global_context: str):
        missing_fields = []

        global_context_template = Template(global_context).compile()

        def compile_templates(field: FieldType, generate, path: list[str] = []):
            path_str = ".".join(map(str, path))

            if field.field_type == "object" and field.fields:
                if not isinstance(generate, dict):
                    if field.required:
                        missing_fields.append(path_str)
                    return None
                return {k: v for k, f in field.fields.items() if (v := compile_templates(f, generate.get(k, None), [*path, k])) is not None}
            elif field.field_type == "list" and field.items_type:
                if not isinstance(generate, list):
                    if field.required:
                        missing_fields.append(path_str)
                    return None
                return [v for i, f in enumerate(generate) if (v := compile_templates(field.items_type, f, [*path, i])) is not None]
            else:
                # check required fields
                if generate is None:
                    if field.required:
                        missing_fields.append(path_str)
                    return None

                # compile template
                try:
                    template_str = "{% import global_context_template as global with context %}" + str(generate)
                    compiled_template = Template(template_str, ctx={"global_context_template": global_context_template}).compile()
                except TemplateError as e:  # pragma: no cover
                    # catch this error in any case it bypasses validation somehow because an error is not handled during ast creation but occurred on compile
                    raise ValueError(f"Invalid generator template '{generate}' at: '{path_str}'\nException: {e}")

                # prepare render function
                def render(**ctx):
                    v = compiled_template.render(**ctx)
                    if field.required and v == "":
                        raise ValueError(
                            f"'{path_str}' is a required field, but template '{generate}' returned empty string")
                    if field.cast_func:
                        try:
                            return field.cast_func(v, field=field)
                        except ValueError as e:
                            raise ValueError(f"{path_str}: {e}")
                    return v

                return render

        compiled_templates = compile_templates(BaseFieldDefinition(
            "", field_type="object", fields=fields), generate)

        if len(missing_fields) > 0:
            raise ValueError(f"'{','.join(missing_fields)}' are missing in generated keys.")

        def recursive_map(func: Callable[[Any, list[str]], Any], d: Any, path: list[str] = []):
            if isinstance(d, dict):
                return {k: recursive_map(func, v, [*path, str(k)]) for k, v in d.items()}
            if isinstance(d, list):
                return [recursive_map(func, v, [*path, i]) for i, v in enumerate(d)]
            return func(d, path)

        def render(**ctx):
            try:
                return recursive_map(lambda x, path: x(**ctx) if x else None, compiled_templates)
            except TemplateError as e:
                raise ValueError(f"Exception: {e}")

        return render
