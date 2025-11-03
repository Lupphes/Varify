"""
Caller-Specific Processor

Delegates to caller classes for caller-specific processing:
- Caller-specific field parsing
- Caller-specific normalization
- Confidence interval calculation
- Primary caller extraction

Uses the AbstractVariantCaller interface for extensibility.
"""

from typing import Any, Dict

import vcfpy

from ..callers.base import AbstractVariantCaller


class CallerProcessor:
    """Processes VCF records using caller-specific logic."""

    def __init__(self, caller: AbstractVariantCaller):
        """Initialize caller processor.

        Args:
            caller: Variant caller implementation
        """
        self.caller = caller

    def process_record(
        self, record: vcfpy.Record, info: Dict[str, Any], base_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Process a VCF record using caller-specific logic.

        Args:
            record: VCF record
            info: INFO field dictionary
            base_data: Base record data from general processing

        Returns:
            Dictionary with caller-specific fields added
        """
        record_data = base_data.copy()

        parsed_info = self.caller.parse_info_fields(info)
        record_data.update(parsed_info)

        cipos, ciend = self.caller.calculate_confidence_intervals(info, record)
        record_data["CIPOS"] = cipos
        record_data["CIEND"] = ciend

        if hasattr(self.caller, "normalize_svlen") and callable(self.caller.normalize_svlen):
            svlen_normalized = self.caller.normalize_svlen(info.get("SVLEN"))
            if svlen_normalized is not None:
                record_data["SVLEN"] = svlen_normalized

        if hasattr(self.caller, "extract_primary_caller") and callable(
            self.caller.extract_primary_caller
        ):
            primary_caller = self.caller.extract_primary_caller(info, record_data.get("ID"))
            if primary_caller:
                record_data["PRIMARY_CALLER"] = primary_caller

        return record_data
