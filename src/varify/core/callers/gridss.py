"""
GRIDSS Variant Caller Implementation

Handles GRIDSS-specific VCF format and fields.
GRIDSS represents structural variants as breakends (BND) and may omit SVTYPE
for singleton breakends without mate pairs.
"""

from typing import Dict, Any
from .generic import GenericVariantCaller


class GridssVariantCaller(GenericVariantCaller):
    """GRIDSS-specific variant caller implementation."""

    @property
    def name(self) -> str:
        return "gridss"

    def parse_info_fields(self, info: Dict[str, Any]) -> Dict[str, Any]:
        """Parse INFO fields with GRIDSS-specific handling.

        GRIDSS-specific handling:
        - Infers SVTYPE from ALT field for singleton breakends (no MATEID)
        - Preserves GRIDSS-specific fields (CQ, REFPAIR, SC_GRIDSS, etc.)

        Args:
            info: Raw INFO field dictionary from VCF record

        Returns:
            Dictionary with INFO fields (with SVTYPE inference if needed)
        """
        fields = super().parse_info_fields(info)

        if fields.get("SVTYPE") is None and fields.get("MATEID") is None:
            fields["SVTYPE"] = "BND"

        return fields
