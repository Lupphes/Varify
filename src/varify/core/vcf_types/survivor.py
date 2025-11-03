"""
SURVIVOR VCF Type Handler

Handles SURVIVOR merge output format:
- PRIMARY_CALLER extracted from ID field (format: callername_SVTYPE)
- SUPP_CALLERS from sample ID fields
- Additional SURVIVOR-specific fields (SUPP_VEC, STRANDS, SVMETHOD)
"""

from typing import Any, Dict, Optional

from .base import VcfRecordType, VcfTypeHandler


class SURVIVORHandler(VcfTypeHandler):
    """Handler for SURVIVOR merge VCF format."""

    def extract_primary_caller(self, info: Dict[str, Any], record: VcfRecordType) -> Optional[str]:
        """Extract primary caller from SURVIVOR ID field.

        SURVIVOR format: ID = callername_SVTYPE (e.g., "sniffles_DEL")

        Args:
            info: INFO field dictionary
            record: VCF record

        Returns:
            Primary caller name extracted from ID field
        """
        id_value = record.ID[0] if record.ID else None
        if id_value and "_" in id_value:
            return id_value.split("_")[0]
        return None

    def extract_type_specific_fields(
        self, info: Dict[str, Any], record: VcfRecordType
    ) -> Dict[str, Any]:
        """Extract SURVIVOR-specific fields.

        SURVIVOR provides:
        - SUPP_VEC: Support vector (which callers support the variant)
        - STRANDS: Strand information
        - SVMETHOD: SV detection method
        - SVTYPE: Can be extracted from ID if not in INFO
        - Callers: Extracted from sample ID fields

        Args:
            info: INFO field dictionary
            record: VCF record

        Returns:
            Dictionary with SURVIVOR-specific fields
        """
        fields = {
            "SUPP_VEC": info.get("SUPP_VEC"),
            "STRANDS": info.get("STRANDS"),
            "SVMETHOD": info.get("SVMETHOD"),
        }

        # Extract SVTYPE from ID if present
        id_value = record.ID[0] if record.ID else None
        if id_value and "_" in id_value:
            svtype = id_value.split("_")[1]
            fields["SVTYPE"] = svtype

        # Extract callers from sample ID fields
        callers_sorted = sorted(
            {
                call.data.get("ID", "").split("_")[0]
                for call in record.calls
                if "ID" in call.data and "_" in call.data["ID"]
            }
        )
        if callers_sorted:
            fields["SUPP_CALLERS"] = ", ".join(callers_sorted)

        return fields

    def should_aggregate(self) -> bool:
        """SURVIVOR does not require SUPP_CALLERS aggregation.

        SURVIVOR files already have SUPP_CALLERS info from sample fields.

        Returns:
            False (no aggregation needed)
        """
        return False

    def process_sample_fields(self, record: VcfRecordType, samples: list) -> Dict[str, Any]:
        """Process FORMAT fields for SURVIVOR - use SUPP_VEC to select active sample.

        SURVIVOR merge stores one sample per caller position. SUPP_VEC indicates which
        sample has actual data for this variant.

        Example: SUPP_VEC=00100000000000 means sample 2 (index 2) has the actual data,
        while all other samples have NaN/missing values.

        Currently returns FORMAT fields from FIRST active sample only.

        TODO: Future Enhancement - Multi-Caller Expandable Rows
        For variants with multiple callers (SUPP_VEC has multiple 1s), consider
        storing all callers' FORMAT values for JavaScript expandable rows.
        This would allow users to expand a row and compare quality metrics across
        all callers (e.g., delly: QV=162 vs dysgu: QV=1).
        See docs/multi-caller-display-strategy.md for detailed implementation plan.

        This makes SURVIVOR behave like BCF (single sample with data), allowing unified
        JavaScript handling.

        Args:
            record: VCF record
            samples: List of sample names

        Returns:
            Dictionary with FORMAT field values from the active sample
            (single values, not pipe-separated)
        """
        import pandas as pd

        # Get SUPP_VEC from INFO to find active sample
        supp_vec = record.INFO.get("SUPP_VEC", "")

        # Find first sample with data (first '1' in SUPP_VEC)
        active_sample_idx = 0
        for i, bit in enumerate(str(supp_vec)):
            if bit == "1":
                active_sample_idx = i
                break

        # Extract FORMAT fields from active sample only
        sample_data = {}
        if active_sample_idx < len(record.calls):
            call = record.calls[active_sample_idx]

            for field in record.FORMAT:
                # Skip ID field to avoid collision with standard VCF ID column
                if field == "ID":
                    continue

                value = call.data.get(field)

                # Handle list values - join with comma to preserve all values
                if isinstance(value, list):
                    value = ",".join(str(v) for v in value) if value else None

                # Normalize NaN variants to '.'
                if (
                    value is None
                    or (isinstance(value, float) and pd.isna(value))
                    or (isinstance(value, str) and value.upper() in ("NULL", "NAN", "NA"))
                ):
                    sample_data[field] = "."
                else:
                    sample_data[field] = str(value)

        # Set required FORMAT fields to '-' if missing
        required_format_fields = {"GT", "PR", "SR", "GQ"}
        for field in required_format_fields:
            if field not in sample_data:
                sample_data[field] = "-"

        return sample_data
