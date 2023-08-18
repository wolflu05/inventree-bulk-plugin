import json

from django.db import models
from django.core.exceptions import ValidationError

from pydantic import ValidationError as PyDanticValidationError

from .BulkGenerator.BulkGenerator import BulkGenerator


def validate_template(value):
    try:
        BulkGenerator(json.loads(value), fields={}).validate(True)
        return value
    except PyDanticValidationError as e:
        raise ValidationError(str(e))
    except json.decoder.JSONDecodeError:
        raise ValidationError("template is no valid json format")


class BulkCreationTemplate(models.Model):
    """Store bulk creation templates."""

    class Meta:
        app_label = "inventree_bulk_plugin"

    name = models.CharField(max_length=250)
    template_type = models.CharField(max_length=100)
    template = models.TextField(validators=[validate_template])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
