"""
Abstract Base Class for Variant Callers

Provides interface for caller-specific processing of structural variants.
Each variant caller (Sniffles, TIDDIT, Dysgu, cuteSV, etc.) implements
this interface with their own field parsing and normalization logic.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import vcfpy


class AbstractVariantCaller(ABC):
    """Abstract base class for variant caller implementations."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the name of the variant caller."""
        pass

    @abstractmethod
    def parse_info_fields(self, info: Dict[str, Any]) -> Dict[str, Any]:
        """Parse caller-specific INFO fields into standardized format.

        Args:
            info: Raw INFO field dictionary from VCF record

        Returns:
            Dictionary with parsed/normalized INFO fields
        """
        pass

    @abstractmethod
    def calculate_confidence_intervals(
        self, info: Dict[str, Any], record: vcfpy.Record
    ) -> Tuple[Optional[List[int]], Optional[List[int]]]:
        """Calculate confidence intervals for variant positions.

        Args:
            info: INFO field dictionary from VCF record
            record: VCF record object

        Returns:
            Tuple of (cipos, ciend) containing confidence intervals.
            Each CI is a list of [lower_bound, upper_bound] or None.
        """
        pass

    def normalize_svlen(self, svlen: Any) -> Optional[int]:
        """Normalize SVLEN value to absolute integer.

        Default implementation converts to absolute value.
        Can be overridden for caller-specific normalization.

        Args:
            svlen: Raw SVLEN value from INFO field

        Returns:
            Normalized SVLEN as absolute integer, or None if invalid
        """
        if svlen is None:
            return None

        try:
            if isinstance(svlen, list):
                svlen = svlen[0]

            return abs(int(svlen))
        except (ValueError, TypeError):
            return None

    def extract_primary_caller(
        self, info: Dict[str, Any], id_value: Optional[str]
    ) -> Optional[str]:
        """Extract primary caller name from INFO fields or ID.

        Default implementation looks for common caller fields.
        Should be overridden for caller-specific extraction logic.

        Args:
            info: INFO field dictionary from VCF record
            id_value: ID field value from VCF record

        Returns:
            Primary caller name, or None if not found
        """
        return info.get("EUK_CALLER") or info.get("CALLER") or None

    def normalize_fields(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normalize DataFrame fields to standard format.

        This method can be overridden by subclasses to perform
        caller-specific normalization after parsing.

        Args:
            df: DataFrame with parsed VCF data

        Returns:
            DataFrame with normalized fields
        """
        return df
