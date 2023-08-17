from rest_framework import serializers

from .models import BulkCreationTemplate


class TemplateSerializer(serializers.ModelSerializer):
    """Serializer for a BulkCreationTemplate."""

    class Meta:
        """Meta for a serializer."""
        model = BulkCreationTemplate
        fields = [
            "id",
            "name",
            "template_type",
            "template",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "created_at",
            "updated_at",
        ]


class FieldDefinitionSerializer(serializers.Serializer):
    """Serializer for a field definition."""

    class Meta:
        fields = [
            "name",
            "field_type",
            "required",
        ]

    name = serializers.CharField()
    field_type = serializers.CharField()
    required = serializers.BooleanField()


class BulkCreateObjectSerializer(serializers.Serializer):
    """Serializer for a BulkCreateObject implementation."""

    class Meta:
        fields = [
            "name",
            "template_type",
            "generate_type",
            "fields",
        ]

        read_only_fields = fields

    name = serializers.CharField()
    template_type = serializers.CharField()
    generate_type = serializers.CharField()
    fields = serializers.DictField(child=FieldDefinitionSerializer(read_only=True))
