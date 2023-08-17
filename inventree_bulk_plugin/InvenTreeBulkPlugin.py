from plugin import InvenTreePlugin
from plugin.mixins import PanelMixin, UrlsMixin, AppMixin
from stock.views import StockLocationDetail
from part.views import CategoryDetail

from .api import api_urls
from .version import BULK_PLUGIN_VERSION


class InvenTreeBulkPlugin(AppMixin, PanelMixin, UrlsMixin, InvenTreePlugin):
    AUTHOR = "wolflu05"
    DESCRIPTION = "InvenTree Bulk plugin"
    VERSION = BULK_PLUGIN_VERSION
    MIN_VERSION = "0.9.1"  # due to "invoke update" doesn't run collectstatic (see inventree/InvenTree#4077)

    TITLE = "InvenTree Bulk Plugin"
    SLUG = "inventree-bulk-plugin"
    NAME = "InvenTreeBulkPlugin"

    def get_custom_panels(self, view, request):
        panels = []

        if isinstance(view, StockLocationDetail):
            panels.append({
                'title': 'Bulk creation',
                'icon': 'fas fa-tools',
                'content': '{% include "preact-page.html" with page="bulk-creation-panel" objectId=object.id objectType="STOCK_LOCATION" %}',
                'description': 'Bulk creation tools',
            })

        if isinstance(view, CategoryDetail):
            panels.append({
                'title': 'Bulk creation',
                'icon': 'fas fa-tools',
                'content': '{% include "preact-page.html" with page="bulk-creation-panel" objectId=object.id objectType="PART_CATEGORY" %}',
                'description': 'Bulk creation tools',
            })

        return panels

    def setup_urls(self):
        return api_urls
