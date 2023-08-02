import json

from django.urls import reverse
from django.test import TestCase
from django.core.exceptions import ValidationError

from InvenTree.unit_test import InvenTreeAPITestCase
from plugin import registry
from stock.models import StockLocation
from part.models import PartCategory
from stock.views import StockLocationDetail, StockIndex
from part.views import CategoryDetail

from ...models import validate_template, BulkCreationTemplate
from ...BulkGenerator.BulkGenerator import BulkGenerator
from ...InvenTreeBulkPlugin import InvenTreeBulkPlugin
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


class InvenTreeBulkPluginAPITestCase(InvenTreeAPITestCase):
    def setUp(self):
        super().setUp()

        self.simple_valid_generation_template = {
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "generate": {
                    "name": "Test",
                    "description": "Test description"
                },
            }
        }
        self.simple_valid_generation_template_json = json.dumps(self.simple_valid_generation_template)

        self.complex_valid_generation_template = {
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "dimensions": ["*NUMERIC"],
                "count": [5],
                "generate": {
                    "name": "N{{dim.1}}",
                            "description": "D{{dim.1}}"
                },
                "childs": [
                    {
                        "dimensions": ["*ALPHA(casing=lower)"],
                        "count": [2],
                        "generate": {
                            "name": "CN{{dim.1}}",
                                    "description": "CD{{dim.1}}"
                        },
                        "childs": [
                            {"generate": {"name": "Name", "description": "Description"}}
                        ]
                    }
                ]
            }
        }

    def test_get_custom_panels(self):
        bulk_plugin: InvenTreeBulkPlugin = registry.get_plugin("inventree-bulk-plugin")

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
        url = reverse("plugin:inventree-bulk-plugin:parse")

        # There should be only one item generated
        data = self.simple_valid_generation_template

        response = self.post(url, data, expected_code=200)
        self.assertJSONEqual(response.content, [[{"name": "Test", "description": "Test description"}, []]])

        # There should be a 400 on invalid user input - invalid schema
        data = {
            "no_valid_key": "hello world"
        }
        response = self.post(url, data, expected_code=400)

        # There should be a 400 on invalid user input - invalid generation template
        data = {
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "generate": {
                    "name": "{{not.existing.context}}",
                },
            }
        }
        response = self.post(url, data, expected_code=400)

        # There should be a 400 on invalid user input - invalid json syntax
        response = self.post(url, "no json structure", expected_code=400)

        # If template_type is provided, but does not exist, expect status code 400
        response = self.post(url + "?template_type=NOT_EXISTING_TYPE", expected_code=400)

        # If template_type is provided and exists, everything should work
        data = {
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "generate": {
                    "name": "AAA",
                },
            }
        }
        response = self.post(url + "?template_type=STOCK_LOCATION", data, expected_code=200)

        # Test template_type advertisement
        response = self.options(url, expected_code=200).json()
        self.assertTrue("STOCK_LOCATION" in response)
        self.assertTrue("PART_CATEGORY" in response)

    def test_url_bulk_create(self):
        objects = [("location", StockLocation), ("category", PartCategory)]
        for object_type_name, object_class in objects:
            with self.subTest(object_type_name=object_type_name):
                def url(pk):
                    return reverse(f"plugin:inventree-bulk-plugin:bulkcreate{object_type_name}", kwargs={"pk": pk})

                # no existing parent
                all_objects = list(object_class.objects.all())
                self.assertEqual(0, len(all_objects))
                self.post(url(0), self.complex_valid_generation_template, expected_code=404)

                # with existing parent
                parent = object_class.objects.create(name="Parent", description="Parent description", parent=None)
                self.post(url(parent.pk), self.complex_valid_generation_template, expected_code=201)

                all_objects = list(object_class.objects.all())
                self.assertEqual(26, len(all_objects))

                # existing parent, wrong schema should produce an error
                self.post(url(parent.pk), {"no valid data": "should produce error"}, expected_code=400)

                # generation without name should raise an error
                schema = {
                    "version": "1.0.0",
                    "input": {},
                    "templates": [],
                    "output": {"generate": {"description": "Test description"}}
                }
                response = self.post(url(parent.pk), schema, expected_code=400)
                self.assertEqual({"error": "'name' is missing in generated keys"}, response.json())

    def test__bulk_create(self):
        items = BulkGenerator(self.complex_valid_generation_template).generate()
        bulk_plugin: InvenTreeBulkPlugin = registry.get_plugin("inventree-bulk-plugin")

        parent = StockLocation.objects.create(name="Parent", description="Parent description", parent=None)
        bulk_plugin._bulk_create(StockLocation, parent, items, ["name", "description"])

        expected = ['Parent', 'Parent/N1', 'Parent/N1/CNa', 'Parent/N1/CNa/Name', 'Parent/N1/CNb', 'Parent/N1/CNb/Name', 'Parent/N2', 'Parent/N2/CNa', 'Parent/N2/CNa/Name', 'Parent/N2/CNb', 'Parent/N2/CNb/Name', 'Parent/N3', 'Parent/N3/CNa',
                    'Parent/N3/CNa/Name', 'Parent/N3/CNb', 'Parent/N3/CNb/Name', 'Parent/N4', 'Parent/N4/CNa', 'Parent/N4/CNa/Name', 'Parent/N4/CNb', 'Parent/N4/CNb/Name', 'Parent/N5', 'Parent/N5/CNa', 'Parent/N5/CNa/Name', 'Parent/N5/CNb', 'Parent/N5/CNb/Name']

        path_list = list(map(lambda location: location.pathstring, StockLocation.objects.all()))
        self.assertListEqual(expected, path_list)

    def _template_url(self, pk=None):
        if pk:
            return reverse("plugin:inventree-bulk-plugin:templatebyid", kwargs={"pk": pk})
        else:
            return reverse("plugin:inventree-bulk-plugin:templates")

    def test_url_template_get(self):
        BulkCreationTemplate.objects.create(name="Complex Stock template", template_type="STOCK_LOCATION",
                                            template=json.dumps(self.complex_valid_generation_template))
        template2 = BulkCreationTemplate.objects.create(name="Stock template", template_type="STOCK_LOCATION",
                                                        template=self.simple_valid_generation_template_json)
        BulkCreationTemplate.objects.create(
            name="Category template", template_type="PART_CATEGORY", template=self.simple_valid_generation_template_json)

        # try getting all 3 templates
        response = self.get(self._template_url(), expected_code=200).json()
        self.assertEqual(3, len(response))

        # try getting only STOCK_LOCATION templates
        response = self.get(self._template_url() + "?template_type=STOCK_LOCATION", expected_code=200).json()
        self.assertEqual(2, len(response))
        for template in response:
            self.assertEqual("STOCK_LOCATION", template["template_type"])

        # try getting by pk
        response = self.get(self._template_url(template2.pk), expected_code=200).json()
        self.assertDictEqual({'id': template2.pk, 'name': 'Stock template', 'template_type': 'STOCK_LOCATION',
                             'template': self.simple_valid_generation_template_json}, response)

        # try getting by not existing pk
        response = self.get(self._template_url(42), expected_code=404)

    def test_url_template_post(self):
        # create valid template
        create_template = self.post(self._template_url(), {
                                    "name": "Post - testing template", "template_type": "STOCK_LOCATION", "template": self.simple_valid_generation_template_json}, expected_code=200).json()
        created_object = BulkCreationTemplate.objects.get(pk=create_template['id'])
        for key in ["id", "name", "template_type", "template"]:
            self.assertEqual(getattr(created_object, key), create_template[key])

        # create invalid template
        self.post(self._template_url(), {"novalidkey": "value"}, expected_code=400)

    def test_url_template_put(self):
        template = BulkCreationTemplate.objects.create(name="Stock template put test", template_type="STOCK_LOCATION",
                                                       template=self.simple_valid_generation_template_json)

        # test update with no pk
        self.put(self._template_url(), {"name": "test"}, expected_code=404)

        # test update with invalid pk
        self.put(self._template_url(42), {"name": "test"}, expected_code=404)

        # test update with valid pk
        updated_template = self.put(self._template_url(template.pk), {'name': "updated name"}, expected_code=200).json()
        self.assertEqual("updated name", updated_template['name'])
        self.assertEqual("updated name", BulkCreationTemplate.objects.get(pk=template.pk).name)

        # test update with valid pk and no valid data
        updated_template = self.put(self._template_url(template.pk), {'template': {
                                    "no valid bulk": "generation template"}}, expected_code=400).json()

        # assert that id cannot be changed
        updated_template = self.put(self._template_url(template.pk), {'id': 42}, expected_code=200).json()
        self.assertEqual(template.pk, updated_template['id'])

    def test_url_template_delete(self):
        template = BulkCreationTemplate.objects.create(name="Stock template put test", template_type="STOCK_LOCATION",
                                                       template=self.simple_valid_generation_template_json)

        # test delete with no valid pk
        self.delete(self._template_url(42), expected_code=404)

        # test delete with valid pk
        self.delete(self._template_url(template.pk), expected_code=201)
        with self.assertRaises(BulkCreationTemplate.DoesNotExist):
            BulkCreationTemplate.objects.get(pk=template.pk)

    def test_url_template_invalid_method(self):
        template = BulkCreationTemplate.objects.create(name="Stock template put test", template_type="STOCK_LOCATION",
                                                       template=self.simple_valid_generation_template_json)
        self.patch(self._template_url(template.pk), {}, expected_code=404)
