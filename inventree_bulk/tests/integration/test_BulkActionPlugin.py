from django.urls import reverse
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from plugin import registry

from ...models import validate_template
# from ...BulkActionPlugin import BulkActionPlugin


class BulkActionPluginTestCase(TestCase):
    def test_hello(self):
        with self.assertRaises(Exception):
            validate_template({})


class BulkActionPluginAPITestCase(APITestCase):
    @override_settings(PLUGIN_TESTING_SETUP=True)
    def test_url_parse(self):
        print("PLUGIN_BEFORE_RELOAD=", registry.get_plugin("bulkaction"))
        registry.reload_plugins(True)

        from django.conf import settings
        for k in ["PLUGIN_TESTING_SETUP", "TESTING_ENV", "PLUGIN_TESTING"]:
            print(f"{k}={getattr(settings, k, ' - Not Defined - ')}")
        print("PLUGIN=", registry.get_plugin("bulkaction"))

        from django import urls
        url_resolver = urls.get_resolver(urls.get_urlconf())
        print(url_resolver.namespace_dict.keys())
        print(url_resolver.namespace_dict["plugin"][1].namespace_dict.keys())
        url = reverse("plugin:bulkaction:parse")
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
