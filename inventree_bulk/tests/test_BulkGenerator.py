import unittest

from BulkGenerator.BulkGenerator import BulkGenerator, BulkDefinitionChild, BulkDefinitionChildTemplate, apply_template


class BulkGeneratorTestCase(unittest.TestCase):
    def test_1D_generation(self):
        dimensions = [
            ("NUMERIC", list(range(1, 6))),
            ("ALPHA_UPPER", ["A", "B", "C", "D", "E"]),
            ("ALPHA_LOWER", ["a", "b", "c", "d", "e"]),
        ]

        for dim, exp in dimensions:
            with self.subTest(f"test {dim} dimension"):
                res = BulkGenerator({
                    "version": "0.1.0",
                    "input": {},
                    "templates": [],
                    "output": {
                        "dimensions": [dim],
                        "count": ["5"],
                        "generate": {
                            "name": "before{dim.1}after",
                        },
                        "childs": []
                    }
                }).generate()

                for e, (r, child) in zip(exp, res):
                    self.assertDictEqual({"name": f"before{e}after"}, r)
                    self.assertEqual(len(child), 0, "should generate no child's")

    def test_template(self):
        res = BulkGenerator({
            "version": "0.1.0",
            "input": {},
            "templates": [
                {
                    "name": "Drawer",
                    "dimensions": ["NUMERIC"],
                    "count": ["4"],
                    "generate": {
                        "name": "{dim.1} from template",
                        "description": "",
                        "abc": "{dim.1} from template"
                    },
                    "childs": []
                }
            ],
            "output": {
                "extends": "Drawer",
                "dimensions": [""],
                "count": ["10"],
                "generate": {
                    "name": "{dim.1} from child",
                    "description": "{dim.1} from child",
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
                "version": "0.1.0",
                "input": {},
                "templates": [],
                "output": {
                    "extends": "Drawer",
                }
            }).generate()

    def test_without_dimensions(self):
        res = BulkGenerator({
            "version": "0.1.0",
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

    def test_invalid_template(self):
        with self.assertRaisesRegex(ValueError, "Invalid generator template '{hello.world}'\nException: .*"):
            BulkGenerator({
                "version": "0.1.0",
                "input": {},
                "templates": [],
                "output": {
                    "dimensions": [],
                    "count": [],
                    "generate": {
                        "name": "{hello.world}",
                    },
                    "childs": []
                }
            }).generate()

    def test_merge_base_child_to_childs(self):
        res = BulkGenerator({
            "version": "0.1.0",
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
            "version": "0.1.0",
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
            "version": "0.1.0",
            "input": {},
            "templates": [],
            "output": {
                "dimensions": ["NUMERIC"],
                "count": [9],
                "generate": {"name": "{dim.1}"},
                "childs": [
                    {
                        "parent_name_match": "[0-4]",
                        "generate": {"a": "first"}
                    },
                    {
                        "parent_name_match": "[5-9]",
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
                "version": "0.1.0",
                "input": {},
                "templates": [],
                "output": {
                    "dimensions": ["NUMERIC"],
                    "count": [9],
                    "generate": {"name": "{dim.1}"},
                    "childs": [
                        {
                            "parent_name_match": "this pattern wont match",
                            "generate": {"a": "first"}
                        },
                    ]
                }
            }).generate()
