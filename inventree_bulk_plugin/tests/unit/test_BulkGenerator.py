import unittest

from ...BulkGenerator.BulkGenerator import BulkGenerator, apply_template
from ...BulkGenerator.validations import BulkDefinitionChild, BulkDefinitionChildTemplate


class BulkGeneratorTestCase(unittest.TestCase):
    def test_1D_generation(self):
        dimensions = [
            ("*NUMERIC", list(range(1, 6))),
            ("*ALPHA(casing=upper)", ["A", "B", "C", "D", "E"]),
            ("*ALPHA(casing=lower)", ["a", "b", "c", "d", "e"]),
        ]

        for dim, exp in dimensions:
            with self.subTest(f"test {dim} dimension"):
                res = BulkGenerator({
                    "version": "1.0.0",
                    "input": {},
                    "templates": [],
                    "output": {
                        "dimensions": [dim],
                        "count": ["5"],
                        "generate": {
                            "name": "before{{dim.1}}after",
                        },
                        "childs": []
                    }
                }).generate()

                for e, (r, child) in zip(exp, res):
                    self.assertDictEqual({"name": f"before{e}after"}, r)
                    self.assertEqual(len(child), 0, "should generate no child's")

    def test_template(self):
        res = BulkGenerator({
            "version": "1.0.0",
            "input": {},
            "templates": [
                {
                    "name": "Drawer",
                    "dimensions": ["*NUMERIC"],
                    "count": ["4"],
                    "generate": {
                        "name": "{{dim.1}} from template",
                        "description": "",
                        "abc": "{{dim.1}} from template"
                    },
                    "childs": []
                }
            ],
            "output": {
                "extends": "Drawer",
                "dimensions": [""],
                "count": ["10"],
                "generate": {
                    "name": "{{dim.1}} from child",
                    "description": "{{dim.1}} from child",
                    "abc": ""
                },
                "childs": []
            }
        }).generate()

        self.assertEqual(len(res), 10, "should generate 10 elements")

        for i, (el, child) in enumerate(res):
            self.assertDictEqual({"name": f"{i+1} from child", "description": f"{i+1} from child",
                                 "abc": f"{i+1} from template"}, el)
            self.assertEqual(len(child), 0, "should generate no child's")

    def test_apply_template(self):
        with self.subTest("merge child's"):
            child = BulkDefinitionChild()
            obj = BulkDefinitionChild(childs=[])
            template = BulkDefinitionChildTemplate(childs=[child], name="testTemplate")
            res = apply_template(obj, template)
            self.assertListEqual([child], res.childs)

        cases = [
            ("count", [None, 1], [2, 3, 4], [2, 1, 4]),
            ("count", [0, 1, 2, 3], [2, 3], [0, 1, 2, 3]),
            ("dimensions", ["", "a"], ["b", "c", "d"], ["b", "a", "d"]),
            ("dimensions", ["a", "b", "c", "d"], ["e", "f"], ["a", "b", "c", "d"])
        ]
        for field, obj_val, temp_val, exp in cases:
            with self.subTest("merge array", field=field, obj=obj_val, temp=temp_val):
                obj = BulkDefinitionChild(**{field: obj_val})
                template = BulkDefinitionChildTemplate(**{field: temp_val}, name="testTemplate")
                res = apply_template(obj, template)
                self.assertListEqual(exp, getattr(res, field))

        with self.subTest("merge generate"):
            obj = BulkDefinitionChild(generate={"test": "from obj", "hello": "world obj"})
            template = BulkDefinitionChildTemplate(
                generate={"abc": "def", "hello": "world template"}, name="testTemplate")
            res = apply_template(obj, template)
            self.assertDictEqual({"test": "from obj", "hello": "world obj", "abc": "def"}, res.generate)

        with self.subTest("obj_attr none"):
            obj = BulkDefinitionChild(parent_name_match=None)
            template = BulkDefinitionChildTemplate(parent_name_match="[A-Z]+", name="testTemplate")
            res = apply_template(obj, template)
            self.assertEqual("[A-Z]+", res.parent_name_match)

    def test_reference_undefined_template(self):
        with self.assertRaisesRegex(ValueError, "template Drawer is not defined"):
            BulkGenerator({
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "extends": "Drawer",
                }
            }).generate()

    def test_without_dimensions(self):
        res = BulkGenerator({
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "dimensions": [],
                "count": [],
                "generate": {
                    "name": "test",
                },
                "childs": []
            }
        }).generate()

        self.assertEqual(1, len(res))
        self.assertDictEqual({"name": "test"}, res[0][0])
        self.assertEqual(0, len(res[0][1]))

    def test_input_variables(self):
        res = BulkGenerator({
            "version": "1.0.0",
            "input": {"a": "2", "b": "Hello"},
            "templates": [],
            "output": {
                "dimensions": ["*NUMERIC(count={{inp.a}})"],
                "count": [],
                "generate": {
                    "name": "{{inp.b}} {{dim.1}}",
                },
                "childs": []
            }
        }).generate()

        self.assertEqual(2, len(res))
        self.assertDictEqual({"name": "Hello 1"}, res[0][0])
        self.assertDictEqual({"name": "Hello 2"}, res[1][0])
        self.assertEqual(0, len(res[0][1]))
        self.assertEqual(0, len(res[1][1]))

    def test_invalid_template(self):
        with self.assertRaisesRegex(Exception, "1 validation error for BulkDefinitionSchema\noutput\n  output.dimensions.0: 'hello' is undefined"):
            BulkGenerator({
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "dimensions": ["{{hello.1}}"],
                    "count": [],
                    "generate": {
                        "name": "A",
                    },
                    "childs": []
                }
            }).generate()

    def test_invalid_template_on_dimensions_render(self):
        cases = [
            ("Invalid template", "{{}", ValueError, r".*"),
            ("Invalid variable", "{{hello.world}}", ValueError, "Exception: 'hello' is undefined"),
        ]

        for name, template, error, error_regex in cases:
            with self.subTest(name, template=template):
                with self.assertRaisesRegex(error, error_regex):
                    BulkGenerator({
                        "version": "1.0.0",
                        "input": {},
                        "templates": [],
                        "output": {
                            "dimensions": [],
                            "count": [],
                            "generate": {
                                "name": template,
                            },
                            "childs": []
                        }
                    }).generate()

    def test_merge_base_child_to_childs(self):
        res = BulkGenerator({
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "dimensions": [],
                "count": [],
                "generate": {"name": "abc"},
                "child": {"generate": {"name": "def", "description": "jkl"}},
                "childs": [
                    {"generate": {"description": "ghi"}}
                ]
            }
        }).generate()

        self.assertEqual(1, len(res))
        self.assertDictEqual({"name": "abc"}, res[0][0])
        self.assertEqual(1, len(res[0][1]), "assert only generate one child")
        self.assertDictEqual({"name": "def", "description": "ghi"},
                             res[0][1][0][0], "assert base child was merged correctly")

    def test_merge_base_child_to_childs_with_no_childs(self):
        res = BulkGenerator({
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "dimensions": [],
                "count": [],
                "generate": {"name": "abc"},
                "child": {"generate": {"name": "def", "description": "jkl"}},
                "childs": []
            }
        }).generate()

        self.assertEqual(1, len(res))
        self.assertDictEqual({"name": "abc"}, res[0][0])
        self.assertEqual(1, len(res[0][1]), "assert only generate one child")
        self.assertDictEqual({"name": "def", "description": "jkl"},
                             res[0][1][0][0], "assert base child was merged correctly")

    def test_parent_name_match(self):
        res = BulkGenerator({
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "dimensions": ["*NUMERIC"],
                "count": [9],
                "generate": {"name": "{{dim.1}}"},
                "childs": [
                    {
                        "parent_name_match": "{{0 <= par.dim.1|int <= 4}}",
                        "generate": {"a": "first"}
                    },
                    {
                        "parent_name_match": "{{5 <= par.dim.1|int <= 9}}",
                        "generate": {"a": "second"}
                    }
                ]
            }
        }).generate()

        self.assertEqual(9, len(res))
        for i, (e, childs) in enumerate(res):
            self.assertEqual("first" if i + 1 <= 4 else "second", childs[0][0]["a"])

    def test_missing_child_match(self):
        with self.assertRaisesRegex(ValueError, "No match for 1"):
            BulkGenerator({
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "dimensions": ["*NUMERIC"],
                    "count": [9],
                    "generate": {"name": "{{dim.1}}"},
                    "childs": [
                        {
                            "parent_name_match": "false",
                            "generate": {"a": "first"}
                        },
                    ]
                }
            }).generate()

    def test_error_in_parent_name_match(self):
        with self.assertRaisesRegex(ValueError, "Invalid generator template '{{something.not.existing}}'"):
            BulkGenerator({
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "dimensions": ["*NUMERIC"],
                    "count": [9],
                    "generate": {"name": "{{dim.1}}"},
                    "childs": [
                        {
                            "parent_name_match": "{{something.not.existing}}",
                            "generate": {"a": "first"}
                        },
                    ]
                }
            }).generate()

    def test_parent_context(self):
        res = BulkGenerator({
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "dimensions": ["A-B"],
                "generate": {"name": "First {{dim.1}}"},
                "child": {
                    "generate": {"name": "Second {{dim.1}}"},
                    "child": {
                        "generate": {"parent_name": "{{par.gen.name}}", "parent_parent_dim_1": "{{par.par.dim.1}}"}
                    }
                }
            }
        }).generate()

        self.assertListEqual([({'name': 'First A'}, [({'name': 'Second '}, [({'parent_name': 'Second ', 'parent_parent_dim_1': 'A'}, [])])]), ({
                             'name': 'First B'}, [({'name': 'Second '}, [({'parent_name': 'Second ', 'parent_parent_dim_1': 'B'}, [])])])], res)

    def test_len_context_variable(self):
        res = BulkGenerator({
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "dimensions": ["*NUMERIC", "*ALPHA"],
                "count": [10, 2],
                "generate": {"length": "{{len}}", "dim1len": "{{dim.1.len}}", "dim2len": "{{dim.2.len}}"},
            }
        }).generate()

        self.assertEqual(20, len(res))
        for e, _ in res:
            self.assertEqual("20", e['length'])
            self.assertEqual("10", e['dim1len'])
            self.assertEqual("2", e['dim2len'])

    def test_not_allowed_field(self):
        with self.assertRaisesRegex(ValueError, "'NOT_ALLOWED_KEY' is not allowed to be generated"):
            BulkGenerator({
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {"generate": {"NOT_ALLOWED_KEY": "1"}, }
            }, {"BBBB": {}}).generate()

    def test_cast_field(self):
        res = BulkGenerator({
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {"generate": {"number_field": "42"}, }
        }, {"number_field": {"cast_func": int}}).generate()

        self.assertEqual(res[0][0]["number_field"], 42)

    def test_required_field(self):
        with self.assertRaisesRegex(ValueError, "'required_field' is a required field, but template returned empty string"):
            BulkGenerator({
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {"generate": {"required_field": ""}, }
            }, {"required_field": {"required": True}}).generate()

        with self.assertRaisesRegex(ValueError, "'name' is missing in generated keys"):
            BulkGenerator({
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {"generate": {"description": ""}, }
            }, {"name": {"required": True}}).generate()

        with self.assertRaisesRegex(ValueError, "'name' is a required field, but template returned empty string"):
            BulkGenerator({
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {"generate": {"name": "", "description": "AA"}, }
            }, {"name": {"required": True}, "description": {}}).generate()
