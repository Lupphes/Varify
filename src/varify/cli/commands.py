"""
CLI commands for Varify.
"""

import os
import argparse

from ..core import VcfType, VcfProcessor
from ..reporting.html_generator import generate_combined_report


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments for Varify."""
    parser = argparse.ArgumentParser(description="Generate structural variant reports.")

    parser.add_argument("--output-dir", required=False, default="out/", help="Output directory")
    parser.add_argument("--bcf-vcf-file", required=False, help="BCF merged VCF")
    parser.add_argument("--survivor-vcf-file", required=False, help="SURVIVOR merged VCF")
    parser.add_argument("--sample-vcf-files", nargs="+", help="Optional additional sample VCFs")
    parser.add_argument("--bam-files", nargs="+", help="BAM files for IGV")
    parser.add_argument("--fasta-file", required=True, help="Reference FASTA")
    parser.add_argument(
        "--bcf-stats-file", required=False, help="bcftools stats for BCF merged VCF"
    )
    parser.add_argument("--survivor-stats-file", required=False, help="SURVIVOR stats")
    parser.add_argument(
        "--report-file",
        required=False,
        default="varify_report.html",
        help="Filename for the combined HTML report (saved in output_dir)",
    )
    parser.add_argument("--profile", default="default", help="Profile run from the pipeline")

    return parser.parse_args()


def main() -> None:
    """Main entry point for Varify CLI."""
    args = parse_args()

    print("\n--- Starting Report Generation ---\n")

    # Initialize defaults
    bcf_df, bcf_enriched_vcf = None, None
    survivor_df, survivor_enriched_vcf = None, None

    # Process BCF VCF file
    if args.bcf_vcf_file:
        processor = VcfProcessor(VcfType.BCF, args.bcf_vcf_file, args.output_dir)
        bcf_df, _, _, bcf_enriched_vcf = processor.process(args.bcf_stats_file)

    # Process SURVIVOR VCF file
    if args.survivor_vcf_file:
        processor = VcfProcessor(VcfType.SURVIVOR, args.survivor_vcf_file, args.output_dir)
        survivor_df, _, _, survivor_enriched_vcf = processor.process(args.survivor_stats_file)

    generate_combined_report(
        combined_report_file=os.path.join(args.output_dir, args.report_file),
        bcf_vcf_path=bcf_enriched_vcf or args.bcf_vcf_file,
        survivor_vcf_path=survivor_enriched_vcf or args.survivor_vcf_file,
        fasta_path=args.fasta_file,
        bcf_df=bcf_df,
        survivor_df=survivor_df,
        profiles=args.profile,
        reference_name=args.fasta_file,
        bcf_stats_file=args.bcf_stats_file,
        survivor_stats_file=args.survivor_stats_file,
    )

    print("\n--- Report Generation Complete ---\n")


if __name__ == "__main__":
    main()
