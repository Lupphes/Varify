"""
TIDDIT Variant Caller Implementation

Handles TIDDIT-specific INFO fields and confidence interval calculations.
TIDDIT uses CIPOS_REG and CIEND_REG (direct interval) format.
"""

from typing import Any, Dict, List, Optional, Tuple

import vcfpy

from .base import AbstractVariantCaller


class TIDDITVariantCaller(AbstractVariantCaller):
    """TIDDIT structural variant caller implementation."""

    @property
    def name(self) -> str:
        return "TIDDIT"

    def parse_info_fields(self, info: Dict[str, Any]) -> Dict[str, Any]:
        """Parse TIDDIT-specific INFO fields.

        TIDDIT provides:
        - CIPOS_REG, CIEND_REG: Direct confidence interval regions
        - CILEN: Confidence interval length
        - OA: Original orientation of the read

        Args:
            info: Raw INFO field dictionary from VCF record

        Returns:
            Dictionary with parsed INFO fields
        """
        parsed = {}

        for key, value in info.items():
            parsed[key] = value

        if "CILEN" in info:
            cilen = info["CILEN"]
            if isinstance(cilen, list) and len(cilen) >= 2:
                parsed["CILEN_MIN"] = int(cilen[0]) if cilen[0] else None
                parsed["CILEN_MAX"] = int(cilen[1]) if cilen[1] else None
            elif cilen:
                parsed["CILEN"] = int(cilen)

        if "OA" in info:
            parsed["OA"] = str(info["OA"])

        return parsed

    def calculate_confidence_intervals(
        self, info: Dict[str, Any], record: vcfpy.Record
    ) -> Tuple[Optional[List[int]], Optional[List[int]]]:
        """Calculate confidence intervals using TIDDIT direct interval format.

        TIDDIT provides CIPOS_REG and CIEND_REG as direct interval values.

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

        if "CIPOS_REG" in info:
            reg = info.get("CIPOS_REG")
            if isinstance(reg, str):
                try:
                    start, end = map(int, reg.split(","))
                    cipos = [start, end]
                except (ValueError, TypeError):
                    pass
            elif isinstance(reg, list) and len(reg) >= 2:
                try:
                    cipos = [int(reg[0]), int(reg[1])]
                except (ValueError, TypeError, IndexError):
                    pass

        if "CIEND_REG" in info:
            reg = info.get("CIEND_REG")
            if isinstance(reg, str):
                try:
                    start, end = map(int, reg.split(","))
                    ciend = [start, end]
                except (ValueError, TypeError):
                    pass
            elif isinstance(reg, list) and len(reg) >= 2:
                try:
                    ciend = [int(reg[0]), int(reg[1])]
                except (ValueError, TypeError, IndexError):
                    pass

        return cipos, ciend
