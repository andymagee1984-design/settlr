"""
apps/contacts/views.py
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Buyer, Agency, Agent, Solicitor, Referrer
from .serializers import (
    BuyerSerializer, AgencySerializer, AgentSerializer,
    SolicitorSerializer, ReferrerSerializer,
)


class BuyerViewSet(viewsets.ModelViewSet):
    serializer_class   = BuyerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Buyer.objects.for_org(self.request.user.organisation)


class AgencyViewSet(viewsets.ModelViewSet):
    serializer_class   = AgencySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Agency.objects.for_org(self.request.user.organisation)


class AgentViewSet(viewsets.ModelViewSet):
    serializer_class   = AgentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Agent.objects.for_org(self.request.user.organisation).select_related("agency")
        # External agents can only see their own record
        if self.request.user.is_external_agent:
            qs = qs.filter(pk=self.request.user.agent_id)
        return qs


class SolicitorViewSet(viewsets.ModelViewSet):
    serializer_class   = SolicitorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Solicitor.objects.for_org(self.request.user.organisation)


class ReferrerViewSet(viewsets.ModelViewSet):
    serializer_class   = ReferrerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Referrer.objects.for_org(self.request.user.organisation)
