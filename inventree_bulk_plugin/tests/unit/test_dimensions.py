import unittest

from ...BulkGenerator.generators.generator import GeneratorTypes, Generator
from ...BulkGenerator.dimensions import parse_dimension, match_generator, get_dimension_values


class DimensionsTestCase(unittest.TestCase):
    def test_parse_dimension(self):
        cases = [
            ("hello", [(GeneratorTypes.WORD, "hello", {}, "hello")]),
            ("hello(hello=world)", [(GeneratorTypes.WORD, "hello", {"hello": "world"}, "hello(hello=world)")]),
            ("*TEST", [(GeneratorTypes.INFINITY, "TEST", {}, "*TEST")]),
            ("*TEST(hello=world)", [(GeneratorTypes.INFINITY, "TEST", {"hello": "world"}, "*TEST(hello=world)")]),
            ("1-3", [(GeneratorTypes.RANGE, ("1", "3"), {}, "1-3")]),
            ("12-3435(hello=world)", [(GeneratorTypes.RANGE,
             ("12", "3435"), {"hello": "world"}, "12-3435(hello=world)")]),
            ("A-B", [(GeneratorTypes.RANGE, ("A", "B"), {}, "A-B")]),
            ("ax-za", [(GeneratorTypes.RANGE, ("ax", "za"), {}, "ax-za")]),
            ("Hello,*abc(a=1,b='(2,3)',c=4),1-3(a=1)", [
                (GeneratorTypes.WORD, "Hello", {}, "Hello"),
                (GeneratorTypes.INFINITY, "abc", {"a": "1", "b": "'(2,3)'", "c": "4"}, "*abc(a=1,b='(2,3)',c=4)"),
                (GeneratorTypes.RANGE, ("1", "3"), {"a": "1"}, "1-3(a=1)")
            ]),
        ]

        for test_str, expected_generators in cases:
            with self.subTest(test_str):
                generators = parse_dimension(test_str)

                for (gen_type, gen, settings, gen_str), (exp_gen_type, exp_gen, exp_settings, exp_gen_str) in zip(generators, expected_generators):
                    self.assertEqual(exp_gen_type, gen_type)
                    self.assertEqual(exp_gen, gen)
                    self.assertDictEqual(exp_settings, settings)
                    self.assertEqual(exp_gen_str, gen_str)

    def test_match_generator(self):
        class AGenerator(Generator):
            NAME = "A_GENERATOR"

        class BGenerator(Generator):
            NAME = "B_GENERATOR"

        class CGenerator(Generator):
            NAME = "C_GENERATOR"

            @staticmethod
            def is_generator(start_value, end_value):
                return start_value == "A" and end_value == "B"

        generators = [AGenerator, BGenerator, CGenerator]

        cases = [
            (GeneratorTypes.INFINITY, "B_GENERATOR", BGenerator),
            (GeneratorTypes.INFINITY, "NOT_EXIST_GENERATOR", None),
            (GeneratorTypes.RANGE, ("A", "B"), CGenerator),
            (GeneratorTypes.RANGE, ("D", "E"), None),
        ]

        for gen_type, gen, expected in cases:
            with self.subTest(gen, gen_type=gen_type):
                res = match_generator(generators, gen_type, gen)
                self.assertEqual(expected, res)

    def test_get_dimension_values(self):
        cases = [
            ("abc", None, ["abc"]),
            ("*NUMERIC(start=10, end=14)", None, ["10", "11", "12", "13", "14"]),
            ("*NUMERIC(start=10, end=14, count=2)", None, ["10", "11"]),
            ("42-45", None, ["42", "43", "44", "45"]),
            ("*NUMERIC(start=42,end=45,step=3)", None, ["42", "45"]),
            ("42-45(step=3)", None, ["42", "45"]),
            ("*NUMERIC(start=10,count=2)", None, ["10", "11"]),
            ("0-2,hello,world", 4, ["0", "1", "2", "hello"]),
        ]

        for dim, global_count, expected in cases:
            with self.subTest(dim):
                res = get_dimension_values(dim, global_count)
                self.assertListEqual(expected, res)

        # these cases should throw exceptions
        cases = [
            ("*NO_EXISTING_GENERATOR", None, "No generator named: '\\*NO_EXISTING_GENERATOR'"),
            ("*NUMERIC", None, "Missing count for generator: '\\*NUMERIC' or dimension count")
        ]

        for dim, global_count, error_pattern in cases:
            with self.subTest(dim):
                with self.assertRaisesRegex(ValueError, error_pattern):
                    get_dimension_values(dim, global_count)
