import json

from django.conf.urls import url
from rest_framework import permissions, status
from rest_framework.authentication import SessionAuthentication, BasicAuthentication, TokenAuthentication
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.request import Request

from InvenTree.filters import SEARCH_ORDER_FILTER

from .bulkcreate_objects import bulkcreate_objects
from .serializers import TemplateSerializer, BulkCreateObjectSerializer, BulkCreateObjectDetailSerializer
from .models import BulkCreationTemplate
from .BulkGenerator.utils import str2bool
from .BulkGenerator.BulkGenerator import BulkGenerator


# Fix csrf
class CsrfExemptSessionAuthentication(SessionAuthentication):

    def enforce_csrf(self, request):
        return  # To not perform the csrf check previously happening


authentication_classes = [CsrfExemptSessionAuthentication, BasicAuthentication, TokenAuthentication]


class TemplateList(ListCreateAPIView):
    """API endpoint for list of Template objects.

    - GET: Return a list of all Template objects
    - POST: create a template
    """

    queryset = BulkCreationTemplate.objects.all()
    serializer_class = TemplateSerializer

    authentication_classes = authentication_classes
    permission_classes = [permissions.IsAuthenticated]

    filter_backends = SEARCH_ORDER_FILTER

    filterset_fields = [
        "name",
        "template_type",
    ]

    ordering_fields = [
        "name",
        "template_type",
    ]

    search_fields = [
        "name",
    ]


class TemplateDetail(RetrieveUpdateDestroyAPIView):
    """API detail endpoint for Template objects.

    - GET: return a Template
    - PUT: update a Template
    - PATCH: partially update a Template
    - DELETE: delete a Template
    """

    queryset = BulkCreationTemplate.objects.all()
    serializer_class = TemplateSerializer

    authentication_classes = authentication_classes
    permission_classes = [permissions.IsAuthenticated]


class BulkCreate(APIView):
    """API endpoint for bulk creating and previewing schemas.

    - GET: get all objects that can be bulk generated and their fields
    - POST: bulk generate / preview objects
    """

    authentication_classes = authentication_classes
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request):
        template_type = request.query_params.get("template_type", None)

        # return all bulk create objects
        if template_type is None:
            results = BulkCreateObjectSerializer(bulkcreate_objects.values(), many=True).data
            return Response(results)

        # return for specific object, also evaluate get default values
        bulkcreate_object_class = bulkcreate_objects.get(template_type, None)

        if not bulkcreate_object_class:
            return Response(
                {"error": f"Template type '{template_type}' not found, choose one of {','.join(bulkcreate_objects.keys())}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        bulkcreate_object = bulkcreate_object_class(request)
        results = BulkCreateObjectDetailSerializer(bulkcreate_object).data
        return Response(results)

    def post(self, request: Request):
        create_objects = str2bool(request.query_params.get("create", "false"))
        template_type = request.data.get("template_type", None)
        schema = request.data.get("template", None)

        bulkcreate_object_class = bulkcreate_objects.get(template_type, None)

        if not bulkcreate_object_class:
            return Response(
                {"error": f"Template type '{template_type}' not found, choose one of {','.join(bulkcreate_objects.keys())}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not schema:
            return Response({"error": "BulkDefinitionSchema not provided via 'template' property."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bulkcreate_object = bulkcreate_object_class(request)

            ctx = bulkcreate_object.get_context()

            if not isinstance(schema, dict):
                schema = json.loads(schema)
            bg = BulkGenerator(schema, fields=bulkcreate_object.fields).generate(ctx)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # only create if create query param is set
        if create_objects:
            try:
                objects = bulkcreate_object.create_objects(bg)
                return Response([obj.pk for obj in objects], status=status.HTTP_201_CREATED)
            except Exception as e:  # pragma: no cover
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(bg)


api_urls = [
    url(r"templates/(?P<pk>\d+)", TemplateDetail.as_view(), name="api-detail-templates"),
    url(r"templates", TemplateList.as_view(), name="api-list-templates"),
    url(r"bulkcreate", BulkCreate.as_view(), name="api-bulk-create"),
]
