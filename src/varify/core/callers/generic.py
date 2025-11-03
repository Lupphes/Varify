"""
Generic Variant Caller Implementation

Fallback implementation for unknown or unsupported variant callers.
Uses standard VCF fields and formats.
"""

from typing import Dict, Any, Optional, List, Tuple
import vcfpy
from .base import AbstractVariantCaller


class GenericVariantCaller(AbstractVariantCaller):
    """Generic/fallback variant caller implementation."""

    @property
    def name(self) -> str:
        return "generic"

    def parse_info_fields(self, info: Dict[str, Any]) -> Dict[str, Any]:
        """Parse INFO fields using standard VCF format.

        No caller-specific processing, just returns fields as-is.

        Args:
            info: Raw INFO field dictionary from VCF record

        Returns:
            Dictionary with INFO fields (unmodified)
        """
        return dict(info)

    def calculate_confidence_intervals(
        self, info: Dict[str, Any], record: vcfpy.Record
    ) -> Tuple[Optional[List[int]], Optional[List[int]]]:
        """Calculate confidence intervals using standard CIPOS/CIEND format.

        Uses only the standard VCF CIPOS and CIEND fields.

        Args:
            info: INFO field dictionary from VCF record
            record: VCF record object

        Returns:
            Tuple of (cipos, ciend) containing confidence intervals
        """
        cipos: Optional[List[int]] = None
        ciend: Optional[List[int]] = None

        if "CIPOS" in info:
            cipos_raw = info.get("CIPOS")
            if isinstance(cipos_raw, list) and len(cipos_raw) >= 2:
                try:
                    cipos = [int(cipos_raw[0]), int(cipos_raw[1])]
                except (ValueError, TypeError):
                    pass

        if "CIEND" in info:
            ciend_raw = info.get("CIEND")
            if isinstance(ciend_raw, list) and len(ciend_raw) >= 2:
                try:
                    ciend = [int(ciend_raw[0]), int(ciend_raw[1])]
                except (ValueError, TypeError):
                    pass

        return cipos, ciend
