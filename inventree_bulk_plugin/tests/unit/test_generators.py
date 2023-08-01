import unittest
from itertools import islice

from ...BulkGenerator.generators.gen_numeric import NumericGenerator
from ...BulkGenerator.generators.gen_alpha import AlphaGenerator
from ...BulkGenerator.generators.generator import GeneratorTypes
from ...BulkGenerator.dimensions import get_dimension_values


class NumericGeneratorTestCase(unittest.TestCase):
    def test_integration(self):
        self.assertListEqual(list(map(str, range(42, 47, 2))), get_dimension_values("42-46(step=2)", None))
        self.assertListEqual(list(map(str, range(2, 11, 2))), get_dimension_values(
            "*NUMERIC(start=2,end=10,step=2)", None))

    def test_is_generator(self):
        self.assertFalse(NumericGenerator.is_generator("A", "B"))
        self.assertTrue(NumericGenerator.is_generator("1", "2"))

    def test_get_index(self):
        gen = NumericGenerator(GeneratorTypes.RANGE, ("1", "42"), {}, "1-42")
        self.assertEqual(1, gen.get_index("1"))
        self.assertEqual(42, gen.get_index("42"))

    def test_generator(self):
        gen = NumericGenerator(GeneratorTypes.RANGE, ("1", "42"), {}, "1-42")
        self.assertListEqual(list(map(str, range(1, 42))), list(islice(gen.generator(), 1, 42)))


class AlphaGeneratorTestCase(unittest.TestCase):
    def test_integration(self):
        self.assertListEqual(["B", "D", "F"], get_dimension_values("B-F(step=2)", None))
        self.assertListEqual(["b", "d", "f"], get_dimension_values("*ALPHA(start=B,end=F,step=2)", None))
        self.assertListEqual(["C", "E", "G", "I"], get_dimension_values(
            "*ALPHA(casing=upper,start=C,end=I,step=2)", None))

    def test_is_generator(self):
        self.assertFalse(AlphaGenerator.is_generator("1", "2"))
        self.assertTrue(AlphaGenerator.is_generator("A", "B"))

    def test_get_index(self):
        gen = AlphaGenerator(GeneratorTypes.RANGE, ("A", "Z"), {}, "A-Z")
        self.assertEqual(0, gen.get_index("A"))
        self.assertEqual(25, gen.get_index("Z"))
        self.assertEqual(751, gen.get_index("ABX"))

    def test_generator(self):
        gen = AlphaGenerator(GeneratorTypes.RANGE, ("X", "AC"), {}, "X-AC")
        self.assertListEqual(["X", "Y", "Z", "AA", "AB", "AC"], list(islice(gen.generator(), 23, 29)))
