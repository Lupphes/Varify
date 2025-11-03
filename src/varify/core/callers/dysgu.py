"""
Dysgu Variant Caller Implementation

Handles Dysgu-specific INFO fields and confidence interval calculations.
Dysgu uses CIPOS95 and CIEND95 (95% CI size) format.
"""

from typing import Any, Dict, List, Optional, Tuple

import vcfpy

from .base import AbstractVariantCaller


class DysguVariantCaller(AbstractVariantCaller):
    """Dysgu structural variant caller implementation."""

    @property
    def name(self) -> str:
        return "Dysgu"

    def parse_info_fields(self, info: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Dysgu-specific INFO fields.

        Dysgu provides:
        - CIPOS95, CIEND95: 95% confidence interval sizes
        - NMP: Number of mismatched positions
        - MAPQ: Mean mapping quality
        - SVLEN: Length of structural variant

        Args:
            info: Raw INFO field dictionary from VCF record

        Returns:
            Dictionary with parsed INFO fields
        """
        parsed = {}

        for key, value in info.items():
            parsed[key] = value

        if "NMP" in info:
            nmp = info["NMP"]
            if isinstance(nmp, list):
                nmp = nmp[0]
            try:
                parsed["NMP"] = int(nmp) if nmp else None
            except (ValueError, TypeError):
                parsed["NMP"] = None

        if "MAPQ" in info:
            mapq = info["MAPQ"]
            if isinstance(mapq, list):
                mapq = mapq[0]
            try:
                parsed["MAPQ"] = float(mapq) if mapq else None
            except (ValueError, TypeError):
                parsed["MAPQ"] = None

        return parsed

    def calculate_confidence_intervals(
        self, info: Dict[str, Any], record: vcfpy.Record
    ) -> Tuple[Optional[List[int]], Optional[List[int]]]:
        """Calculate confidence intervals using Dysgu 95% CI size format.

        Dysgu provides CIPOS95 and CIEND95 which are the sizes of the 95% CI.
        We calculate the interval as position ± (size/2).

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

        if "CIPOS95" in info:
            size = info.get("CIPOS95")
            if isinstance(size, list):
                size = size[0]
            try:
                half_size = int(size) // 2
                cipos = [record.POS - half_size, record.POS + half_size]
            except (ValueError, TypeError):
                pass

        if "CIEND95" in info:
            size = info.get("CIEND95")
            if isinstance(size, list):
                size = size[0]
            try:
                end_pos = int(info.get("END", 0))
                half_size = int(size) // 2
                ciend = [end_pos - half_size, end_pos + half_size]
            except (ValueError, TypeError):
                pass

        return cipos, ciend
