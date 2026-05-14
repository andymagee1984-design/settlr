"""
apps/contacts/views.py

ViewSets for the Contacts feature.

Routes registered in apps/contacts/urls.py:
    router.register("buyers",     BuyerViewSet,    basename="buyer")
    router.register("agencies",   AgencyViewSet,   basename="agency")
    router.register("agents",     AgentViewSet,    basename="agent")
    router.register("solicitors", SolicitorViewSet, basename="solicitor")
    router.register("referrers",  ReferrerViewSet,  basename="referrer")
    router.register("prospects",  ProspectViewSet,  basename="prospect")

Plus two standalone paths in urls.py:
    path("enquiries/<str:form_token>/", PublicEnquiryView.as_view(), name="public-enquiry")
    path("webhooks/portal/<str:org_token>/", PortalWebhookView.as_view(), name="portal-webhook")
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Buyer, Agency, Agent, Solicitor, Referrer, Prospect, EnquiryForm
from .serializers import (
    BuyerSerializer, AgencySerializer, AgentSerializer,
    SolicitorSerializer, ReferrerSerializer,
    ProspectSerializer, ProspectSearchSerializer, PublicEnquirySerializer,
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


# ─────────────────────────────────────────────────────────────────────────────
# ProspectViewSet
# ─────────────────────────────────────────────────────────────────────────────

class ProspectViewSet(viewsets.ModelViewSet):
    """
    GET    /api/v1/prospects/              → list (filterable)
    POST   /api/v1/prospects/              → create (runs returning buyer match)
    GET    /api/v1/prospects/{id}/         → detail
    PATCH  /api/v1/prospects/{id}/         → update
    GET    /api/v1/prospects/search/       → lightweight search for sale creation flow
    POST   /api/v1/prospects/{id}/convert/ → manually mark as converted (edge case)
    POST   /api/v1/prospects/{id}/lose/    → mark as lost with reason

    Filtering:
        ?status=active|converted|lost
        ?project=<uuid>
        ?source=website_form|portal|walk_in|phone|referral|other
        ?assigned_to=<uuid>
        ?q=<search term> — searches first_name, last_name, email, phone
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "search":
            return ProspectSearchSerializer
        return ProspectSerializer

    def get_queryset(self):
        org = self.request.user.organisation
        qs = Prospect.objects.for_org(org).select_related(
            "project", "lot", "assigned_to", "buyer"
        ).prefetch_related("activities")

        # Filters
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        project_param = self.request.query_params.get("project")
        if project_param:
            qs = qs.filter(project_id=project_param)

        source_param = self.request.query_params.get("source")
        if source_param:
            qs = qs.filter(source=source_param)

        assigned_param = self.request.query_params.get("assigned_to")
        if assigned_param:
            qs = qs.filter(assigned_to_id=assigned_param)

        q = self.request.query_params.get("q", "").strip()
        if q:
            from django.db.models import Q
            qs = qs.filter(
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(email__icontains=q) |
                Q(phone__icontains=q)
            )

        return qs

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        """
        GET /api/v1/prospects/search/?q=<term>

        Lightweight search used in the sale creation flow.
        Returns active prospects only — converted/lost excluded.
        """
        q = request.query_params.get("q", "").strip()
        if not q or len(q) < 2:
            return Response([])

        from django.db.models import Q
        qs = Prospect.objects.for_org(request.user.organisation).filter(
            status=Prospect.Status.ACTIVE
        ).filter(
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q) |
            Q(email__icontains=q) |
            Q(phone__icontains=q)
        ).select_related("project")[:20]

        serializer = ProspectSearchSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="lose")
    def lose(self, request, pk=None):
        """
        POST /api/v1/prospects/{id}/lose/
        Body: { "lost_reason": "..." }

        Marks a prospect as lost. Requires a reason.
        """
        prospect = self.get_object()

        if prospect.status == Prospect.Status.CONVERTED:
            return Response(
                {"error": "validation_error", "detail": "Cannot mark a converted prospect as lost."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lost_reason = request.data.get("lost_reason", "").strip()
        if not lost_reason:
            return Response(
                {"error": "validation_error", "detail": "lost_reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prospect.status      = Prospect.Status.LOST
        prospect.lost_reason = lost_reason
        prospect.save(update_fields=["status", "lost_reason", "updated_at"])

        return Response(ProspectSerializer(prospect, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="reactivate")
    def reactivate(self, request, pk=None):
        """
        POST /api/v1/prospects/{id}/reactivate/

        Reactivates a lost prospect. Also called automatically when a
        linked sale falls over.
        """
        prospect = self.get_object()

        if prospect.status == Prospect.Status.CONVERTED:
            return Response(
                {"error": "validation_error", "detail": "Cannot reactivate a converted prospect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prospect.status      = Prospect.Status.ACTIVE
        prospect.lost_reason = ""
        prospect.save(update_fields=["status", "lost_reason", "updated_at"])

        return Response(ProspectSerializer(prospect, context={"request": request}).data)


# ─────────────────────────────────────────────────────────────────────────────
# Public enquiry form endpoint — no authentication
# ─────────────────────────────────────────────────────────────────────────────

class PublicEnquiryView(APIView):
    """
    POST /api/v1/enquiries/{form_token}/

    Public endpoint — no authentication required.
    Accepts enquiry form submissions from project websites.

    Body (JSON or form):
        first_name  required
        last_name   required
        email       required
        phone       optional
        lot_id      optional — UUID of specific lot they enquired about
        message     optional — stored in prospect notes

    Returns 200 on success (no body — don't expose internal IDs to the web).
    Returns 404 if form token is invalid or form is inactive.
    """

    permission_classes = [AllowAny]

    def post(self, request, form_token):
        # Look up the enquiry form
        try:
            form = EnquiryForm.objects.select_related(
                "project__organisation", "default_assigned_to"
            ).get(form_token=form_token, is_active=True)
        except EnquiryForm.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = PublicEnquirySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(status=status.HTTP_400_BAD_REQUEST)

        data         = serializer.validated_data
        organisation = form.project.organisation

        # Resolve lot if provided
        lot = None
        if data.get("lot_id"):
            from apps.projects.models import Lot
            try:
                lot = Lot.objects.get(id=data["lot_id"], stage__project=form.project)
            except Lot.DoesNotExist:
                pass

        # Run returning buyer match
        matched_buyer = Prospect.match_returning_buyer(
            organisation=organisation,
            email=data["email"],
            first_name=data["first_name"],
        )

        # Build notes from message field
        notes = data.get("message", "").strip()

        # Create prospect
        Prospect.objects.create(
            organisation       = organisation,
            first_name         = data["first_name"],
            last_name          = data["last_name"],
            email              = data["email"],
            phone              = data.get("phone", ""),
            source             = Prospect.Source.WEBSITE_FORM,
            project            = form.project,
            lot                = lot,
            assigned_to        = form.default_assigned_to,
            notes              = notes,
            is_returning_buyer = bool(matched_buyer),
            buyer              = matched_buyer,
        )

        # Return 200 with no body — don't expose internal data to website
        return Response(status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# Portal webhook endpoint — org_token authentication
# ─────────────────────────────────────────────────────────────────────────────

class PortalWebhookView(APIView):
    """
    POST /api/v1/webhooks/portal/{org_token}/

    Accepts lead payloads from property portals (Domain, REA etc.).
    Authenticated by org_token in URL — no bearer token required.

    Standard portal lead payload (Domain / REA format):
        {
            "enquirer": {
                "firstName": "John",
                "lastName":  "Smith",
                "email":     "john@example.com",
                "phone":     "0400000000"
            },
            "listing": {
                "id": "...",         // portal listing ID — not used
                "address": "..."     // not used
            },
            "message": "I'd like to know more..."
        }

    We map firstName/lastName/email/phone → Prospect fields.
    Project matching is not automatic from portal data — prospect is created
    without a project link unless a matching project can be identified.
    """

    permission_classes = [AllowAny]

    def post(self, request, org_token):
        from apps.core.models import Organisation

        # Look up organisation by token
        try:
            organisation = Organisation.objects.get(org_token=org_token)
        except Organisation.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Extract enquirer data — handle both Domain and REA payload shapes
        data     = request.data
        enquirer = data.get("enquirer") or data.get("contact") or data
        message  = data.get("message", "") or data.get("enquiryMessage", "")

        first_name = (
            enquirer.get("firstName") or
            enquirer.get("first_name") or
            enquirer.get("name", "").split()[0] if enquirer.get("name") else ""
        ).strip()

        last_name = (
            enquirer.get("lastName") or
            enquirer.get("last_name") or
            " ".join(enquirer.get("name", "").split()[1:]) if enquirer.get("name") else ""
        ).strip()

        email = (enquirer.get("email") or enquirer.get("emailAddress") or "").strip()
        phone = (enquirer.get("phone") or enquirer.get("phoneNumber") or enquirer.get("mobile") or "").strip()

        if not email or not first_name:
            # Cannot create a meaningful prospect without at minimum email + first name
            return Response(status=status.HTTP_400_BAD_REQUEST)

        # Run returning buyer match
        matched_buyer = Prospect.match_returning_buyer(
            organisation=organisation,
            email=email,
            first_name=first_name,
        )

        Prospect.objects.create(
            organisation       = organisation,
            first_name         = first_name,
            last_name          = last_name,
            email              = email,
            phone              = phone,
            source             = Prospect.Source.PORTAL,
            notes              = message,
            is_returning_buyer = bool(matched_buyer),
            buyer              = matched_buyer,
        )

        return Response(status=status.HTTP_200_OK)