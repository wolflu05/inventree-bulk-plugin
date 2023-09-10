from django.test import RequestFactory, TestCase
from django.urls import reverse

from company.models import Company

from ...bulkcreate_objects import get_model, get_model_instance, FieldDefinition, BulkCreateObject


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
        supplier_company = Company.objects.create(name="Supplier company", is_supplier=True)
        customer_company = Company.objects.create(name="Customer company", is_customer=True)

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
        self.request = RequestFactory()

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
