"""
cuteSV Variant Caller Implementation

Handles cuteSV-specific INFO fields and confidence interval calculations.
cuteSV typically uses standard CIPOS/CIEND format.
"""

from typing import Any, Dict, List, Optional, Tuple

import vcfpy

from .base import AbstractVariantCaller


class CuteSVVariantCaller(AbstractVariantCaller):
    """cuteSV structural variant caller implementation."""

    @property
    def name(self) -> str:
        return "cuteSV"

    def parse_info_fields(self, info: Dict[str, Any]) -> Dict[str, Any]:
        """Parse cuteSV-specific INFO fields.

        cuteSV provides:
        - RE: Number of read support
        - STRAND: Strand orientation
        - RNAMES: Supporting read names
        - AF: Allele frequency

        Args:
            info: Raw INFO field dictionary from VCF record

        Returns:
            Dictionary with parsed INFO fields
        """
        parsed = {}

        for key, value in info.items():
            parsed[key] = value

        if "RE" in info:
            re = info["RE"]
            if isinstance(re, list):
                re = re[0]
            try:
                parsed["RE"] = int(re) if re else None
            except (ValueError, TypeError):
                parsed["RE"] = None

        if "STRAND" in info:
            parsed["STRAND"] = str(info["STRAND"])

        if "RNAMES" in info:
            rnames = info["RNAMES"]
            if isinstance(rnames, list):
                parsed["NUM_RNAMES"] = len(rnames)
            elif isinstance(rnames, str):
                parsed["NUM_RNAMES"] = len(rnames.split(","))

        if "AF" in info:
            af = info["AF"]
            if isinstance(af, list):
                af = af[0]
            try:
                parsed["AF"] = float(af) if af else None
            except (ValueError, TypeError):
                parsed["AF"] = None

        return parsed

    def calculate_confidence_intervals(
        self, info: Dict[str, Any], record: vcfpy.Record
    ) -> Tuple[Optional[List[int]], Optional[List[int]]]:
        """Calculate confidence intervals using standard CIPOS/CIEND format.

        cuteSV typically uses the standard VCF format for confidence intervals.

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
                cipos = [int(cipos_raw[0]), int(cipos_raw[1])]

        if "CIEND" in info:
            ciend_raw = info.get("CIEND")
            if isinstance(ciend_raw, list) and len(ciend_raw) >= 2:
                ciend = [int(ciend_raw[0]), int(ciend_raw[1])]

        return cipos, ciend
