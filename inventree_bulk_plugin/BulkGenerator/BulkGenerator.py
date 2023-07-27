import itertools
import re

from ..version import BULK_PLUGIN_VERSION
from .validations import BulkDefinitionChild, BulkDefinitionChildTemplate, BulkDefinitionSchema
from .dimensions import get_dimension_values
from .utils import version_tuple


class DotDict(dict):
    """dot.notation access to dictionary attributes."""

    def __getattr__(*args):
        return dict.get(*args, "")
    __setattr__ = dict.__setitem__
    __delattr__ = dict.__delitem__


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


class BulkGenerator:
    def __init__(self, inp):
        self.inp = inp
        self.schema: BulkDefinitionSchema = None

    def generate(self):
        self.validate()
        return self.parse_child(self.schema.output)

    def validate(self):
        self.schema = BulkDefinitionSchema(**self.inp)

        version = version_tuple(self.schema.version)
        curr_version = version_tuple(BULK_PLUGIN_VERSION)

        if version[0] != curr_version[0]:
            raise ValueError(
                f"The server runs on v{BULK_PLUGIN_VERSION} which is incompatible to v{self.schema.version}.")

    def parse_child(self, child: BulkDefinitionChild):
        res = []

        # merge extend template
        if child.extends:
            template = next(
                filter(lambda x: x.name == child.extends, self.schema.templates), None)
            if template is None:
                raise ValueError(f"template {child.extends} is not defined")

            child = apply_template(child, template)

        # generate
        if len(child.dimensions) > 0:
            product = self.generate_product(
                child.dimensions, child.count, child)
            for p in product:
                ctx = {'dim': DotDict(
                    {f"{i + 1}": x for i, x in enumerate(p)})}
                res.append((self.get_generated(child, ctx), []))
        else:
            # no dimensions
            res.append((self.get_generated(child), []))

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
                if not re.match(c.parent_name_match, generated[0]['name']):
                    continue

                has_matched = True

                # add child items if child found
                res[i][1].extend(self.parse_child(c))
                break

            if not has_matched and len(child.childs) > 0:
                raise ValueError("No match for " + generated[0]['name'])

        return res

    def generate_product(self, dimensions, count, child):
        seq = []
        for d, c in itertools.zip_longest(dimensions, count, fillvalue=None):
            seq.append(get_dimension_values(d, c, self.schema.settings))

        return itertools.product(*seq, repeat=1)

    def get_generated(self, child, ctx={}):
        return dict([a, self.parse_str(x, ctx)] for a, x in child.generate.items())

    def parse_str(self, string, ctx={}):
        ctx = {'inp': DotDict(self.schema.input), **ctx}

        try:
            return string.format(**ctx)
        except Exception as e:
            raise ValueError(
                f"Invalid generator template '{string}'\nException: {e}")
