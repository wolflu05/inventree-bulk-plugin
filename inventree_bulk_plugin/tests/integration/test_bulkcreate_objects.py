import json
from typing import Type
from django.test import RequestFactory, TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from django.core.exceptions import FieldDoesNotExist
from django.db.models import Model, IntegerField, DecimalField, FloatField, BooleanField
from mptt.models import MPTTModel

from company.models import Company, ManufacturerPart, SupplierPart
from part.models import Part, PartCategory, PartParameterTemplate, PartParameter, PartAttachment, PartRelated
from stock.models import StockLocation, StockItem
from common.models import InvenTreeSetting

from ...bulkcreate_objects import get_model, get_model_instance, cast_model, cast_select, FieldDefinition, BulkCreateObject, StockLocationBulkCreateObject, PartCategoryBulkCreateObject, PartBulkCreateObject


# custom request factory, used to patch query_params which were not defined by default
class CustomRequestFactory(RequestFactory):
    def request(self, **request):
        data = request.pop("data", {})
        r = super().request(**request)
        r.query_params = r.GET or r.POST
        r.data = data
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

        # test with an already passed model
        self.assertEqual(get_model_instance(Company, supplier_company, {"is_supplier": True}), supplier_company)

        # test with allow_multiple
        self.assertCountEqual(list(get_model_instance(Company, '{"name__endswith": "company"}', {}, allow_multiple=True)), [
            supplier_company, customer_company])

        # test with invalid filter
        with self.assertRaisesRegex(ValueError, "Cannot parse json query string at XXX"):
            get_model_instance(Company, '{"a""b"}', {}, "at XXX")

        # test without allow_multiple
        with self.assertRaisesRegex(ValueError, "Model 'company.company' where {'name__endswith': 'company'} returned multiple models at XXX"):
            get_model_instance(Company, '{"name__endswith": "company"}', {}, "at XXX")

    def test_cast_model(self):
        # shouldn't change anything if field is no model field or uses custom processor
        self.assertEqual(cast_model("10", field=FieldDefinition("A")), "10")
        self.assertEqual(cast_model("10", field=FieldDefinition("A", model=("abc", {}, None))), "10")

        with self.assertRaises(ValueError):
            cast_model("999999", field=FieldDefinition("A", model="company.company"))

        # should get correct model instance
        company = Company.objects.create(name="Test")
        self.assertEqual(cast_model(str(company.pk), field=FieldDefinition(
            "A", model="company.company")), str(company.pk))

    def test_cast_select(self):
        options = {"a": "A", "b": "B"}

        # test not valid option
        with self.assertRaisesRegex(ValueError, "'c' is not a valid option, choose one of: a, b."):
            cast_select("c", field=FieldDefinition("A", field_type="select", options=options))

        # test valid option
        self.assertEqual(cast_select("b", field=FieldDefinition("A", field_type="select", options=options)), "b")

        # test valid option using get_options
        self.assertEqual(cast_select("b", field=FieldDefinition(
            "A", field_type="select", get_options=lambda: options)), "b")


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


class BulkCreateObjectTestMixin:
    bulk_create_object: Type[BulkCreateObject]
    ignore_fields = []
    ignore_model_required_fields = []
    model_object_fields = []

    def setUp(self):
        self.request = CustomRequestFactory()

    def model_test(self, model: Model, fields: dict[str, FieldDefinition], path: str, *, ignore_fields: list[str] = [], ignore_model_required_fields: list[str] = []):
        if issubclass(model, MPTTModel):
            ignore_model_required_fields.extend(["lft", "level", "tree_id", "rght"])

        issues = []
        required_fields = {model_field.name: not (
            model_field.blank or model_field.null) and not model_field.has_default() for model_field in model._meta.fields}

        for key, field in fields.items():
            if key in ignore_fields:
                continue

            try:
                model_field = model._meta.get_field(key)
            except FieldDoesNotExist:
                issues.append(f"Field '{path}.{key}' does not exist on {model}")
                continue

            # required field
            if required_fields[key] and not field.default and not field.required:
                issues.append(f"Field '{path}.{key}' is required on model, but not as generate field")

            # integer field
            if isinstance(model_field, IntegerField) and field.field_type != "number":
                issues.append(f"Field '{path}.{key}' is integer model field, but generate field is {field.field_type}")

            # float field
            if isinstance(model_field, (FloatField, DecimalField)) and field.field_type != "float":
                issues.append(
                    f"Field '{path}.{key}' is float/decimal model field, but generate field is {field.field_type}")

            # boolean field
            if isinstance(model_field, BooleanField) and field.field_type != "boolean":
                issues.append(f"Field '{path}.{key}' is boolean model field, but generate field is {field.field_type}")

            # relation field
            if model_field.is_relation:
                if field.field_type != "model":
                    issues.append(
                        f"Field '{path}.{key}' is relation model field, but generate field is {field.field_type}")
                elif model_field.related_model != field.model[2]:
                    issues.append(
                        f"Field '{path}.{key}' is related to {model_field.related_model} on model field level, but generate field is related to {field.model[2]}")
                else:
                    related_model_fields = list(f.name for f in model_field.related_model._meta.fields)
                    wrong_fields = {f: v for f in field.model[1].keys() if (v := f not in related_model_fields)}
                    if len(wrong_fields.keys()) > 0:
                        issues.append(
                            f"Field '{path}.{key}' has the following limit options that doesn't exist on {model_field.related_model} on model field level, but generate field is related to {field.model[2]}: {','.join(wrong_fields)}")

        # check for missing fields
        missing_fields = set(k for k, required in required_fields.items() if required) - \
            set(k for k in fields.keys() if k not in ignore_fields) - set(ignore_model_required_fields)
        if len(missing_fields) > 0:
            missing_fields = ",".join(missing_fields)
            issues.append(
                f"The model {model} used by {path} has the following required fields which are not present as generate keys: {missing_fields}")

        return issues

    def extra_model_tests(self, obj: BulkCreateObject):
        return []

    def test_fields(self):
        issues = []

        obj = self.bulk_create_object(self.request.get("/abc"))
        ignore_fields = [*self.ignore_fields, *(f[0] for f in self.model_object_fields)]

        issues.extend(self.model_test(obj.model, obj.fields,
                      f"{obj.template_type}", ignore_fields=ignore_fields, ignore_model_required_fields=self.ignore_model_required_fields))

        for key, model, ignore_fields, ignore_model_required_fields in self.model_object_fields:
            issues.extend(self.model_test(model, obj.fields[key].fields,
                          f"{obj.template_type}.{key}", ignore_fields=ignore_fields, ignore_model_required_fields=ignore_model_required_fields))

        issues.extend(self.extra_model_tests(obj))

        if len(issues) > 0:
            error_msgs = "\n".join(f"- {i}" for i in issues)
            self.fail(f"There are {len(issues)} issues with the generate fields:\n{error_msgs}")


class StockLocationBulkCreateObjectTestCase(BulkCreateObjectTestMixin, TestCase):
    bulk_create_object = StockLocationBulkCreateObject


class PartCategoryBulkCreateObjectTestCase(BulkCreateObjectTestMixin, TestCase):
    bulk_create_object = PartCategoryBulkCreateObject


class PartBulkCreateObjectTestCase(BulkCreateObjectTestMixin, TestCase):
    bulk_create_object = PartBulkCreateObject
    ignore_fields = ["parameters", "attachments", "related_parts"]
    model_object_fields = [
        ("supplier", SupplierPart, ["_make_default"], ["part"]),
        ("manufacturer", ManufacturerPart, [], ["part"]),
        ("stock", StockItem, ["status"], ["part"]),
    ]

    def setUp(self):
        self.request = CustomRequestFactory()
        self.user = User.objects.create_user(username="test", password="test")
        return super().setUp()

    def extra_model_tests(self, obj):
        issues = []

        issues.extend(self.model_test(
            PartParameter,
            obj.fields["parameters"].items_type.fields,
            f"{obj.template_type}.parameters.[x]",
            ignore_fields=["value"],
            ignore_model_required_fields=["data", "part"],
        ))

        issues.extend(self.model_test(
            PartAttachment,
            obj.fields["attachments"].items_type.fields,
            f"{obj.template_type}.attachments.[x]",
            ignore_fields=["file_url", "file_name", "file_headers"],
            ignore_model_required_fields=["part"],
        ))

        issues.extend(self.model_test(
            PartRelated,
            {"part_2": obj.fields["related_parts"].items_type},
            f"{obj.template_type}.related_parts.[x]",
            ignore_model_required_fields=["part_1"],
        ))

        return issues

    def test_create_objects(self):
        InvenTreeSetting.set_setting("INVENTREE_DOWNLOAD_FROM_URL", True, None)

        parameter_template = PartParameterTemplate.objects.create(name="Test", units="kg", description="Test template")
        supplier_company = Company.objects.create(name="Supplier", is_supplier=True)
        manufacturer_company = Company.objects.create(name="Supplier", is_supplier=False, is_manufacturer=True)
        stock_location = StockLocation.objects.create(name="Test location")
        category = PartCategory.objects.create(name="Test category")

        base_data = {
            "image": "https://raw.githubusercontent.com/test-images/png/main/202105/cs-black-000.png",
            "attachments": [
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

        req = self.request.get(f"/abc?parent_id={category.pk}")
        req.user = self.user
        obj = PartBulkCreateObject(req)
        obj.get_context()
        part, = obj.create_objects(data)

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

        # --- start: Test all exceptions here

        # try attachment and link for the same attachment
        with self.assertRaisesRegex(ValueError, "Either provide a link or an attachment."):
            req = self.request.get(f"/abc?parent_id={category.pk}")
            req.user = self.user
            obj = PartBulkCreateObject(req)
            obj.get_context()
            obj.create_objects([
                ({
                    "name": "Test 1_0",
                    "description": "Test Description",
                    "attachments": [{"comment": "A", "link": "https://github.com", "file_url": "https://github.com"}]
                }, [])
            ])

        # try with disabled image download
        InvenTreeSetting.set_setting("INVENTREE_DOWNLOAD_FROM_URL", False, None)
        with self.assertRaisesRegex(ValueError, "Downloading images from remote URL is not enabled"):
            req = self.request.get(f"/abc?parent_id={category.pk}")
            req.user = self.user
            obj = PartBulkCreateObject(req)
            obj.get_context()
            obj.create_objects([
                ({
                    "name": "Test 1_1",
                    "description": "Test Description",
                    "image": "https://raw.githubusercontent.com/test-images/png/main/202105/cs-black-000.png"
                }, [])
            ])
        InvenTreeSetting.set_setting("INVENTREE_DOWNLOAD_FROM_URL", True, None)

        # try with invalid url image download
        with self.assertRaises(ValueError):
            req = self.request.get(f"/abc?parent_id={category.pk}")
            req.user = self.user
            obj = PartBulkCreateObject(req)
            obj.get_context()
            obj.create_objects([
                ({
                    "name": "Test 1_2",
                    "description": "Test Description",
                    "image": "https://example.com/test.png"
                }, [])
            ])

        # try with invalid attachment download
        with self.assertRaises(ValueError):
            req = self.request.get(f"/abc?parent_id={category.pk}")
            req.user = self.user
            obj = PartBulkCreateObject(req)
            obj.get_context()
            obj.create_objects([
                ({
                    "name": "Test 1_3",
                    "description": "Test Description",
                    "attachments": [{"comment": "A", "file_url": "https://example.com/test.pdf"}]
                }, [])
            ])

        # try with not existing image
        with self.assertRaisesRegex(ValueError, "Image '__not_existing.png' for part 'Test 1_4' does not exist"):
            req = self.request.get(f"/abc?parent_id={category.pk}")
            req.user = self.user
            obj = PartBulkCreateObject(req)
            obj.get_context()
            obj.create_objects([
                ({
                    "name": "Test 1_4",
                    "description": "Test Description",
                    "image": "__not_existing.png"
                }, [])
            ])

        # try with non template part as parent
        with self.assertRaisesRegex(ValueError, "Part 'Test 1_8_1' cannot be a variant of 'Test 1_8' because the parent is not a template part."):
            req = self.request.get(f"/abc?parent_id={category.pk}")
            req.user = self.user
            obj = PartBulkCreateObject(req)
            obj.get_context()
            obj.create_objects([
                ({
                    "name": "Test 1_8",
                    "description": "Test Description",
                }, [
                    ({
                        "name": "Test 1_8_1",
                        "description": "Test Description",
                    }, [])
                ])
            ])
        # --- end: Test all exceptions here

        # even there are errors thrown, there shouldn't be created anything, because of the transaction
        for model, count in expected_objs:
            c = len(model.objects.all())
            self.assertEqual(
                c, count, f"There should be only {count} of {model}, found {c} - even after a few generations all should have failed")

        # try with existing image
        req = self.request.get(f"/abc?parent_id={category.pk}")
        req.user = self.user
        obj = PartBulkCreateObject(req)
        obj.get_context()
        obj.create_objects([
            ({
                "name": "Test 1_5",
                "description": "Test Description",
                "image": str(Part.objects.first().image)
            }, [])
        ])

        # try with reusing existing image
        req = self.request.get(f"/abc?parent_id={category.pk}")
        req.user = self.user
        obj = PartBulkCreateObject(req)
        obj.get_context()
        obj.create_objects([
            ({
                "name": "Test 1_6_1",
                "description": "Test Description",
                "image": "https://raw.githubusercontent.com/test-images/png/main/202105/cs-black-000.png"
            }, []),
            ({
                "name": "Test 1_6_2",
                "description": "Test Description",
                "image": "https://raw.githubusercontent.com/test-images/png/main/202105/cs-black-000.png"
            }, [])
        ])

        # test related parts
        related_part = Part.objects.create(name="Test to relate this part",
                                           description="Test to relate this part description")
        req = self.request.get(f"/abc?parent_id={category.pk}")
        req.user = self.user
        obj = PartBulkCreateObject(req)
        obj.get_context()
        created = obj.create_objects([
            ({
                "name": "Test 1_7",
                "description": "Test Description",
                "related_parts": [str(related_part.pk)]
            }, []),
        ])
        self.assertEqual(len(created), 1)
        self.assertEqual(created[0].get_related_parts(), {related_part})

        # test duplicate fields for variant parts
        InvenTreeSetting.set_setting("PART_ALLOW_DUPLICATE_IPN", True, None)
        template_part = Part.objects.create(
            name="Test template part",
            description="Test template part description",
            is_template=True,
            image=part.image.name,
            IPN="TEST_IPN_123_FOR_TEMPLATE"
        )
        part_parameter_template1 = PartParameterTemplate.objects.create(name="Test 1", units="kg")
        part_parameter_template2 = PartParameterTemplate.objects.create(name="Test 2", units="kg")
        PartParameter.objects.create(part=template_part, template=part_parameter_template1, data="10")
        req = self.request.get(f"/abc?parent_id={category.pk}")
        req.user = self.user
        req.data = {"template": {"output": {"generate": {"variant_of": str(template_part.pk)}}}}
        obj = PartBulkCreateObject(req)
        obj.get_context()
        created, = obj.create_objects([
            ({
                "name": "Test 1_9",
                "parameters": [{"template": str(part_parameter_template2.pk), "value": "13"}]
            }, []),
        ])
        self.assertEqual(created.description, template_part.description)
        self.assertEqual(created.is_template, False)
        self.assertEqual(created.variant_of, template_part)
        self.assertCountEqual(list((p.part.name, p.template.name, p.data) for p in created.get_parameters()), [
            ('Test 1_9', 'Test 1', '10'), ('Test 1_9', 'Test 2', '13')])
        self.assertEqual(created.image.name, template_part.image.name)
        self.assertEqual(created.IPN, template_part.IPN)

        # test duplicate fields for variant parts without IPN duplication
        InvenTreeSetting.set_setting("PART_ALLOW_DUPLICATE_IPN", False, None)
        req = self.request.get(f"/abc?parent_id={category.pk}")
        req.user = self.user
        req.data = {"template": {"output": {"generate": {"variant_of": str(template_part.pk)}}}}
        obj = PartBulkCreateObject(req)
        obj.get_context()
        created, = obj.create_objects([
            ({
                "name": "Test 1_10",
            }, []),
        ])
        self.assertEqual(created.IPN, None)
        InvenTreeSetting.set_setting("PART_ALLOW_DUPLICATE_IPN", True, None)

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

        # test with invalid variant_of id
        data = {"output": {"generate": {"variant_of": "999999"}}}

        for d in [data, json.dumps(data)]:
            r = self.request.get(f"/abc?parent_id={category.pk}")
            r.data = {"template": d}
            obj = PartBulkCreateObject(r)
            with self.assertRaisesRegex(ValueError, "Model 'part.part' where {'pk': 999999, 'is_template': True} not found for variant_of field"):
                obj.get_context()

        # test with valid variant_of id
        part = Part.objects.create(name="Test part", description="Test part desc", is_template=True)
        r = self.request.get(f"/abc?parent_id={category.pk}")
        r.data = {"template": {"output": {"generate": {"variant_of": str(part.pk)}}}}
        obj = PartBulkCreateObject(r)
        ctx = obj.get_context()
        self.assertDictContainsSubset(
            {"name": "Test part", "description": "Test part desc", "is_template": True}, ctx["gen"])
        self.assertEqual(obj.parent, part)
