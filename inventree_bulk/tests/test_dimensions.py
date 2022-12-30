import unittest
import types
from itertools import islice

from BulkGenerator.dimensions import numeric_generator, alpha_generator, get_alpha_generator, try_int, get_alpha_index, get_dimension_type


class DimensionsTestCase(unittest.TestCase):
    def assertGenerator(self, generator, expected, *, args={}, start=0, stop=None):
        exp = list(expected)
        stop = len(exp) if stop is None else stop
        gen = list(islice(generator(**args), start, stop))
        self.assertListEqual(exp, gen)

    def test_numeric_generator(self):
        self.assertGenerator(numeric_generator, range(1000))

    def test_alpha_generator(self):
        exp = ["A", "B", "C", "AA", "AB", "AC", "BA", "BB", "BC", "CA", "CB"]
        self.assertGenerator(alpha_generator, exp, args={"letters": "ABC"})

    def test_get_alpha_generator(self):
        gen = get_alpha_generator("DEF")
        self.assertIsInstance(gen(), types.GeneratorType)

        exp = ["D", "E", "F", "DD", "DE", "DF", "ED", "EE", "EF", "FD", "FE"]
        self.assertGenerator(gen, exp)

    def test_try_int(self):
        self.assertEqual(try_int("42"), 42)
        self.assertEqual(try_int("1a"), "1a")

    def test_get_alpha_index(self):
        cases = [
            ("", 0),
            ("A", 0),
            ("G", 6),
            ("AA", 26),
            ("HELLO", 3752126),
        ]

        for test, exp in cases:
            res = get_alpha_index(test)
            self.assertEqual(res, exp)

    def test_get_dimension_type(self):
        cases = [
            ("G-L", None, ["G", "H", "I", "J", "K", "L"]),
            ("X-AC", None, ["X", "Y", "Z", "AA", "AB", "AC"]),
            ("h-k", None, ["h", "i", "j", "k"]),
            ("2-5", None, [2, 3, 4, 5]),
            ("a-3", None, "'a-3' is not of same type"),
            ("a-A", None, "'a-A' is not supported with mixed upper/lower range"),
            ("ALPHA_UPPER", 4, ["A", "B", "C", "D"]),
            ("ALPHA_LOWER", 4, ["a", "b", "c", "d"]),
            ("NUMERIC", 4, [1, 2, 3, 4]),
            ("ALPHA_UPPER", None, "'ALPHA_UPPER' is an infinity generator, count expected"),
            ("NOT_EXISTING", 4, "Unknown dimension 'NOT_EXISTING'"),
        ]

        def assert_dimension(dim, count, exp):
            if type(exp) == str:
                with self.assertRaises(ValueError) as err:
                    get_dimension_type(dim, count)
                self.assertEqual(str(err.exception), exp)
            else:
                gen, (start, end) = get_dimension_type(dim, count)
                self.assertGenerator(gen, exp, start=start, stop=end)

        for test, count, exp in cases:
            assert_dimension(test, count, exp)

            if count is None and type(exp) != str:
                assert_dimension(test, 3, exp[:3])
