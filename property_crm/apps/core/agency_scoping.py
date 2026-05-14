"""
apps/core/agency_scoping.py

Reusable queryset scoping helpers for agency users.

Import and use these in any ViewSet that needs to filter data
for agency-tier users (Agency Manager or Agent External roles).

Usage pattern in a ViewSet:
    from apps.core.agency_scoping import AgencyScope

    def get_queryset(self):
        qs = BaseModel.objects.filter(organisation=self.request.user.organisation)
        return AgencyScope.filter(self.request.user, qs)
"""

from django.db import models


class AgencyScope:
    """
    Central helper for agency-level data scoping.

    All filtering is derived from user.agent.agency.
    The role determines what actions are permitted.
    The agency determines what data is visible.
    """

    @staticmethod
    def is_agency_user(user):
        """Returns True if this user is an external agency user."""
        return bool(getattr(user, "agent_id", None))

    @staticmethod
    def get_agency(user):
        """Returns the Agency for an agency user, or None for internal users."""
        if AgencyScope.is_agency_user(user):
            return user.agent.agency
        return None

    @staticmethod
    def is_agency_manager(user):
        """
        Returns True if this user is an Agency Manager.
        Agency Managers see all sales/contacts for their agency.
        Regular agents see only their own sales/contacts.
        """
        if not AgencyScope.is_agency_user(user):
            return False
        role_name = getattr(user.role, "name", "")
        return role_name == "Agency Manager"

    # ─────────────────────────────────────────────────────────────────────────
    # Visible lots
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def get_visible_lot_ids(user):
        """
        Returns a queryset of Lot IDs visible to this agency user.

        Visibility logic:
            Show lot if:
                1. LotAgency exists for this lot AND agency == this agency
                OR
                2. No LotAgency exists for this lot AND ProjectAgency exists
                   for this agency + project

            Hide lot if:
                - LotAgency exists for this lot AND agency != this agency
        """
        from apps.projects.models import LotAgency, ProjectAgency

        agency = AgencyScope.get_agency(user)
        if not agency:
            return None  # internal user — no scoping needed

        # Lots exclusively assigned to this agency
        exclusive_lot_ids = LotAgency.objects.filter(
            agency=agency
        ).values_list("lot_id", flat=True)

        # Projects this agency has access to
        accessible_project_ids = ProjectAgency.objects.filter(
            agency=agency,
            project__organisation=user.organisation,
        ).values_list("project_id", flat=True)

        # Lots in accessible projects with no exclusive assignment (open lots)
        from apps.projects.models import Lot
        open_lot_ids = Lot.objects.filter(
            stage__project__in=accessible_project_ids,
            lot_agency__isnull=True,
        ).values_list("id", flat=True)

        # Union of exclusively-assigned lots and open lots
        from itertools import chain
        return list(chain(exclusive_lot_ids, open_lot_ids))

    @staticmethod
    def filter_lots(user, qs):
        """Filter a Lot queryset to only lots visible to this agency user."""
        if not AgencyScope.is_agency_user(user):
            return qs
        visible_ids = AgencyScope.get_visible_lot_ids(user)
        return qs.filter(id__in=visible_ids)

    # ─────────────────────────────────────────────────────────────────────────
    # Visible projects
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def filter_projects(user, qs):
        """Filter a Project queryset to only projects this agency has access to."""
        if not AgencyScope.is_agency_user(user):
            return qs
        from apps.projects.models import ProjectAgency
        agency = AgencyScope.get_agency(user)
        accessible_project_ids = ProjectAgency.objects.filter(
            agency=agency,
            project__organisation=user.organisation,
        ).values_list("project_id", flat=True)
        return qs.filter(id__in=accessible_project_ids)

    # ─────────────────────────────────────────────────────────────────────────
    # Visible sales
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def filter_sales(user, qs):
        """
        Filter a Sale queryset for agency users.

        Agency Manager → all sales by any agent in their agency
        Agent External → only their own sales
        """
        if not AgencyScope.is_agency_user(user):
            return qs
        agency = AgencyScope.get_agency(user)
        if AgencyScope.is_agency_manager(user):
            return qs.filter(agent__agency=agency)
        return qs.filter(agent=user.agent)

    # ─────────────────────────────────────────────────────────────────────────
    # Visible buyers
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def filter_buyers(user, qs):
        """
        Filter a Buyer queryset to buyers linked to this agency's sales.

        Agency Manager → buyers on any sale by their agency
        Agent External → buyers on their own sales only
        """
        if not AgencyScope.is_agency_user(user):
            return qs
        agency = AgencyScope.get_agency(user)
        if AgencyScope.is_agency_manager(user):
            return qs.filter(
                models.Q(primary_sales__agent__agency=agency) |
                models.Q(secondary_sales__agent__agency=agency)
            ).distinct()
        return qs.filter(
            models.Q(primary_sales__agent=user.agent) |
            models.Q(secondary_sales__agent=user.agent)
        ).distinct()

    # ─────────────────────────────────────────────────────────────────────────
    # Visible activities
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def filter_activities(user, qs):
        """
        Filter an Activity queryset for agency users.
        Activities are scoped via their linked sale.

        Agency Manager → activities on any sale by their agency
        Agent External → activities on their own sales only
        """
        if not AgencyScope.is_agency_user(user):
            return qs
        agency = AgencyScope.get_agency(user)
        if AgencyScope.is_agency_manager(user):
            return qs.filter(sale__agent__agency=agency)
        return qs.filter(sale__agent=user.agent)