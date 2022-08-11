import itertools
import re
from typing import List, Optional, Dict, Union, Tuple
from pydantic import BaseModel, ValidationError, PrivateAttr

from .dimensions import get_dimension_type


class dotdict(dict):
    """dot.notation access to dictionary attributes"""
    def __getattr__(*args):
        return dict.get(*args, "")
    __setattr__ = dict.__setitem__
    __delattr__ = dict.__delitem__


class BulkDefinitionChild(BaseModel):
    parent_name_match: Optional[str] = ".*"
    extends: Optional[str]
    dimensions: Optional[List[str]] = []
    generate_name: Optional[str]
    generate_description: Optional[str]
    count: Optional[List[Union[int, None]]] = []
    child: Optional["BulkDefinitionChild"]
    childs: Optional[List["BulkDefinitionChild"]] = []

    _generated: List[Tuple[Dict[str, str],
                           "BulkDefinitionChild._generated"]] = PrivateAttr([])
    _parent: Optional["BulkDefinitionChild"] = PrivateAttr(None)


class BulkDefinitionSettings(BaseModel):
    count_from: Optional[int] = 1
    leading_zeros: Optional[bool] = True


class BulkDefinitionSchema(BaseModel):
    input: Dict[str, Union[int, str]]
    settings: Optional[BulkDefinitionSettings] = BulkDefinitionSettings()
    templates: Dict[str, "BulkDefinitionChild"]
    output: "BulkDefinitionChild"


def apply_template(obj, template):
    for k in template.__fields__.keys():
        obj_attr = getattr(obj, k)
        template_attr = getattr(template, k)

        if template_attr is None:
            continue

        if k in ['childs'] and isinstance(obj_attr, list) and isinstance(template_attr, list):
            for i in template_attr:
                if i not in obj_attr:
                    obj_attr.insert(0, i)

        if k in ['count', 'dimensions'] and len(obj_attr) == 0:
            for i in template_attr:
                obj_attr.append(i)

        if obj_attr is None:
            setattr(obj, k, template_attr)

    return obj


class BulkGenerator:
    def __init__(self, inp):
        self.inp = inp
        self.schema = None

    def generate(self):
        self.validate()
        return self.parse_child(self.schema.output)

    def validate(self):
        try:
            self.schema = BulkDefinitionSchema(**self.inp)
        except ValidationError as e:
            print(e)

    def parse_child(self, child):
        res = []

        # merge extend template
        if child.extends:
            template = self.schema.templates.get(child.extends, None)
            if template is None:
                raise ValueError(f"template {child.extends} is not defined")

            child = apply_template(child, template)

        # generate
        if len(child.dimensions) > 0:
            product = self.generate_product(
                child.dimensions, child.count, child)
            for p in product:
                ctx = {'dim': dotdict(
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
                print("No match for", generated[0]['name'])

        return res

    def generate_product(self, dimensions, count, child):
        seq = []
        for d, c in itertools.zip_longest(dimensions, count, fillvalue=None):
            gen, (start, end) = get_dimension_type(
                d, c, default_start=self.schema.settings.count_from)
            seq.append(itertools.islice(gen(), start, end))

        return itertools.product(*seq, repeat=1)

    def get_generated(self, child, ctx={}):
        return {
            'name': self.parse_str(child.generate_name, ctx),
            'description': self.parse_str(child.generate_description, ctx)
        }

    def parse_str(self, string, ctx={}):
        ctx = {'inp': dotdict(self.schema.input), **ctx}

        try:
            return string.format(**ctx)
        except Exception as e:
            raise ValueError(
                f"Invalid generator template '{string}'\nException: {e}")
