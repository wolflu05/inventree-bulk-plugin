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
            "allow_multiple",
            "items_type",
            "fields",
            "default",
            "options",
        ]

    name = serializers.CharField()
    field_type = serializers.CharField()
    description = serializers.CharField()
    required = serializers.BooleanField()
    model = serializers.SerializerMethodField()
    allow_multiple = serializers.BooleanField()
    default = serializers.SerializerMethodField("get_default_method")
    options = serializers.SerializerMethodField("get_options_method")

    def get_fields(self):
        fields = super().get_fields()
        fields["items_type"] = FieldDefinitionSerializer()
        fields["fields"] = serializers.DictField(child=FieldDefinitionSerializer(read_only=True))
        return fields

    def get_model(self, obj):
        model = getattr(obj, "model", None)
        if model is None:
            return None

        return {
            "model": model[0],
            "limit_choices_to": model[1],
            "api_url": obj.get_api_url(),
        }

    def get_default_method(self, obj):
        default = getattr(obj, "default", None)
        get_default = getattr(obj, "get_default", None)

        # try to get default value from associated BulkCreateObject class
        if get_default is not None:
            return get_default()
        if default is not None:
            return default
        return None

    def get_options_method(self, obj):
        options = getattr(obj, "options", None)
        get_options = getattr(obj, "get_options", None)

        # try to get options value from associated BulkCreateObject class
        if get_options is not None:
            return get_options()
        if options is not None:  # pragma: no cover
            return options  # currently there is no option that needs this case
        return None


class BulkCreateObjectSerializer(serializers.Serializer):
    """Serializer for a BulkCreateObject implementation."""

    class Meta:
        fields = [
            "name",
            "template_type",
            "generate_type",
        ]

        read_only_fields = fields

    name = serializers.CharField()
    template_type = serializers.CharField()
    generate_type = serializers.CharField()


class BulkCreateObjectDetailSerializer(BulkCreateObjectSerializer):
    """Serializer for a BulkCreateObjectDetail implementation."""

    class Meta(BulkCreateObjectSerializer.Meta):
        fields = BulkCreateObjectSerializer.Meta.fields + ["fields"]

    fields = serializers.DictField(child=FieldDefinitionSerializer(read_only=True))
