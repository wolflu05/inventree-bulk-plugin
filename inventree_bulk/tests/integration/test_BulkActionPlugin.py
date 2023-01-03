from django.test import TestCase

from ...models import validate_template


class BulkActionPluginTestCase(TestCase):
    def test_hello(self):
        with self.assertRaises(Exception):
            validate_template({})
        print("HELLO WORLD")
        pass
