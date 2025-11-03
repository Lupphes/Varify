"""
General VCF Processor

Applies universal normalizations that apply to ALL VCF files regardless of caller:
- SVLEN normalization (convert to absolute value)
- String parsing and cleanup
- Basic validation

These are minimal, caller-agnostic transformations.
"""

from typing import Any, Dict, Optional

import vcfpy


class GeneralProcessor:
    """Applies universal normalizations to VCF records."""

    @staticmethod
    def normalize_svlen(svlen: Any) -> Optional[int]:
        """Normalize SVLEN to absolute value integer.

        Args:
            svlen: Raw SVLEN value from INFO field (may be list, string, int, negative)

        Returns:
            Absolute integer value of SVLEN, or None if invalid
        """
        if svlen is None:
            return None

        try:
            if isinstance(svlen, list):
                if not svlen:
                    return None
                svlen = svlen[0]

            return abs(int(svlen))
        except (ValueError, TypeError, IndexError):
            return None

    @staticmethod
    def extract_core_fields(record: vcfpy.Record) -> Dict[str, Any]:
        """Extract core VCF fields that are common to all records.

        Args:
            record: VCF record

        Returns:
            Dictionary with core fields (CHROM, POS, ID, REF, ALT, QUAL, FILTER)
        """
        return {
            "CHROM": record.CHROM,
            "POSITION": record.POS,
            "ID": record.ID[0] if record.ID else None,
            "REF": record.REF,
            "ALT": (
                ",".join(
                    alt.serialize() if hasattr(alt, "serialize") else str(alt) for alt in record.ALT
                )
                if record.ALT
                else None
            ),
            "QUAL": record.QUAL,
            "FILTER": ";".join(record.FILTER) if record.FILTER else None,
        }

    @staticmethod
    def extract_basic_info_fields(info: Dict[str, Any]) -> Dict[str, Any]:
        """Extract basic INFO fields common to structural variants.

        These are fields that appear in most SV VCF files regardless of caller.

        Args:
            info: INFO field dictionary from VCF record

        Returns:
            Dictionary with basic INFO fields
        """
        return {
            "SVTYPE": info.get("SVTYPE"),
            "SVLEN": info.get("SVLEN"),
            "END": info.get("END"),
            "IMPRECISE": "IMPRECISE" in info and info["IMPRECISE"] is not None,
            "PRECISE": "PRECISE" in info and info["PRECISE"] is not None,
            "CHROM2": info.get("CHR2"),
            "MATE_ID": info.get("MATEID"),
            "HOMLEN": info.get("HOMLEN"),
            "HOMSEQ": info.get("HOMSEQ"),
        }

    @staticmethod
    def validate_required_fields(record_data: Dict[str, Any]) -> bool:
        """Validate that required fields are present.

        Args:
            record_data: Dictionary with extracted record data

        Returns:
            True if valid, False otherwise
        """
        if record_data.get("SVLEN") is None:
            return False
        if record_data.get("SVTYPE") is None:
            return False

        return True
