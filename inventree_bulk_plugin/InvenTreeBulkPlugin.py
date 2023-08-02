import json

from django.conf.urls import url
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.forms.models import modelform_factory, model_to_dict
from rest_framework import status

from plugin import InvenTreePlugin
from plugin.mixins import PanelMixin, UrlsMixin, AppMixin
from stock.views import StockLocationDetail, StockIndex
from stock.models import StockLocation
from part.views import CategoryDetail
from part.models import PartCategory
from InvenTree.helpers import str2bool, str2int

from pydantic import ValidationError

from .models import BulkCreationTemplate
from .version import BULK_PLUGIN_VERSION
from .BulkGenerator.BulkGenerator import BulkGenerator

BulkCreationTemplateForm = modelform_factory(
    BulkCreationTemplate, fields=("name", "template_type", "template"))


class InvenTreeBulkPlugin(AppMixin, PanelMixin, UrlsMixin, InvenTreePlugin):
    AUTHOR = "wolflu05"
    DESCRIPTION = "InvenTree Bulk plugin"
    VERSION = BULK_PLUGIN_VERSION
    MIN_VERSION = "0.9.1"  # due to "invoke update" doesn't run collectstatic (see inventree/InvenTree#4077)

    TITLE = "InvenTree Bulk Plugin"
    SLUG = "inventree-bulk-plugin"
    NAME = "InvenTreeBulkPlugin"

    ALLOWED_FIELDS = {
        "STOCK_LOCATION": {
            "name": {"name": "Name", "required": True},
            "description": {"name": "Description"},
            "structural": {"name": "Structural", "type": "boolean"},
            "external": {"name": "External", "type": "boolean"},
            "icon": {"name": "Icon"},
        },
        "PART_CATEGORY": {
            "name": {"name": "Name", "required": True},
            "description": {"name": "Description"},
            "default_location_id": {"name": "Default location", "type": "number"},
            "default_keywords": {"name": "Default keywords"},
            "structural": {"name": "Structural", "type": "boolean"},
            "icon": {"name": "Icon"},
        },
    }

    def get_custom_panels(self, view, request):
        panels = []

        if isinstance(view, StockIndex):
            panels.append({
                'title': 'Manage bulk creation',
                'icon': 'fas fa-tools',
                'content_template': 'panels/stock-index/manage-bulk.html',
                'javascript_template': 'panels/stock-index/manage-bulk.js',
                'description': 'Manage bulk creation',
            })

        if isinstance(view, StockLocationDetail):
            panels.append({
                'title': 'Bulk creation',
                'icon': 'fas fa-tools',
                'content_template': 'panels/stock-location-detail/create-bulk.html',
                'javascript_template': 'panels/stock-location-detail/create-bulk.js',
                'description': 'Bulk creation tools',
            })

        if isinstance(view, CategoryDetail):
            panels.append({
                'title': 'Bulk creation',
                'icon': 'fas fa-tools',
                'content_template': 'panels/category-detail/create-bulk.html',
                'javascript_template': 'panels/category-detail/create-bulk.js',
                'description': 'Bulk creation tools',
            })

        return panels

    @csrf_exempt
    def url_parse(self, request):
        if request.method == "POST":
            allowed_fields = None
            if template_type := request.GET.get("template_type"):
                if fields := self.ALLOWED_FIELDS.get(template_type, None):
                    allowed_fields = self.add_casts_to_field(fields)
                else:
                    return JsonResponse({"error": f"Template type '{template_type}' not found, choose one of {','.join(self.ALLOWED_FIELDS.keys())}"}, status=status.HTTP_400_BAD_REQUEST, safe=False)

            error, output = self._parse_bulk_schema(request.body, {}, allowed_fields)
            if error is not None:
                return error

            return JsonResponse(output, safe=False)

        if request.method == "OPTIONS":
            return JsonResponse(self.ALLOWED_FIELDS)

    @csrf_exempt
    def url_bulk_create_location(self, request, pk):
        if request.method == "POST":
            try:
                root_location = StockLocation.objects.get(pk=pk)
            except (StockLocation.DoesNotExist):
                return HttpResponse(status=status.HTTP_404_NOT_FOUND)

            allowed_fields = self.add_casts_to_field(self.ALLOWED_FIELDS["STOCK_LOCATION"])
            parent = {key: getattr(root_location, key) for key in allowed_fields if hasattr(root_location, key)}
            error, output = self._parse_bulk_schema(request.body, parent, fields=allowed_fields)
            if error is not None:
                return error

            try:
                self._bulk_create(StockLocation, root_location, output, allowed_fields.keys())
            except Exception as e:  # pragma: no cover
                return JsonResponse({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

            return HttpResponse(status=status.HTTP_201_CREATED)

    @csrf_exempt
    def url_bulk_create_category(self, request, pk):
        if request.method == "POST":
            try:
                root_category = PartCategory.objects.get(pk=pk)
            except (PartCategory.DoesNotExist):
                return HttpResponse(status=status.HTTP_404_NOT_FOUND)

            allowed_fields = self.add_casts_to_field(self.ALLOWED_FIELDS["PART_CATEGORY"])
            parent = {key: getattr(root_category, key) for key in allowed_fields if hasattr(root_category, key)}
            error, output = self._parse_bulk_schema(request.body, parent, fields=allowed_fields)
            if error is not None:
                return error

            try:
                self._bulk_create(PartCategory, root_category, output, allowed_fields.keys())
            except Exception as e:  # pragma: no cover
                return JsonResponse({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

            return HttpResponse(status=status.HTTP_201_CREATED)

    def _parse_bulk_schema(self, schema, parent={}, fields=None):
        try:
            parsed = json.loads(schema)
            bg = BulkGenerator(parsed, fields=fields).generate({"gen": parent})
            return None, bg
        except (ValueError, ValidationError) as e:
            return JsonResponse({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST, safe=False), None
        except Exception:
            return JsonResponse({"error": "An error occurred"}, status=status.HTTP_400_BAD_REQUEST, safe=False), None

    def _bulk_create(self, object_class, parent, childs, allowed_keys):
        for c in childs:
            properties = {}
            for k, v in c[0].items():
                if k in allowed_keys:
                    properties[k] = v

            obj = object_class.objects.create(
                **properties,
                parent=parent
            )

            self._bulk_create(object_class, obj, c[1], allowed_keys)

    def add_casts_to_field(self, fields):
        cast_map = {
            "number": str2int,
            "boolean": str2bool,
            "string": str,
        }
        return {field_name: {**field_definition, "cast_func": cast_map[field_definition.get("type", "string")]} for field_name, field_definition in fields.items()}

    @csrf_exempt
    def url_templates(self, request, pk=None):
        if request.method == "POST":
            data = json.loads(request.body)
            populated_form = BulkCreationTemplateForm(data=data)
            if populated_form.is_valid():
                saved = populated_form.save()
                return JsonResponse(model_to_dict(saved))
            else:
                return JsonResponse(populated_form.errors.get_json_data(), status=status.HTTP_400_BAD_REQUEST)

        if request.method == "GET" and pk is None:
            templates = BulkCreationTemplate.objects.all()
            template_type = request.GET.get("template_type", None)
            if template_type is not None:
                templates = templates.filter(template_type=template_type)

            return JsonResponse(list(map(model_to_dict, templates)), safe=False)

        if pk is None:
            return HttpResponse(status=status.HTTP_404_NOT_FOUND)

        try:
            template = BulkCreationTemplate.objects.get(pk=pk)
        except BulkCreationTemplate.DoesNotExist:
            return HttpResponse(status=status.HTTP_404_NOT_FOUND)

        if request.method == "GET":
            return JsonResponse(model_to_dict(template))

        if request.method == "PUT":
            body = json.loads(request.body)
            populated_form = BulkCreationTemplateForm(
                {**model_to_dict(template), **body, "id": template.pk}, instance=template)
            if populated_form.is_valid():
                saved = populated_form.save()
                return JsonResponse(model_to_dict(saved))
            else:
                return JsonResponse(populated_form.errors.get_json_data(), status=status.HTTP_400_BAD_REQUEST)

        if request.method == "DELETE":
            template.delete()
            return HttpResponse(status=status.HTTP_201_CREATED)

        return HttpResponse(status=status.HTTP_404_NOT_FOUND)

    def setup_urls(self):
        return [
            url(r'parse', self.url_parse, name='parse'),
            url(r'bulkcreate/location/(?P<pk>\d+)',
                self.url_bulk_create_location, name='bulkcreatelocation'),
            url(r'bulkcreate/category/(?P<pk>\d+)',
                self.url_bulk_create_category, name='bulkcreatecategory'),
            url(r'templates/(?P<pk>\d+)', self.url_templates, name='templatebyid'),
            url(r'templates', self.url_templates, name='templates'),
        ]
