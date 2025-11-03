"""
VCF File Parser for Structural Variants

Parses VCF files using modular pipeline architecture:
- VcfReader: Reads VCF file
- GeneralProcessor: Applies universal normalizations
- CallerProcessor: Delegates to caller-specific processing
- VcfTypeHandler: Handles BCF vs SURVIVOR differences
- Aggregator: Computes aggregate fields

Supports both BCF and SURVIVOR formats with extensible caller system.
"""

from typing import List, Tuple, Dict, Any, Optional
from enum import Enum
import pandas as pd

from .callers.base import AbstractVariantCaller
from .callers import (
    SnifflesVariantCaller,
    TIDDITVariantCaller,
    DysguVariantCaller,
    CuteSVVariantCaller,
    GridssVariantCaller,
    GenericVariantCaller,
)
from .pipeline import (
    VcfReader,
    GeneralProcessor,
    CallerProcessor,
    Aggregator,
    VcfWriter,
)
from .vcf_types import VcfTypeHandler, BCFHandler, SURVIVORHandler


class VcfType(Enum):
    """Type of VCF file being parsed."""

    BCF = "bcf"
    SURVIVOR = "survivor"


def _get_caller_for_variant(primary_caller: Optional[str]) -> AbstractVariantCaller:
    """Get appropriate caller class based on PRIMARY_CALLER name.

    Maps caller names (case-insensitive) to their specific caller implementations.
    Falls back to GenericVariantCaller if caller is unknown or None.

    Args:
        primary_caller: Name of the caller (e.g., "sniffles", "cuteSV", "TIDDIT", "gridss")

    Returns:
        AbstractVariantCaller implementation for the caller
    """
    if not primary_caller:
        return GenericVariantCaller()

    caller_lower = primary_caller.lower()

    if "sniffles" in caller_lower:
        return SnifflesVariantCaller()
    elif "tiddit" in caller_lower:
        return TIDDITVariantCaller()
    elif "dysgu" in caller_lower:
        return DysguVariantCaller()
    elif "cutesv" in caller_lower:
        return CuteSVVariantCaller()
    elif "gridss" in caller_lower:
        return GridssVariantCaller()
    else:
        # Unknown caller, use generic
        return GenericVariantCaller()


def parse_vcf(file_path: str, label: VcfType = VcfType.BCF) -> Tuple[pd.DataFrame, List[str]]:
    """Parse a VCF file using modular pipeline architecture.

    Pipeline stages:
    1. Read VCF file (VcfReader)
    2. Detect caller for each variant (VcfTypeHandler)
    3. Apply general normalizations (GeneralProcessor)
    4. Apply caller-specific processing (CallerProcessor with detected caller)
    5. Apply VCF type-specific processing (VcfTypeHandler)
    6. Aggregate SUPP_CALLERS if needed (Aggregator)

    Args:
        file_path: Path to the VCF file
        label: Type of VCF file (BCF or SURVIVOR)

    Returns:
        Tuple containing:
            - DataFrame with parsed VCF records
            - List of INFO column names from header
    """
    # Initialize pipeline components
    vcf_reader = VcfReader(file_path)

    # Initialize processors
    general_processor = GeneralProcessor()

    # Initialize VCF type handler (BCF vs SURVIVOR)
    vcf_type_handler: VcfTypeHandler = BCFHandler() if label == VcfType.BCF else SURVIVORHandler()

    # Extract header info
    info_columns = vcf_reader.get_info_columns()
    samples = vcf_reader.samples

    # Process records through pipeline
    records: List[Dict[str, Any]] = []
    total_records = 0

    for idx, record in vcf_reader.read_records():
        total_records += 1
        info = record.INFO

        # Stage 1: Extract core fields (general processing)
        core_fields = general_processor.extract_core_fields(record)
        core_fields["unique_id"] = idx

        # Stage 2: Extract basic INFO fields (general processing)
        basic_info = general_processor.extract_basic_info_fields(info)
        core_fields.update(basic_info)

        # Stage 3: Normalize SVLEN (general processing)
        svlen_normalized = general_processor.normalize_svlen(core_fields.get("SVLEN"))
        core_fields["SVLEN"] = svlen_normalized

        # Stage 4: Detect caller for this specific variant
        # Extract PRIMARY_CALLER using type-specific handler
        primary_caller = vcf_type_handler.extract_primary_caller(info, record)

        # Get appropriate caller class based on PRIMARY_CALLER
        caller = _get_caller_for_variant(primary_caller)
        caller_processor = CallerProcessor(caller)

        # Stage 5: Caller-specific processing
        record_data = caller_processor.process_record(record, info, core_fields)

        # Stage 6: VCF type-specific processing
        type_specific_fields = vcf_type_handler.extract_type_specific_fields(info, record)
        record_data.update(type_specific_fields)

        # Always set PRIMARY_CALLER (even if None) to ensure column exists in DataFrame
        record_data["PRIMARY_CALLER"] = primary_caller

        # Stage 7: Process sample FORMAT fields
        sample_fields = vcf_type_handler.process_sample_fields(record, samples)
        record_data.update(sample_fields)

        records.append(record_data)

    # Close reader
    vcf_reader.close()

    # Convert to DataFrame
    result = pd.DataFrame(records)

    # Handle empty result - just return empty DataFrame
    # Writer will handle empty DataFrames gracefully with a warning
    if result.empty:
        return result, info_columns

    # Stage 8: Validate and filter records (in Aggregator)
    result, excluded_records, invalid_records = Aggregator.validate_and_filter(result)

    # Stage 9: Aggregate SUPP_CALLERS if needed (BCF only)
    if vcf_type_handler.should_aggregate():
        result = Aggregator.aggregate(result)

    # Print statistics
    Aggregator.print_statistics(result, total_records, excluded_records, invalid_records)

    return result, info_columns


def write_enriched_vcf(original_vcf_path: str, df: pd.DataFrame, output_path: str) -> None:
    """Write enriched VCF file with all modified fields from parsing.

    Uses EnrichedVcfWriter from pipeline to handle writing.
    Delegates to pipeline.writer.EnrichedVcfWriter for actual implementation.

    Args:
        original_vcf_path: Path to original VCF file
        df: DataFrame with parsed and computed fields
        output_path: Full path to write enriched VCF (including filename)
    """
    import os

    # Extract directory and filename from output_path
    output_base_dir = os.path.dirname(output_path) or "."
    output_filename = os.path.basename(output_path)

    writer = VcfWriter(
        original_vcf_path=original_vcf_path,
        output_base_dir=output_base_dir,
        df=df,
        subdir="",  # No subdirectory, write directly to output_base_dir
        output_filename=output_filename,
    )
    writer.write()
