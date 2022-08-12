import yaml

from django.conf.urls import url
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status

from plugin import InvenTreePlugin
from plugin.mixins import PanelMixin, UrlsMixin, AppMixin
from stock.views import StockLocationDetail, StockIndex
from stock.models import StockLocation

from .version import BULK_PLUGIN_VERSION
from .BulkGenerator.BulkGenerator import BulkGenerator


class BulkActionPlugin(AppMixin, PanelMixin, UrlsMixin, InvenTreePlugin):
    AUTHOR = "wolflu05"
    DESCRIPTION = "Bulk action plugin"
    VERSION = BULK_PLUGIN_VERSION

    NAME = "inventree_bulk"
    SLUG = "bulkaction"
    TITLE = "Bulk Action"

    def get_custom_panels(self, view, request):
        panels = []

        if isinstance(view, StockIndex):
            panels.append({
                'title': 'Manage bulk creation',
                'icon': 'fas fa-tools',
                'content_template': 'manage-bulk.html',
                'javascript_template': 'manage-bulk.js',
                'description': 'Manage bulk creation',
            })

        if isinstance(view, StockLocationDetail):
            panels.append({
                'title': 'Bulk creation',
                'icon': 'fas fa-tools',
                'content_template': 'create-bulk.html',
                'javascript_template': 'create-bulk.js',
                'description': 'Bulk creation tools',
            })

        return panels

    @csrf_exempt
    def parse(self, request):
        if request.method == "POST":
            parsed = yaml.safe_load(request.body)
            bg = BulkGenerator(parsed).generate()
            return JsonResponse(bg, safe=False)

    @csrf_exempt
    def bulk_create(self, request, pk):
        if request.method == "POST":
            parsed = yaml.safe_load(request.body)
            bg = BulkGenerator(parsed).generate()

            root_location = StockLocation.objects.get(pk=pk)

            self._create_location(root_location, bg)

            return HttpResponse(status=status.HTTP_201_CREATED)

    def _create_location(self, parent, childs):
        for c in childs:
            loc = StockLocation.objects.create(
                name=c[0]['name'],
                description=c[0]['description'],
                parent=parent
            )

            self._create_location(loc, c[1])

    def setup_urls(self):
        return [
            url(r'parse', self.parse, name='parse'),
            url(r'bulkcreate/(?P<pk>\d+)', self.bulk_create, name='bulkcreate'),
        ]
