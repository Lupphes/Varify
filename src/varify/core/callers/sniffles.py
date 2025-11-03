"""
Sniffles Variant Caller Implementation

Handles Sniffles-specific INFO fields and confidence interval calculations.
Sniffles uses CIPOS_STD and CIEND_STD (standard deviation) format.
"""

from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import vcfpy

from .base import AbstractVariantCaller


class SnifflesVariantCaller(AbstractVariantCaller):
    """Sniffles structural variant caller implementation."""

    @property
    def name(self) -> str:
        return "sniffles"

    def parse_info_fields(self, info: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Sniffles-specific INFO fields.

        Sniffles provides:
        - CIPOS_STD, CIEND_STD: Standard deviation for position confidence
        - SUPPORT: Number of supporting reads
        - RNAMES: Read names supporting the variant

        Args:
            info: Raw INFO field dictionary from VCF record

        Returns:
            Dictionary with parsed INFO fields
        """
        parsed = {}

        for key, value in info.items():
            parsed[key] = value

        if "SUPPORT" in info:
            parsed["SUPPORT"] = int(info["SUPPORT"]) if info["SUPPORT"] else None

        if "RNAMES" in info:
            rnames = info["RNAMES"]
            if isinstance(rnames, list):
                parsed["NUM_RNAMES"] = len(rnames)
            elif isinstance(rnames, str):
                parsed["NUM_RNAMES"] = len(rnames.split(","))

        return parsed

    def calculate_confidence_intervals(
        self, info: Dict[str, Any], record: vcfpy.Record
    ) -> Tuple[Optional[List[int]], Optional[List[int]]]:
        """Calculate confidence intervals using Sniffles standard deviation format.

        Sniffles provides CIPOS_STD and CIEND_STD which are standard deviations.
        We calculate 95% CI as position ± 2*std.

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

        if "CIPOS_STD" in info:
            std = info.get("CIPOS_STD")
            if isinstance(std, list):
                std = std[0]
            try:
                std_float = float(std)
                cipos = [
                    int(record.POS - 2 * std_float),
                    int(record.POS + 2 * std_float),
                ]
            except (ValueError, TypeError):
                pass

        if "CIEND_STD" in info:
            std = info.get("CIEND_STD")
            if isinstance(std, list):
                std = std[0]
            try:
                end_pos = float(info.get("END", 0))
                std_float = float(std)
                ciend = [
                    int(end_pos - 2 * std_float),
                    int(end_pos + 2 * std_float),
                ]
            except (ValueError, TypeError):
                pass

        return cipos, ciend
