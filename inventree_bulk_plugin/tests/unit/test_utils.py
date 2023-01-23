import unittest

from ...BulkGenerator.utils import version_tuple


class UtilsTestCase(unittest.TestCase):
    def test_version_tuple(self):
        cases = [
            ("1.1.1", (1, 1, 1)),
            ("1.2.3", (1, 2, 3))
        ]

        for case, expected in cases:
            with self.subTest(case):
                self.assertEqual(version_tuple(case), expected)
