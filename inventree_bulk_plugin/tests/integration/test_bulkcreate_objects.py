from django.test import RequestFactory, TestCase
from django.urls import reverse

from company.models import Company, ManufacturerPart, SupplierPart
from part.models import Part, PartCategory, PartParameterTemplate, PartParameter, PartAttachment
from stock.models import StockLocation, StockItem

from ...bulkcreate_objects import get_model, get_model_instance, FieldDefinition, BulkCreateObject, PartBulkCreateObject


# custom request factory, used to patch query_params which were not defined by default
class CustomRequestFactory(RequestFactory):
    def request(self, **request):
        r = super().request(**request)
        r.query_params = r.GET or r.POST
        return r


class BulkCreateObjectsUtilsTestCase(TestCase):
    def test_get_model(self):
        # no valid format
        self.assertIsNone(get_model("abc"))

        # not existing app
        self.assertIsNone(get_model("abc.def"))

        # not existing model
        self.assertIsNone(get_model("company.def"))

        # valid model
        self.assertEqual(get_model("company.company"), Company)

        # unstriped special casing string
        self.assertEqual(get_model("  cOmPaNy.CoMpAnY "), Company)

    def test_get_model_instance(self):
        supplier_company = Company.objects.create(name="Supplier company", is_supplier=True, is_customer=False)
        customer_company = Company.objects.create(name="Customer company", is_supplier=False, is_customer=True)

        # simple test
        self.assertEqual(get_model_instance(Company, supplier_company.pk), supplier_company)

        # test limit_choices with result
        self.assertEqual(get_model_instance(Company, supplier_company.pk, {"is_supplier": True}), supplier_company)

        # test limit_choices without result
        with self.assertRaisesRegex(ValueError, "Model 'company.company' where {'pk': " + str(customer_company.pk) + ", 'is_supplier': True} not found at XXX"):
            get_model_instance(Company, customer_company.pk, {"is_supplier": True}, "at XXX")


class FieldDefinitionTestCase(TestCase):
    def test_auto_typecasts(self):
        for field_type, cast_func in FieldDefinition.type_casts.items():
            field = FieldDefinition("A", field_type=field_type)
            self.assertEqual(field.cast_func, cast_func)

    def test_auto_get_model_class(self):
        # simple test with only model string
        field = FieldDefinition("A", field_type="model", model="company.company")
        self.assertEqual(field.model, ("company.company", {}, Company))

        # test with limit choices
        field = FieldDefinition("A", field_type="model", model=("company.company", {"is_supplier": True}))
        self.assertEqual(field.model, ("company.company", {"is_supplier": True}, Company))

        # test with not existing model
        with self.assertRaisesRegex(ValueError, "Model 'not.existing' not found."):
            field = FieldDefinition("A", field_type="model", model=("not.existing", {}))

        # test if tuple has len=3, it should touch anything to enable custom usage for fetching non models
        field = FieldDefinition("A", field_type="model", model=("not.existing", {}, None))
        self.assertEqual(field.model, ("not.existing", {}, None))

    def test_get_api_url(self):
        # no model set
        field = FieldDefinition("A")
        self.assertIsNone(field.get_api_url())

        # defined api url should take precedence
        field = FieldDefinition("A", model="company.company", api_url="abcdef")
        self.assertEqual(field.get_api_url(), "abcdef")

        # get api url from model class if available
        field = FieldDefinition("A", model="company.company")
        self.assertEqual(field.get_api_url(), Company.get_api_url())

        # get api url for hardcoded fields
        for model, url in [("auth.user", "api-user-list"), ("auth.group", "api-group-list")]:
            field = FieldDefinition("A", model=model)
            self.assertEqual(field.get_api_url(), reverse(url), f"url should match for {model}")


class BulkCreateObjectTestCase(TestCase):
    def setUp(self):
        self.request = CustomRequestFactory()

    def test_fields(self):
        test = self

        my_fields = {
            "a": FieldDefinition("A")
        }

        # simple fields
        class MyBulkCreateObject(BulkCreateObject):
            name = "My object"
            template_type = "MY_OBJECT"
            model = Company
            fields = my_fields

        my_obj = MyBulkCreateObject(self.request.get("/abc"))
        self.assertEqual(my_obj.fields, my_fields)

        # via get_fields
        class MyBulkCreateObject2(BulkCreateObject):
            name = "My object2"
            template_type = "MY_OBJECT2"
            model = Company

            def get_fields(self):
                test.assertEqual(self.request.path, "/abc")
                return {**my_fields, "b": FieldDefinition("B")}

        my_obj2 = MyBulkCreateObject2(self.request.get("/abc"))
        self.assertTrue("a" in my_obj2.fields)
        self.assertTrue("b" in my_obj2.fields)

    def test_create_object(self):
        class MyBulkCreateObject(BulkCreateObject):
            name = "part"
            template_type = "PART"
            generate_type = "single"
            model = Part
            fields = {
                "name": FieldDefinition("Name", required=True),
                "category": FieldDefinition("Category", field_type="model", model="part.PartCategory", description="If not set, defaults to current category"),
                "description": FieldDefinition("Description"),
            }

        category = PartCategory.objects.create(name="Test category")

        desc = "A very long description to work around the sample plugin limitation which is present in testing"
        my_obj = MyBulkCreateObject(self.request.get("/abc"))
        created_part = my_obj.create_object(({"name": "Test", "category": str(category.pk), "description": desc}, []))
        self.assertEqual(created_part.name, "Test")
        self.assertEqual(created_part.category, category)
        self.assertEqual(len(Part.objects.all()), 1)

    def test_create_objects_single(self):
        class MyBulkCreateObject(BulkCreateObject):
            name = "part"
            template_type = "PART"
            generate_type = "single"
            model = Part
            fields = {
                "name": FieldDefinition("Name", required=True),
                "description": FieldDefinition("Description"),
            }

        desc = "A very long description to work around the sample plugin limitation which is present in testing"
        my_obj = MyBulkCreateObject(self.request.get("/abc"))
        my_obj.get_context()  # used to init
        created_parts = my_obj.create_objects(
            [({"name": "1", "description": desc}, []), ({"name": "2", "description": desc}, [])])
        all_parts = list(Part.objects.all())
        self.assertEqual(len(created_parts), 2)
        self.assertEqual(len(all_parts), 2)

        expected = ["1", "2"]

        parts_list = list(map(lambda part: part.name, all_parts))
        self.assertListEqual(expected, parts_list)

    def test_create_objects_tree(self):
        class MyBulkCreateObject(BulkCreateObject):
            name = "part category"
            template_type = "PART_CATEGORY"
            model = PartCategory
            fields = {
                "name": FieldDefinition("Name", required=True),
            }

        parent_category = PartCategory.objects.create(name="Parent")
        my_obj = MyBulkCreateObject(self.request.get(f"/abc?parent_id={parent_category.pk}"))
        my_obj.get_context()  # used to init
        created_categories = my_obj.create_objects(
            [({"name": "Test"}, [({"name": "1"}, []), ({"name": "2"}, [({"name": "1"}, [])])])])
        all_categories = list(PartCategory.objects.all())
        self.assertEqual(len(created_categories), 4)
        self.assertEqual(len(all_categories), 5)

        expected = ["Parent", "Parent/Test", "Parent/Test/1", "Parent/Test/2", "Parent/Test/2/1"]

        path_list = list(map(lambda category: category.pathstring, all_categories))
        self.assertListEqual(expected, path_list)

    def test_get_context_tree(self):
        class MyBulkCreateObject(BulkCreateObject):
            name = "part category"
            template_type = "PART_CATEGORY"
            model = PartCategory
            fields = {
                "name": FieldDefinition("Name", required=True),
            }
        # without parent_id and not create => placeholder ctx for gen
        ctx = MyBulkCreateObject(self.request.get("/abc")).get_context()
        self.assertEqual(ctx, {'gen': {'name': "<parent 'Name'>"}})

        # without parent_id but with create
        with self.assertRaisesRegex(ValueError, "parent_id query parameter missing"):
            MyBulkCreateObject(self.request.get("/abc?create=True")).get_context()

        # with not existing parent_id
        with self.assertRaisesRegex(ValueError, "object with id '999999' cannot be found"):
            MyBulkCreateObject(self.request.get("/abc?parent_id=999999")).get_context()

        # with existing parent_id
        parent_category = PartCategory.objects.create(name="Parent")
        obj = MyBulkCreateObject(self.request.get(f"/abc?parent_id={parent_category.pk}"))
        ctx = obj.get_context()
        self.assertEqual(ctx, {'gen': {'name': 'Parent'}})
        self.assertEqual(obj.parent, parent_category)


class PartBulkCreateObjectTestCase(TestCase):
    def setUp(self):
        self.request = CustomRequestFactory()

    def test_create_objects(self):
        parameter_template = PartParameterTemplate.objects.create(name="Test", units="kg", description="Test template")
        supplier_company = Company.objects.create(name="Supplier", is_supplier=True)
        manufacturer_company = Company.objects.create(name="Supplier", is_supplier=False, is_manufacturer=True)
        stock_location = StockLocation.objects.create(name="Test location")
        category = PartCategory.objects.create(name="Test category")

        base_data = {
            "image": "https://raw.githubusercontent.com/test-images/png/main/202105/cs-black-000.png",
            "attachment": [
                {
                    "comment": "Test attachment 1",
                    "file_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                    "file_name": "ABC.pdf",
                },
                {
                    "comment": "Test attachment 2",
                    "link": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                },
                {
                    "comment": "Test attachment 3",
                    "file_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                },
            ],
            "parameters": [
                {"template": str(parameter_template.pk), "value": "100"},
            ],
            "supplier": {
                "supplier": str(supplier_company.pk),
                "SKU": "ABC-01",
                "_make_default": True
            },
            "manufacturer": {
                "manufacturer": str(manufacturer_company.pk),
                "MPN": "DEF-02"
            },
            "stock": {
                "quantity": 1.0,
                "location": str(stock_location.pk),
            },
        }

        data = [
            ({"name": "Test 1", "description": "Test 1 description", **base_data}, []),
        ]

        obj = PartBulkCreateObject(self.request.get(f"/abc?parent_id={category.pk}"))
        obj.get_context()
        obj.create_objects(data)

        expected_objs = [
            (Part, 1),
            (PartParameter, 1),
            (ManufacturerPart, 1),
            (SupplierPart, 1),
            (StockItem, 1),
            (PartAttachment, 3)
        ]

        for model, count in expected_objs:
            c = len(model.objects.all())
            self.assertEqual(c, count, f"There should be only {count} of {model}, found {c}")

    def test_get_context(self):
        # test without category id
        obj = PartBulkCreateObject(self.request.get("/abc"))
        ctx = obj.get_context()
        self.assertEqual(ctx, {})

        # test with invalid category id
        obj = PartBulkCreateObject(self.request.get("/abc?parent_id=999999"))
        with self.assertRaisesRegex(ValueError, "category with id '999999' cannot be found"):
            obj.get_context()

        # test with category id
        category = PartCategory.objects.create(name="Test category 123")
        obj = PartBulkCreateObject(self.request.get(f"/abc?parent_id={category.pk}"))
        ctx = obj.get_context()
        self.assertTrue("category" in ctx)
        self.assertEqual(ctx["category"]["name"], "Test category 123")
