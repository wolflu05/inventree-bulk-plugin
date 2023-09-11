import json
from dataclasses import dataclass

from django.views import View
from django.core.exceptions import ValidationError

from plugin import InvenTreePlugin
from plugin.mixins import PanelMixin, UrlsMixin, AppMixin, SettingsMixin
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


def validate_json(value):
    try:
        json.loads(value)
    except Exception as e:
        raise ValidationError(str(e))


class InvenTreeBulkPlugin(AppMixin, PanelMixin, UrlsMixin, SettingsMixin, InvenTreePlugin):
    AUTHOR = "wolflu05"
    DESCRIPTION = "InvenTree Bulk plugin"
    VERSION = BULK_PLUGIN_VERSION

    # 0.9.1 - due to "invoke update" doesn't run collectstatic (see inventree/InvenTree#4077)
    # 0.12.6 - Settings do not work in combination with api views (see inventree/InvenTree#5408)
    # 0.12.7 - Fix missing filters for get settings validator (see inventree/InvenTree#5480)
    MIN_VERSION = "0.12.7"

    TITLE = "InvenTree Bulk Plugin"
    SLUG = "inventree-bulk-plugin"
    NAME = "InvenTreeBulkPlugin"

    SETTINGS = {
        "DEFAULT_DOWNLOAD_HEADERS": {
            "name": "Default download headers",
            "description": "Set default download headers that should be used each time in json format",
            "default": "{}",
            "validator": validate_json
        }
    }

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
