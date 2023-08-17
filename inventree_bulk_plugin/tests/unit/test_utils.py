import unittest

from ...BulkGenerator.utils import version_tuple, str2bool, str2int


class UtilsTestCase(unittest.TestCase):
    def test_version_tuple(self):
        cases = [
            ("1.1.1", (1, 1, 1)),
            ("1.2.3", (1, 2, 3))
        ]

        for case, expected in cases:
            with self.subTest(case):
                self.assertEqual(version_tuple(case), expected)

    def test_str2bool(self):
        truthy = ['1', 'y', 'yes', 't', 'true', 'ok', 'on']
        falsy = ["any", "other", "word", "false", "", "0", "n", "no", "f", "off"]

        for t in truthy:
            self.assertTrue(str2bool(t), f"'{t}' should be True")
        for f in falsy:
            self.assertFalse(str2bool(f), f"'{f}' should be False")

    def test_str2int(self):
        self.assertEqual(42, str2int("42"))
        self.assertEqual(None, str2int("abc"))
        self.assertEqual(13, str2int("abc", 13))
