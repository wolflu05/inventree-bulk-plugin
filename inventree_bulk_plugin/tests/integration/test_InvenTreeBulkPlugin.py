import json

from django.test import TestCase
from django.core.exceptions import ValidationError

from plugin import registry
from stock.views import StockLocationDetail
from part.views import CategoryDetail

from ...models import validate_template
from ...InvenTreeBulkPlugin import InvenTreeBulkPlugin, validate_json
from ...version import BULK_PLUGIN_VERSION


class InvenTreeBulkPluginModelTestCase(TestCase):
    def test_validate_template(self):
        with self.assertRaisesRegex(ValidationError, "validation errors for BulkDefinitionSchema"):
            validate_template("{}")

        with self.assertRaisesRegex(ValidationError, "template is no valid json format"):
            validate_template("no json structure")

        with self.assertRaisesRegex(ValueError, f"The server runs on v{BULK_PLUGIN_VERSION} which is incompatible to v999.9.9."):
            schema = json.dumps({
                "version": "999.9.9",
                "input": {},
                "templates": [],
                "output": {}
            })
            validate_template(schema)

        valid_schema = json.dumps({
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "generate": {
                    "name": "Test",
                    "description": "Test description"
                },
            }
        })
        self.assertJSONEqual(valid_schema, validate_template(valid_schema))


class InvenTreeBulkPluginTestCase(TestCase):
    def test_get_custom_panels(self):
        bulk_plugin: InvenTreeBulkPlugin = registry.get_plugin("inventree-bulk-plugin")

        def assert_contains_by_title(title, panels):
            found = None
            for panel in panels:
                if panel["title"] == title:
                    found: dict = panel
            self.assertIsNotNone(found)
            self.assertListEqual(["title", "icon", "content", "description"], list(found.keys()))

        panels = bulk_plugin.get_custom_panels(StockLocationDetail(), None)
        assert_contains_by_title("Location bulk creation", panels)

        panels = bulk_plugin.get_custom_panels(CategoryDetail(), None)
        assert_contains_by_title("Category bulk creation", panels)
        assert_contains_by_title("Part bulk creation", panels)

    def test_validate_json(self):
        valid_json = '{"ts": 13}'
        not_valid_json = '{"ts""13"}'

        # no error, should pass validator
        validate_json(valid_json)

        # should throw an error
        with self.assertRaises(ValidationError):
            validate_json(not_valid_json)
