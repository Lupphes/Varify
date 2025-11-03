"""
VCF Processor Class

Handles VCF processing pipeline including parsing and stats generation.
Eliminates duplication between BCF and SURVIVOR processing workflows.
"""

import os
from typing import Optional, Tuple
import pandas as pd

from .vcf_parser import parse_vcf, VcfType
from .pipeline import VcfWriter


class VcfProcessor:
    """Processes VCF files with unified pipeline for BCF and SURVIVOR types."""

    def __init__(self, vcf_type: VcfType, vcf_path: str, output_dir: str):
        """Initialize VCF processor.

        Args:
            vcf_type: Type of VCF file (BCF or SURVIVOR)
            vcf_path: Path to VCF file
            output_dir: Output directory for generated files
        """
        self.vcf_type = vcf_type
        self.vcf_path = vcf_path
        self.output_dir = output_dir

    def process(
        self, stats_file: Optional[str] = None
    ) -> Tuple[Optional[pd.DataFrame], Optional[dict], Optional[dict], Optional[str]]:
        """Process VCF file and parse stats.

        Args:
            stats_file: Path to stats file (bcftools.stats or survivor.stats)

        Returns:
            Tuple of (dataframe, stats_dict, None, enriched_vcf_path)
            Note: plots_dict is always None (plot generation removed)
        """
        if not os.path.exists(self.vcf_path):
            raise FileNotFoundError(f"VCF file '{self.vcf_path}' does not exist.")

        df, _ = parse_vcf(self.vcf_path, label=self.vcf_type)
        os.makedirs(self.output_dir, exist_ok=True)

        writer = VcfWriter(
            original_vcf_path=self.vcf_path,
            output_base_dir=self.output_dir,
            df=df,
            subdir="genome_files",
            prefix="enriched_",
        )
        self.enriched_vcf_path = writer.write_and_compress(compress=True, keep_uncompressed=True)

        return df, None, None, self.enriched_vcf_path
