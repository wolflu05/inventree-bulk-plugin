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

from pydantic import ValidationError

from .models import BulkCreationTemplate
from .version import BULK_PLUGIN_VERSION
from .BulkGenerator.BulkGenerator import BulkGenerator

BulkCreationTemplateForm = modelform_factory(
    BulkCreationTemplate, fields=("name", "template_type", "template"))


class BulkActionPlugin(AppMixin, PanelMixin, UrlsMixin, InvenTreePlugin):
    AUTHOR = "wolflu05"
    DESCRIPTION = "Bulk action plugin"
    VERSION = BULK_PLUGIN_VERSION
    MIN_VERSION = "0.9.1"  # due to "invoke update" doesn't run collectstatic (see #inventree/InvenTree#4077)

    TITLE = "Bulk Action"
    SLUG = "bulkaction"
    NAME = "Bulk Action"

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
            error, output = self._parse_bulk_schema(request.body)
            if error is not None:
                return error

            return JsonResponse(output, safe=False)

    @csrf_exempt
    def url_bulk_create_location(self, request, pk):
        if request.method == "POST":
            error, output = self._parse_bulk_schema(request.body)
            if error is not None:
                return error

            root_location = StockLocation.objects.get(pk=pk)

            self._create_location(root_location, output)

            return HttpResponse(status=status.HTTP_201_CREATED)

    @csrf_exempt
    def url_bulk_create_category(self, request, pk):
        if request.method == "POST":
            error, output = self._parse_bulk_schema(request.body)
            if error is not None:
                return error

            root_category = PartCategory.objects.get(pk=pk)

            self._create_category(root_category, output)

            return HttpResponse(status=status.HTTP_201_CREATED)

    def _parse_bulk_schema(self, schema):
        try:
            parsed = json.loads(schema)
            bg = BulkGenerator(parsed).generate()
            return None, bg
        except (ValueError, ValidationError) as e:
            return JsonResponse({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST, safe=False), None
        except Exception:
            return JsonResponse({"error": "An error occured"}, status=status.HTTP_400_BAD_REQUEST, safe=False), None

    def _create_location(self, parent, childs):
        for c in childs:
            loc = StockLocation.objects.create(
                name=c[0]['name'],
                description=c[0]['description'],
                parent=parent
            )

            self._create_location(loc, c[1])

    def _create_category(self, parent, childs):
        for c in childs:
            cat = PartCategory.objects.create(
                name=c[0]['name'],
                description=c[0]['description'],
                parent=parent
            )

            self._create_category(cat, c[1])

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
