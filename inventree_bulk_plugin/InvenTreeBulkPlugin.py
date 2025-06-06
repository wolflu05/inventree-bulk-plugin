import json
import os
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from rest_framework.request import Request

from plugin import InvenTreePlugin
from plugin.base.ui.mixins import UIFeature
from plugin.mixins import UserInterfaceMixin, UrlsMixin, AppMixin, SettingsMixin

from .api import api_urls
from .version import BULK_PLUGIN_VERSION


@dataclass
class Panel:
    title: str
    model: str
    icon: str
    args: dict


def validate_json(value):
    try:
        json.loads(value)
    except Exception as e:
        raise ValidationError(str(e))


class InvenTreeBulkPlugin(AppMixin, UserInterfaceMixin, UrlsMixin, SettingsMixin, InvenTreePlugin):
    AUTHOR = "wolflu05"
    DESCRIPTION = "InvenTree Bulk plugin"
    VERSION = BULK_PLUGIN_VERSION

    # 0.9.1 - due to "invoke update" doesn't run collectstatic (see inventree/InvenTree#4077)
    # 0.12.6 - Settings do not work in combination with api views (see inventree/InvenTree#5408)
    # 0.12.7 - Fix missing filters for get settings validator (see inventree/InvenTree#5480)
    # 0.15.8 - plugin_static template tag was added (see inventree/InvenTree#7764)
    # 0.18.0 - Migrate to PUI
    MIN_VERSION = "0.18.0"

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
            model="stocklocation",
            icon="ti:tools:outline",
            args={"objectType": "STOCK_LOCATION"}
        ),
        Panel(
            "Category bulk creation",
            model="partcategory",
            icon="ti:tools:outline",
            args={"objectType": "PART_CATEGORY"}
        ),
        Panel(
            "Part bulk creation",
            model="partcategory",
            icon="ti:tools:outline",
            args={"objectType": "PART"}
        ),
    ]

    def get_ui_panels(self, request: Request, context: dict, **kwargs) -> list[UIFeature]:
        panels = []

        target_model = context.get('target_model', None)
        target_id = context.get('target_id', None)

        for panel in self.PREACT_PANELS:
            if target_model == panel.model and target_id is not None:
                panels.append({
                    'key': f'bulk-creation-panel-{panel.model}',
                    'title': panel.title,
                    'source': self.plugin_static_file('bulk-creation-panel.dev.js:renderPanel' if os.environ.get('INVENTREE_REPORT_LSP_DEV', False) else 'dist/bulk-creation-panel.js:renderPanel'),
                    'icon': panel.icon,
                    'context': {
                        'args': panel.args,
                    }
                })

        return panels

    def setup_urls(self):
        return api_urls
