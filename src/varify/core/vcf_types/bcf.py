"""
BCF VCF Type Handler

Handles bcftools merge output format:
- PRIMARY_CALLER from EUK_CALLER or CALLER INFO fields
- Requires SUPP_CALLERS aggregation (multiple records per variant)
"""

from typing import Any, Dict, Optional

from .base import VcfRecordType, VcfTypeHandler


class BCFHandler(VcfTypeHandler):
    """Handler for BCF (bcftools merge) VCF format."""

    def extract_primary_caller(self, info: Dict[str, Any], record: VcfRecordType) -> Optional[str]:
        """Extract primary caller from BCF INFO fields.

        BCF uses EUK_CALLER or CALLER INFO fields.

        Args:
            info: INFO field dictionary
            record: VCF record

        Returns:
            Primary caller name from EUK_CALLER or CALLER fields
        """
        return info.get("EUK_CALLER") or info.get("CALLER")

    def extract_type_specific_fields(
        self, info: Dict[str, Any], record: VcfRecordType
    ) -> Dict[str, Any]:
        """Extract BCF-specific fields.

        BCF doesn't have many type-specific fields beyond PRIMARY_CALLER.

        Args:
            info: INFO field dictionary
            record: VCF record

        Returns:
            Empty dictionary (no BCF-specific fields beyond PRIMARY_CALLER)
        """
        return {}

    def should_aggregate(self) -> bool:
        """BCF requires SUPP_CALLERS aggregation.

        BCF files have multiple records per variant (one per caller),
        so we need to aggregate PRIMARY_CALLER into SUPP_CALLERS.

        Returns:
            True (aggregation required)
        """
        return True
