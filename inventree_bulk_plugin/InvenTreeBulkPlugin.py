from dataclasses import dataclass
import json

from django.views import View

from plugin import InvenTreePlugin
from plugin.mixins import PanelMixin, UrlsMixin, AppMixin
from stock.views import StockLocationDetail
from part.views import CategoryDetail

from .api import api_urls
from .version import BULK_PLUGIN_VERSION


@dataclass
class Panel:
    title: str
    view: View
    icon: str
    page: str
    args: dict
    description: str = None

    @property
    def args_string(self):
        return " ".join([f"{k}={json.dumps(v)}" for k, v in self.args.items()])

    def __post_init__(self):
        if self.description is None:
            self.description = self.title


class InvenTreeBulkPlugin(AppMixin, PanelMixin, UrlsMixin, InvenTreePlugin):
    AUTHOR = "wolflu05"
    DESCRIPTION = "InvenTree Bulk plugin"
    VERSION = BULK_PLUGIN_VERSION

    # 0.9.1 - due to "invoke update" doesn't run collectstatic (see inventree/InvenTree#4077)
    # 0.12.6 - Settings do not work in combination with api views (see inventree/InvenTree#5408)
    MIN_VERSION = "0.12.6"

    TITLE = "InvenTree Bulk Plugin"
    SLUG = "inventree-bulk-plugin"
    NAME = "InvenTreeBulkPlugin"

    PREACT_PANELS: list[Panel] = [
        Panel(
            "Location bulk creation",
            view=StockLocationDetail,
            icon="fas fa-tools",
            page="bulk-creation-panel",
            args={"objectType": "STOCK_LOCATION"}
        ),
        Panel(
            "Category bulk creation",
            view=CategoryDetail,
            icon="fas fa-tools",
            page="bulk-creation-panel",
            args={"objectType": "PART_CATEGORY"}
        ),
        Panel(
            "Part bulk creation",
            view=CategoryDetail,
            icon="fas fa-tools",
            page="bulk-creation-panel",
            args={"objectType": "PART"}
        ),
    ]

    def get_custom_panels(self, view, request):
        panels = []

        for i, panel in enumerate(self.PREACT_PANELS):
            if isinstance(view, panel.view):
                panels.append({
                    'title': panel.title,
                    'icon': panel.icon,
                    'content': '{% include "preact-page.html" with page="' + panel.page + '" id="' + str(i) + '" objectId=object.id ' + panel.args_string + ' %}',
                    'description': panel.description,
                })

        return panels

    def setup_urls(self):
        return api_urls
