from django.urls import reverse
from django.test import TestCase
from rest_framework.test import APITestCase

from plugin import registry

from ...models import validate_template
# from ...BulkActionPlugin import BulkActionPlugin


class BulkActionPluginTestCase(TestCase):
    def test_hello(self):
        with self.assertRaises(Exception):
            validate_template({})


class BulkActionPluginAPITestCase(APITestCase):
    def test_url_parse(self):
        print(registry.plugins)
        print(registry.plugins_full)
        print(registry.get_plugin('bulkaction'))
        with self.assertRaises(Exception):
            url = reverse("bulkaction:parse")
            data = {
                "version": "0.1.0",
                "input": {},
                "templates": [],
                "output": {
                    "generate": {
                        "name": "Test",
                        "description": "Test description"
                    },
                }
            }
            response = self.client.post(url, data, format="json")
            print(response)
        pass
