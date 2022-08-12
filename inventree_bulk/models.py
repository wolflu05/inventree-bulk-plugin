from django.db import models


class BulkCreationTemplate(models.Model):
    """Store bulk creation templates"""

    name = models.CharField(max_length=250)
    template = models.TextField()
    created_at = models.DateField(auto_created=True)
    updated_at = models.DateField(auto_now=True)
