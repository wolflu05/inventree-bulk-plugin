import json

from django.urls import reverse

from InvenTree.unit_test import InvenTreeAPITestCase
from stock.models import StockLocation
from part.models import PartCategory, PartParameterTemplate, PartCategoryParameterTemplate

from ...models import BulkCreationTemplate


class InvenTreeBulkPluginAPITestCase(InvenTreeAPITestCase):
    def setUp(self):
        super().setUp()

        self.simple_valid_generation_template = {
            "name": "Test template",
            "template_type": "STOCK_LOCATION",
            "template": {
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "generate": {
                        "name": "Test",
                        "description": "Test description"
                    },
                }
            },
        }
        self.simple_valid_generation_template_json = json.dumps(self.simple_valid_generation_template)

        self.complex_valid_generation_template = {
            "name": "Complex test template",
            "template_type": "STOCK_LOCATION",
            "template": {
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
            },
        }

    def test_url_bulkcreate_info(self):
        url = reverse("plugin:inventree-bulk-plugin:api-bulk-create")

        # Test template_type advertisement
        response = self.get(url, expected_code=200).json()

        template_types = []
        for generate_info in response:
            template_types += [generate_info["template_type"]]
            self.assertTrue("name" in generate_info)
            self.assertTrue("template_type" in generate_info)
            self.assertTrue("generate_type" in generate_info)

        self.assertTrue("STOCK_LOCATION" in template_types)
        self.assertTrue("PART_CATEGORY" in template_types)
        self.assertTrue("PART" in template_types)

    def test_url_bulkcreate_info_detail(self):
        url = reverse("plugin:inventree-bulk-plugin:api-bulk-create")

        self.get(url + "?template_type=NOT_EXISTING_TEMPLATE_TYPE", expected_code=400)

        # normal detail
        response = self.get(url + "?template_type=PART", expected_code=200).json()
        self.assertTrue("name" in response)
        self.assertTrue("template_type" in response)
        self.assertEqual(response["template_type"], "PART")
        self.assertTrue("generate_type" in response)
        self.assertTrue("fields" in response)

        # detail with parent id set but without defined part category parameter templates
        category = PartCategory.objects.create(name="Test category")

        response = self.get(url + f"?template_type=PART&parent_id={category.pk}", expected_code=200).json()
        self.assertEqual(response["fields"]["parameters"]["default"], [
            {"template": "", "value": ""},
        ])

        # detail with parent id set and with defined part category parameter templates
        part_parameter_template1 = PartParameterTemplate.objects.create(name="Length", units="m")
        part_parameter_template2 = PartParameterTemplate.objects.create(name="Weight per meter", units="kg/m")
        PartCategoryParameterTemplate.objects.create(category=category, parameter_template=part_parameter_template1)
        PartCategoryParameterTemplate.objects.create(
            category=category, parameter_template=part_parameter_template2, default_value="10")

        response = self.get(url + f"?template_type=PART&parent_id={category.pk}", expected_code=200).json()
        self.assertEqual(response["fields"]["parameters"]["default"], [
            {"template": str(part_parameter_template1.pk), "value": ""},
            {"template": str(part_parameter_template2.pk), "value": "10"},
        ])

    def test_url_bulkcreate_preview(self):
        url = reverse("plugin:inventree-bulk-plugin:api-bulk-create")

        # There should be only one item generated
        data = self.simple_valid_generation_template

        response = self.post(url, data, expected_code=200)
        self.assertJSONEqual(response.content, [[{"name": "Test", "description": "Test description"}, []]])

        # There should be a 400 on invalid user input - invalid schema
        data = {
            "template_type": "STOCK_LOCATION",
            "template": {
                "no_valid_key": "hello world"
            }
        }
        response = self.post(url, data, expected_code=400)

        # There should be a 400 on invalid user input - invalid generation template
        data = {
            "template_type": "STOCK_LOCATION",
            "template": {
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "generate": {
                        "name": "{{not.existing.context}}",
                    },
                },
            },
        }
        response = self.post(url, data, expected_code=400)

        # There should be a 400 on invalid template type
        data = {
            "template_type": "NOT_EXISTING_TEMPLATE_TYPE",
            "template": {},
        }
        response = self.post(url, data, expected_code=400)

        # There should be a 400 if no schema template is provided
        data = {
            "template_type": "STOCK_LOCATION",
        }
        response = self.post(url, data, expected_code=400)

        # If the schema template is a string, it should work too
        data = {
            "template_type": "STOCK_LOCATION",
            "template": json.dumps({
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "generate": {
                        "name": "AAA",
                    },
                },
            }),
        }
        response = self.post(url, data, expected_code=200)
        self.assertJSONEqual(response.content, [[{"name": "AAA"}, []]])

        # If template_type is provided and no parent_id, everything should work and placeholders should be used
        data = {
            "template_type": "STOCK_LOCATION",
            "template": {
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "generate": {
                        "name": "{{par.gen.name}}",
                    },
                },
            },
        }
        response = self.post(url, data, expected_code=200)
        self.assertJSONEqual(response.content, [[{"name": "<parent 'Name'>"}, []]])

        # If template_type is provided and parent_id does not exist, it should raise an error
        data = {
            "template_type": "STOCK_LOCATION",
            "template": {
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "generate": {
                        "name": "{{par.gen.name}}",
                    },
                },
            },
        }
        response = self.post(url + "?parent_id=99999", data, expected_code=400)

        # If template_type is provided and parent_id, everything should work and parent context should be used
        parent = StockLocation.objects.create(name="Parent 13", description="Parent description", parent=None)
        data = {
            "template_type": "STOCK_LOCATION",
            "template": {
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "generate": {
                        "name": "{{par.gen.name}}",
                    },
                },
            },
        }
        response = self.post(url + f"?parent_id={parent.pk}", data, expected_code=200)
        self.assertJSONEqual(response.content, [[{"name": "Parent 13"}, []]])

    def test_url_bulkcreate_create(self):
        url = reverse("plugin:inventree-bulk-plugin:api-bulk-create")

        # If template_type is provided and no parent_id, everything should work and placeholders should be used
        data = {
            "template_type": "STOCK_LOCATION",
            "template": {
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "generate": {
                        "name": "{{par.gen.name}}",
                    },
                },
            },
        }
        # parent id not provided and create should throw status 400
        response = self.post(url + "?create=true", data, expected_code=400)

        # parent id and create should work
        parent = StockLocation.objects.create(name="Parent 13", description="Parent description", parent=None)
        data = {
            "template_type": "STOCK_LOCATION",
            "template": {
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {
                    "generate": {
                        "name": "Generated {{par.gen.name}}",
                    },
                },
            },
        }
        response = self.post(url + f"?parent_id={parent.pk}&create=true", data, expected_code=201).json()
        self.assertEqual(len(response), 1)
        obj = StockLocation.objects.get(pk=response[0])
        self.assertEqual(obj.name, "Generated Parent 13")

        # with existing parent
        StockLocation.objects.all().delete()
        parent = StockLocation.objects.create(name="Parent", description="Parent description", parent=None)
        self.post(url + f"?parent_id={parent.pk}&create=true",
                  self.complex_valid_generation_template, expected_code=201)

        all_objects = list(StockLocation.objects.all())
        self.assertEqual(26, len(all_objects))

        expected = ['Parent', 'Parent/N1', 'Parent/N1/CNa', 'Parent/N1/CNa/Name', 'Parent/N1/CNb', 'Parent/N1/CNb/Name', 'Parent/N2', 'Parent/N2/CNa', 'Parent/N2/CNa/Name', 'Parent/N2/CNb', 'Parent/N2/CNb/Name', 'Parent/N3', 'Parent/N3/CNa',
                    'Parent/N3/CNa/Name', 'Parent/N3/CNb', 'Parent/N3/CNb/Name', 'Parent/N4', 'Parent/N4/CNa', 'Parent/N4/CNa/Name', 'Parent/N4/CNb', 'Parent/N4/CNb/Name', 'Parent/N5', 'Parent/N5/CNa', 'Parent/N5/CNa/Name', 'Parent/N5/CNb', 'Parent/N5/CNb/Name']

        path_list = list(map(lambda location: location.pathstring, all_objects))
        self.assertListEqual(expected, path_list)

        # generation without name should raise an error
        schema = {
            "template_type": "STOCK_LOCATION",
            "template": {
                "version": "1.0.0",
                "input": {},
                "templates": [],
                "output": {"generate": {"description": "Test description"}}
            }
        }
        response = self.post(url + f"?parent_id={parent.pk}&create=true", schema, expected_code=400)
        self.assertEqual({"error": "'name' are missing in generated keys."}, response.json())

    def _template_url(self, pk=None):
        if pk:
            return reverse("plugin:inventree-bulk-plugin:api-detail-templates", kwargs={"pk": pk})
        else:
            return reverse("plugin:inventree-bulk-plugin:api-list-templates")

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
        self.assertDictContainsSubset({'id': template2.pk, 'name': 'Stock template', 'template_type': 'STOCK_LOCATION',
                                       'template': self.simple_valid_generation_template_json}, response)

        # try getting by not existing pk
        response = self.get(self._template_url(42), expected_code=404)

    def test_url_template_post(self):
        # create valid template
        create_template = self.post(self._template_url(), {
                                    "name": "Post - testing template", "template_type": "STOCK_LOCATION", "template": json.dumps(self.simple_valid_generation_template["template"])}, expected_code=201).json()
        created_object = BulkCreationTemplate.objects.get(pk=create_template['id'])
        for key in ["id", "name", "template_type", "template"]:
            self.assertEqual(getattr(created_object, key), create_template[key])

        # create invalid template
        self.post(self._template_url(), {"novalidkey": "value"}, expected_code=400)

    def test_url_template_put_patch(self):
        template = BulkCreationTemplate.objects.create(name="Stock template put test", template_type="STOCK_LOCATION",
                                                       template=json.dumps(self.simple_valid_generation_template["template"]))

        # test update with no pk
        self.patch(self._template_url(), {"name": "test"}, expected_code=405)

        # test update with invalid pk
        self.patch(self._template_url(42), {"name": "test"}, expected_code=404)

        # test update with valid pk
        updated_template = self.patch(self._template_url(template.pk), {
                                      'name': "updated name"}, expected_code=200).json()
        self.assertEqual("updated name", updated_template['name'])
        self.assertEqual("updated name", BulkCreationTemplate.objects.get(pk=template.pk).name)

        # test put update with valid pk
        updated_template = self.patch(self._template_url(template.pk), {
                                      **updated_template, 'name': "updated name 2"}, expected_code=200).json()
        self.assertEqual("updated name 2", updated_template['name'])
        self.assertEqual("updated name 2", BulkCreationTemplate.objects.get(pk=template.pk).name)

        # test update with valid pk and no valid data
        updated_template = self.patch(self._template_url(template.pk), {'template': {
            "no valid bulk": "generation template"}}, expected_code=400).json()

        # assert that id cannot be changed
        updated_template = self.patch(self._template_url(template.pk), {'id': 42}, expected_code=200).json()
        self.assertEqual(template.pk, updated_template['id'])

    def test_url_template_delete(self):
        template = BulkCreationTemplate.objects.create(name="Stock template put test", template_type="STOCK_LOCATION",
                                                       template=self.simple_valid_generation_template_json)

        # test delete with no valid pk
        self.delete(self._template_url(42), expected_code=404)

        # test delete with valid pk
        self.delete(self._template_url(template.pk), expected_code=204)
        with self.assertRaises(BulkCreationTemplate.DoesNotExist):
            BulkCreationTemplate.objects.get(pk=template.pk)
