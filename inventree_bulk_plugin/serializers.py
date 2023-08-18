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
            "description",
            "required",
            "model",
            "items_type",
            "fields",
            "default",
        ]

    name = serializers.CharField()
    field_type = serializers.CharField()
    description = serializers.CharField()
    required = serializers.BooleanField()
    model = serializers.SerializerMethodField()
    default = serializers.SerializerMethodField("get_default_method")

    def get_fields(self):
        fields = super().get_fields()
        fields["items_type"] = FieldDefinitionSerializer()
        fields["fields"] = serializers.DictField(child=FieldDefinitionSerializer(read_only=True))
        return fields

    def get_model(self, obj):
        model = getattr(obj, "model", None)
        if model is None:
            return None

        return {"model": model[0], "limit_choices_to": model[1]}

    def get_default_method(self, obj):
        default = getattr(obj, "default", None)
        get_default = getattr(obj, "get_default", None)

        # try to get default value from associated BulkCreateObject class
        if get_default is not None and (func := getattr(self.root.instance, get_default, None)):
            return func()
        if default is not None:
            return default
        return None


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
