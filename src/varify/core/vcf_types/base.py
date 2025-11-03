"""
Base VCF Type Handler

Abstract interface for handling different VCF merge formats.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Union, TYPE_CHECKING
import pandas as pd

if TYPE_CHECKING:
    import vcfpy

    VcfRecordType = Union[vcfpy.Record, Any]
else:
    VcfRecordType = Any


class VcfTypeHandler(ABC):
    """Abstract base class for VCF type-specific handling."""

    @abstractmethod
    def extract_primary_caller(self, info: Dict[str, Any], record: VcfRecordType) -> Optional[str]:
        """Extract primary caller from VCF record.

        Args:
            info: INFO field dictionary
            record: VCF record

        Returns:
            Primary caller name, or None if not found
        """
        pass

    @abstractmethod
    def extract_type_specific_fields(
        self, info: Dict[str, Any], record: VcfRecordType
    ) -> Dict[str, Any]:
        """Extract VCF type-specific fields.

        Args:
            info: INFO field dictionary
            record: VCF record

        Returns:
            Dictionary with type-specific fields
        """
        pass

    @abstractmethod
    def should_aggregate(self) -> bool:
        """Whether this VCF type requires SUPP_CALLERS aggregation.

        BCF files need aggregation (multiple records per variant).
        SURVIVOR files already have aggregated callers.

        Returns:
            True if aggregation needed, False otherwise
        """
        pass

    def process_sample_fields(self, record: VcfRecordType, samples: list) -> Dict[str, str]:
        """Process FORMAT sample fields.

        Default implementation handles common FORMAT fields.
        Can be overridden for type-specific processing.

        Args:
            record: VCF record
            samples: List of sample names

        Returns:
            Dictionary mapping field names to joined sample values
        """
        sample_data = {}
        format_fields = record.FORMAT

        for field in format_fields:
            if field == "ID":
                continue

            field_values = []
            for sample_idx, sample in enumerate(samples):
                if sample_idx >= len(record.calls):
                    break

                call_data = record.calls[sample_idx].data
                value = call_data.get(field)

                # Handle list values - join with comma to preserve all values
                # Example: DR=[0, 3] becomes "0,3" instead of just "0"
                if isinstance(value, list):
                    value = ",".join(str(v) for v in value) if value else None

                # Convert None/NaN/NULL/NA to '.'
                # Handle all NaN variants (NaN, NAN, nan, NA, etc.)
                if (
                    value is None
                    or (isinstance(value, float) and pd.isna(value))
                    or (isinstance(value, str) and value.upper() in ("NULL", "NAN", "NA"))
                ):
                    field_values.append(".")
                else:
                    field_values.append(str(value))

            # Store joined values or single '.' if all are '.'
            if all(v == "." for v in field_values):
                sample_data[field] = "."
            else:
                sample_data[field] = " | ".join(field_values)

        # Set required FORMAT fields to '-' if missing
        required_format_fields = {"GT", "PR", "SR", "GQ"}
        for field in required_format_fields:
            if field not in format_fields:
                sample_data[field] = "-"

        return sample_data
