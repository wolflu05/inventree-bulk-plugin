import json

from django.urls import reverse
from django.test import TestCase, override_settings
from django.core.exceptions import ValidationError

from InvenTree.api_tester import InvenTreeAPITestCase
from plugin import registry
from stock.models import StockLocation
from part.models import PartCategory
from stock.views import StockLocationDetail, StockIndex
from part.views import CategoryDetail

from ...models import validate_template
from ...BulkGenerator.BulkGenerator import BulkGenerator
from ...BulkActionPlugin import BulkActionPlugin


class BulkActionPluginModelTestCase(TestCase):
    def test_validate_template(self):
        with self.assertRaisesRegex(ValidationError, "validation errors for BulkDefinitionSchema"):
            validate_template("{}")

        with self.assertRaisesRegex(ValidationError, "template is no valid json format"):
            validate_template("no json structure")

        valid_schema = json.dumps({
            "version": "0.1.0",
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


@override_settings(PLUGIN_TESTING_SETUP=True)
class BulkActionPluginAPITestCase(InvenTreeAPITestCase):
    def setUp(self):
        registry.reload_plugins(True)
        super().setUp()

        self.complex_valid_generation_template = {
            "version": "0.1.0",
            "input": {},
            "templates": [],
            "output": {
                "dimensions": ["NUMERIC"],
                "count": [5],
                "generate": {
                    "name": "N{dim.1}",
                            "description": "D{dim.1}"
                },
                "childs": [
                    {
                        "dimensions": ["ALPHA_LOWER"],
                        "count": [2],
                        "generate": {
                            "name": "CN{dim.1}",
                                    "description": "CD{dim.1}"
                        },
                        "childs": [
                            {"generate": {"name": "Name", "description": "Description"}}
                        ]
                    }
                ]
            }
        }

    def test_get_custom_panels(self):
        bulk_plugin: BulkActionPlugin = registry.get_plugin("bulkaction")

        def assert_contains_by_title(title, panels):
            found = None
            for panel in panels:
                if panel["title"] == title:
                    found: dict = panel
            self.assertIsNotNone(found)
            self.assertListEqual(["title", "icon", "content_template",
                                 "javascript_template", "description"], list(found.keys()))

        panels = bulk_plugin.get_custom_panels(StockIndex(), None)
        assert_contains_by_title("Manage bulk creation", panels)

        panels = bulk_plugin.get_custom_panels(StockLocationDetail(), None)
        assert_contains_by_title("Bulk creation", panels)

        panels = bulk_plugin.get_custom_panels(CategoryDetail(), None)
        assert_contains_by_title("Bulk creation", panels)

    def test_url_parse(self):
        url = reverse("plugin:bulkaction:parse")

        # There should be only one item generated
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

        response = self.post(url, data, expected_code=200)
        self.assertJSONEqual(response.content, [[{"name": "Test", "description": "Test description"}, []]])

        # There should be a 400 on invalid user input - invalid schema
        data = {
            "no_valid_key": "hello world"
        }
        response = self.post(url, data, expected_code=400)

        # There should be a 400 on invalid user input - invalid generation template
        data = {
            "version": "0.1.0",
            "input": {},
            "templates": [],
            "output": {
                "generate": {
                    "name": "{not.existing.context}",
                },
            }
        }
        response = self.post(url, data, expected_code=400)

        # There should be a 400 on invalid user input - invalid json syntax
        response = self.post(url, "no json structure", expected_code=400)

    def test_url_bulk_create(self):
        objects = [("location", StockLocation), ("category", PartCategory)]
        for object_type_name, object_class in objects:
            with self.subTest(object_type_name=object_type_name):
                def url(pk):
                    return reverse(f"plugin:bulkaction:bulkcreate{object_type_name}", kwargs={"pk": pk})

                # wrong schema should produce an error
                self.post(url(0), {"no valid data": "should produce error"}, expected_code=400)

                # no existing parent
                all_objects = list(object_class.objects.all())
                self.assertEqual(0, len(all_objects))
                self.post(url(0), self.complex_valid_generation_template, expected_code=404)

                # with existing parent
                parent = object_class.objects.create(name="Parent", description="Parent description", parent=None)
                self.post(url(parent.pk), self.complex_valid_generation_template, expected_code=201)

                all_objects = list(object_class.objects.all())
                self.assertEqual(26, len(all_objects))

    def test__bulk_create(self):
        items = BulkGenerator(self.complex_valid_generation_template).generate()
        bulk_plugin: BulkActionPlugin = registry.get_plugin("bulkaction")

        parent = StockLocation.objects.create(name="Parent", description="Parent description", parent=None)
        bulk_plugin._bulk_create(StockLocation, parent, items, ["name", "description"])

        expected = ['Parent', 'Parent/N1', 'Parent/N1/CNa', 'Parent/N1/CNa/Name', 'Parent/N1/CNb', 'Parent/N1/CNb/Name', 'Parent/N2', 'Parent/N2/CNa', 'Parent/N2/CNa/Name', 'Parent/N2/CNb', 'Parent/N2/CNb/Name', 'Parent/N3', 'Parent/N3/CNa',
                    'Parent/N3/CNa/Name', 'Parent/N3/CNb', 'Parent/N3/CNb/Name', 'Parent/N4', 'Parent/N4/CNa', 'Parent/N4/CNa/Name', 'Parent/N4/CNb', 'Parent/N4/CNb/Name', 'Parent/N5', 'Parent/N5/CNa', 'Parent/N5/CNa/Name', 'Parent/N5/CNb', 'Parent/N5/CNb/Name']

        path_list = list(map(lambda location: location.pathstring, StockLocation.objects.all()))
        self.assertListEqual(expected, path_list)
