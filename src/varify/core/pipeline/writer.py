"""
Enriched VCF Writer

Writes enriched VCF files with all modifications from processing pipeline:
- Original VCF structure preserved
- Modified fields from parsing (SVLEN normalization, etc.)
- Computed aggregate fields (SUPP_CALLERS, PRIMARY_CALLER, NUM_CALLERS)

Uses shared field configuration to avoid hardcoding.
"""

from typing import Dict, Any, Callable, Optional
import os
import pandas as pd
import vcfpy

WRITABLE_INFO_FIELDS: Dict[str, tuple[str, Callable]] = {
    "SVTYPE": ("SVTYPE", str),
    "SVLEN": ("SVLEN", int),
    "END": ("END", int),
    "CHROM2": ("CHR2", str),
    "MATE_ID": ("MATEID", str),
    "HOMLEN": ("HOMLEN", int),
    "HOMSEQ": ("HOMSEQ", str),
    "IMPRECISE": ("IMPRECISE", lambda x: True if x else None),
    "PRECISE": ("PRECISE", lambda x: True if x else None),
}

CONFIDENCE_INTERVAL_FIELDS = ["CIPOS", "CIEND"]


class VcfWriter:
    """Writes enriched VCF files with processed data."""

    def __init__(
        self,
        original_vcf_path: str,
        output_base_dir: str,
        df: Optional[pd.DataFrame] = None,
        subdir: str = "genome_files",
        output_filename: Optional[str] = None,
        prefix: str = "enriched_",
    ):
        """Initialize enriched VCF writer.

        Args:
            original_vcf_path: Path to original VCF file
            output_base_dir: Base output directory
            df: DataFrame with parsed data (if None or empty, no enriched VCF will be written)
            subdir: Subdirectory under output_base_dir for enriched VCF
            output_filename: Optional output filename (without directory path)
            prefix: Prefix to add to original filename if output_filename not provided
        """
        self.original_vcf_path = original_vcf_path
        self.df = df

        self.should_write = df is not None and not df.empty

        if subdir:
            output_dir = os.path.join(output_base_dir, subdir)
        else:
            output_dir = output_base_dir

        if output_filename:
            filename = output_filename
        else:
            original_basename = os.path.basename(original_vcf_path)
            if original_basename.endswith(".gz"):
                original_basename = original_basename[:-3]
            filename = f"{prefix}{original_basename}"

        os.makedirs(output_dir, exist_ok=True)
        self.output_path = os.path.join(output_dir, filename)

    def write_and_compress(self, compress: bool = True, keep_uncompressed: bool = True) -> str:
        """Write enriched VCF, optionally compress and index it.

        Args:
            compress: Whether to compress and index the VCF
            keep_uncompressed: Whether to keep uncompressed VCF if compressing

        Returns:
            Path to final VCF file (compressed if compress=True)
        """
        self.write()

        if compress:
            return self.compress_and_index(keep_uncompressed=keep_uncompressed)
        else:
            return self.output_path

    def write(self) -> None:
        """Write enriched VCF file with all modified fields from parsing.

        Uses the DataFrame provided during initialization.
        If DataFrame is empty/None, writes VCF with original records only (with warning).
        """
        if not self.should_write:
            print(
                f"Warning: No data to enrich (DataFrame is empty/None). Writing VCF with original records only: {self.output_path}"
            )

        with vcfpy.Reader.from_path(self.original_vcf_path) as reader:
            self._add_computed_info_headers(reader.header)

            os.makedirs(
                os.path.dirname(self.output_path) if os.path.dirname(self.output_path) else ".",
                exist_ok=True,
            )

            df_lookup = self._create_lookup(self.df) if self.should_write else {}

            with vcfpy.Writer.from_path(self.output_path, reader.header) as writer:
                for record in reader:
                    self._update_record(record, df_lookup)
                    writer.write_record(record)

        print(f"Wrote enriched VCF to: {self.output_path}")

    def _add_computed_info_headers(self, header: vcfpy.Header) -> None:
        """Add INFO header lines for computed fields.

        Checks if headers already exist to support idempotent operation
        (e.g., re-running Varify on already-enriched VCF files).

        Args:
            header: VCF header to modify
        """
        existing_info_ids = header.info_ids()

        if "SUPP_CALLERS" not in existing_info_ids:
            header.add_info_line(
                vcfpy.OrderedDict(
                    [
                        ("ID", "SUPP_CALLERS"),
                        ("Number", "."),
                        ("Type", "String"),
                        ("Description", "Comma-separated list of supporting callers (computed)"),
                    ]
                )
            )

        if "PRIMARY_CALLER" not in existing_info_ids:
            header.add_info_line(
                vcfpy.OrderedDict(
                    [
                        ("ID", "PRIMARY_CALLER"),
                        ("Number", "1"),
                        ("Type", "String"),
                        ("Description", "Primary variant caller (computed)"),
                    ]
                )
            )

        if "NUM_CALLERS" not in existing_info_ids:
            header.add_info_line(
                vcfpy.OrderedDict(
                    [
                        ("ID", "NUM_CALLERS"),
                        ("Number", "1"),
                        ("Type", "Integer"),
                        ("Description", "Number of callers supporting this variant (computed)"),
                    ]
                )
            )

    def _create_lookup(self, df: pd.DataFrame) -> Dict[tuple, Any]:
        """Create lookup dictionary from DataFrame.

        Args:
            df: DataFrame with parsed VCF data

        Returns:
            Dictionary mapping (CHROM, POSITION) to row data
        """
        df_lookup = {}
        for _, row in df.iterrows():
            key = (str(row["CHROM"]), int(row["POSITION"]))
            df_lookup[key] = row
        return df_lookup

    def _update_record(self, record: vcfpy.Record, df_lookup: Dict[tuple, Any]) -> None:
        """Update VCF record with data from DataFrame.

        Args:
            record: VCF record to update
            df_lookup: Lookup dictionary from DataFrame
        """
        key = (record.CHROM, record.POS)
        if key not in df_lookup:
            return

        row_data = df_lookup[key]

        for df_col, (vcf_field, converter) in WRITABLE_INFO_FIELDS.items():
            if df_col in row_data:
                try:
                    if pd.notna(row_data[df_col]):
                        value = converter(row_data[df_col])
                        if value is not None:
                            record.INFO[vcf_field] = value
                except (ValueError, TypeError):
                    pass

        self._update_confidence_intervals(record, row_data)

        self._update_caller_fields(record, row_data)

        self._update_format_fields(record, row_data)

    def _update_confidence_intervals(self, record: vcfpy.Record, row_data: Any) -> None:
        """Update confidence interval fields in record.

        Args:
            record: VCF record to update
            row_data: Row data from DataFrame
        """
        for ci_field in CONFIDENCE_INTERVAL_FIELDS:
            if ci_field not in row_data:
                continue

            ci_value = row_data[ci_field]

            if ci_value is None:
                continue

            try:
                if pd.isna(ci_value):
                    continue
            except (ValueError, TypeError):
                pass

            if isinstance(ci_value, str):
                ci_value = ci_value.strip("()").split(",")
                ci_value = [int(x.strip()) for x in ci_value]

            record.INFO[ci_field] = ci_value

    def _update_caller_fields(self, record: vcfpy.Record, row_data: Any) -> None:
        """Update computed caller fields in record.

        Args:
            record: VCF record to update
            row_data: Row data from DataFrame
        """
        if "SUPP_CALLERS" in row_data and pd.notna(row_data["SUPP_CALLERS"]):
            supp_callers_str = str(row_data["SUPP_CALLERS"])
            record.INFO["SUPP_CALLERS"] = supp_callers_str.split(",")

            num_callers = len([c for c in supp_callers_str.split(",") if c.strip()])
            record.INFO["NUM_CALLERS"] = num_callers

        if "PRIMARY_CALLER" in row_data and pd.notna(row_data["PRIMARY_CALLER"]):
            record.INFO["PRIMARY_CALLER"] = str(row_data["PRIMARY_CALLER"])

    def _update_format_fields(self, record: vcfpy.Record, row_data: Any) -> None:
        """Update FORMAT sample fields with cleaned values from DataFrame.

        For BCF: DataFrame has single-sample values (BCF has 1 sample)
        For SURVIVOR: DataFrame has single values from active sample (selected via SUPP_VEC)

        Both cases: DataFrame stores single values, not pipe-separated.
        We write these values to the appropriate sample(s) in the VCF record.

        Special case: FORMAT ID field is not in DataFrame (naming conflict with VCF ID column),
        so we clean it directly from the record by normalizing NaN variants to '.'.

        Args:
            record: VCF record to update
            row_data: Row data from DataFrame
        """
        if not record.calls:
            return

        format_fields_to_update = [
            "GT",
            "PSV",
            "LN",
            "DR",
            "ST",
            "QV",
            "TY",
            "RAL",
            "AAL",
            "CO",
            "PR",
            "SR",
            "GQ",
            "AF",
            "AD",
            "DP",
            "GQ",
            "LO",
            "LR",
            "PE",
            "PL",
        ]

        num_samples = len(record.calls)

        target_sample_idx = 0
        if num_samples > 1:
            supp_vec = record.INFO.get("SUPP_VEC", "")
            for i, bit in enumerate(str(supp_vec)):
                if bit == "1":
                    target_sample_idx = i
                    break

        for field in format_fields_to_update:
            if field not in row_data:
                continue

            field_value = row_data[field]

            if field_value is None or (isinstance(field_value, float) and pd.isna(field_value)):
                continue

            if isinstance(field_value, str) and field_value.upper() in ("NAN", "NA", "NULL"):
                field_value = "."

            if field_value == "-":
                continue

            if isinstance(field_value, str) and " | " in field_value:
                continue

            if target_sample_idx < num_samples and field in record.calls[target_sample_idx].data:
                original_value = record.calls[target_sample_idx].data[field]

                if isinstance(original_value, list):
                    if isinstance(field_value, str) and "," in field_value:
                        values = [v if v != "None" else "." for v in field_value.split(",")]
                        record.calls[target_sample_idx].data[field] = values
                    else:
                        record.calls[target_sample_idx].data[field] = (
                            [field_value] if field_value != "." else original_value
                        )

                    if isinstance(record.calls[target_sample_idx].data[field], list):
                        record.calls[target_sample_idx].data[field] = [
                            "." if v is None else v
                            for v in record.calls[target_sample_idx].data[field]
                        ]
                else:
                    record.calls[target_sample_idx].data[field] = field_value

        for sample_idx in range(num_samples):
            if "ID" in record.calls[sample_idx].data:
                value = record.calls[sample_idx].data["ID"]

                if isinstance(value, str) and value.upper() in ("NAN", "NA"):
                    record.calls[sample_idx].data["ID"] = "."

    def compress_and_index(self, keep_uncompressed: bool = True) -> str:
        """Compress VCF with bgzip and create tabix index.

        Args:
            keep_uncompressed: Whether to keep the uncompressed VCF file

        Returns:
            Path to compressed .vcf.gz file
        """
        import pysam

        vcf_path = self.output_path

        sorted_vcf_path = f"{vcf_path}.sorted"
        try:
            reader = vcfpy.Reader.from_path(vcf_path)
            writer = vcfpy.Writer.from_path(sorted_vcf_path, reader.header)

            records = list(reader)

            records.sort(key=lambda r: (r.CHROM, r.POS))

            for record in records:
                writer.write_record(record)

            writer.close()
            reader.close()

            os.replace(sorted_vcf_path, vcf_path)
        except Exception as e:
            print(f"Warning: Could not sort VCF file: {e}")
            if os.path.exists(sorted_vcf_path):
                os.remove(sorted_vcf_path)

        compressed_path = f"{vcf_path}.gz"

        pysam.tabix_compress(vcf_path, compressed_path, force=True)

        try:
            pysam.tabix_index(compressed_path, preset="vcf", force=True)
        except Exception as e:
            print(f"Warning: Could not create tabix index: {e}")
            print(f"  VCF file may not be properly sorted")

        if keep_uncompressed:
            print(f"Compressed and indexed enriched VCF: {compressed_path}")
            print(f"Kept uncompressed VCF for browser table: {vcf_path}")
        else:
            os.remove(vcf_path)
            print(f"Compressed and indexed enriched VCF: {compressed_path}")
            print(f"Removed uncompressed VCF to save space")

        return compressed_path
