import os
import argparse
from typing import Optional, Dict, Tuple, List

import pandas as pd
from jinja2 import Environment, FileSystemLoader

from .parser import parse_vcf, parse_survivor_stats, parse_bcftools_stats, VcfType
from .combine import generate_combined_report
from .plots import (
    plot_sv_type_distribution,
    plot_sv_size_distribution,
    plot_qual_distribution,
    plot_sv_type_vs_size,
    plot_sv_callers,
    plot_sv_primary_callers,
    plot_sv_size_vs_quality,
    plot_sv_type_heatmap,
    plot_cumulative_sv_length,
    plot_bcf_exact_instance_combinations,
    plot_survivor_exact_instance_combinations,
    plot_sv_types_by_caller,
    plot_quality_by_caller,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate structural variant reports.")

    parser.add_argument(
        "--output-dir", required=False, default="out/", help="Output directory"
    )
    parser.add_argument("--bcf-vcf-file", required=False, help="BCF merged VCF")
    parser.add_argument(
        "--survivor-vcf-file", required=False, help="SURVIVOR merged VCF"
    )
    parser.add_argument(
        "--sample-vcf-files", nargs="+", help="Optional additional sample VCFs"
    )
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
    parser.add_argument(
        "--profile", default="default", help="Profile run from the pipeline"
    )
    parser.add_argument(
        "--disable-igv",
        action="store_true",
        default=False,
        help="Disable IGV for optimalization purposes",
    )

    return parser.parse_args()


def plot_caller_combinations(
    df: pd.DataFrame, label: VcfType, output_path: str, subfolder: str = "plots"
) -> Optional[Dict[str, str]]:
    if label == VcfType.SURVIVOR:
        return plot_survivor_exact_instance_combinations(df, output_path, subfolder)
    elif label == VcfType.BCF:
        return plot_bcf_exact_instance_combinations(df, output_path, subfolder)
    print(f"[Warning] Unknown label '{label}' - skipping caller combination plot.")
    return None


def generate_plots(
    df: pd.DataFrame,
    prefix: str,
    output_dir: str,
    label: VcfType,
    subfolder: str = "plots",
    ext: str = "html",
) -> Dict[str, Optional[Dict[str, str]]]:
    """Generate and save all variant plots; return metadata for each plot."""
    plot_dir = os.path.join(output_dir, subfolder)
    os.makedirs(plot_dir, exist_ok=True)

    def out(name: str) -> str:
        return os.path.join(plot_dir, f"{prefix}_{name}.{ext}")

    return {
        "plot_sv_callers": plot_sv_callers(df, out("caller_stats")),
        "plot_sv_primary_callers": plot_sv_primary_callers(
            df, out("primary_caller_stats")
        ),
        "caller_combinations": plot_caller_combinations(
            df, label, out("caller_combinations")
        ),
        "sv_type_distribution": plot_sv_type_distribution(
            df, out("sv_type_distribution")
        ),
        "sv_size_distribution": plot_sv_size_distribution(
            df, out("sv_size_distribution")
        ),
        "qual_distribution": plot_qual_distribution(df, out("qual_distribution")),
        "sv_type_vs_size": plot_sv_type_vs_size(df, out("sv_type_vs_size")),
        "sv_size_vs_quality": plot_sv_size_vs_quality(df, out("sv_size_vs_quality")),
        "sv_type_heatmap": plot_sv_type_heatmap(df, out("sv_type_heatmap")),
        "cumulative_sv_length": plot_cumulative_sv_length(
            df, out("cumulative_sv_length")
        ),
        "sv_types_by_caller": plot_sv_types_by_caller(df, out("sv_types_by_caller")),
        "quality_by_primary_caller": plot_quality_by_caller(
            df, out("quality_by_primary_caller")
        ),
    }


def process_vcf(
    label: VcfType,
    vcf_path: str,
    output_dir: str,
) -> pd.DataFrame:
    """Process VCF file and return DataFrame."""
    if not os.path.exists(vcf_path):
        raise FileNotFoundError(f"VCF file '{vcf_path}' does not exist.")

    df, info_columns = parse_vcf(vcf_path, label=label)
    os.makedirs(output_dir, exist_ok=True)

    return df


def main() -> None:
    args = parse_args()

    print("\n--- Starting Report Generation ---\n")

    env = Environment(
        loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates"))
    )

    # Initialize defaults
    bcf_df, bcf_stats, bcf_plots = None, None, None
    survivor_df, survivor_stats, survivor_plots = None, None, None

    if args.bcf_vcf_file:
        bcf_df = process_vcf(
            VcfType.BCF,
            args.bcf_vcf_file,
            args.output_dir,
        )
        bcf_stats = parse_bcftools_stats(args.bcf_stats_file)
        bcf_plots = generate_plots(bcf_df, "bcf", args.output_dir, label=VcfType.BCF)

    if args.survivor_vcf_file:
        survivor_df = process_vcf(
            VcfType.SURVIVOR,
            args.survivor_vcf_file,
            args.output_dir,
        )
        survivor_stats = parse_survivor_stats(args.survivor_stats_file)
        survivor_plots = generate_plots(
            survivor_df, "survivor", args.output_dir, label=VcfType.SURVIVOR
        )

    generate_combined_report(
        env=env,
        combined_report_file=os.path.join(args.output_dir, args.report_file),
        bcf_vcf_path=args.bcf_vcf_file,
        survivor_vcf_path=args.survivor_vcf_file,
        fasta_path=args.fasta_file,
        bam_files=args.bam_files,
        bcf_df=bcf_df,
        bcf_stats=bcf_stats,
        survivor_df=survivor_df,
        survivor_stats=survivor_stats,
        bcf_plots=bcf_plots,
        survivor_plots=survivor_plots,
        profiles=args.profile,
        reference_name=args.fasta_file,
        bcf_sample_columns=(
            [
                "unique_id",
                "CHROM",
                "POSITION",
                "ID",
                "SUPP_CALLERS",
                "REF",
                "QUAL",
                "FILTER",
                "SVTYPE",
                "PRIMARY_CALLER",
                "END",
                "SVLEN",
                "CHROM2",
                "MATE_ID",
                "CIPOS",
                "CIEND",
                "HOMSEQ",
                "HOMLEN",
                "GT",
                "PR",
                "SR",
                "GQ",
            ]
            if bcf_df is not None
            else []
        ),
        survivor_sample_columns=(
            [
                "unique_id",
                "CHROM",
                "POSITION",
                "ID",
                "SUPP_CALLERS",
                "REF",
                "QUAL",
                "FILTER",
                "SVTYPE",
                "PRIMARY_CALLER",
                "END",
                "SVLEN",
                "CHROM2",
                "STRANDS",
                "CIPOS",
                "CIEND",
                "HOMSEQ",
                "HOMLEN",
                "SVMETHOD",
                "GT",
                "PR",
                "SR",
                "GQ",
            ]
            if survivor_df is not None
            else []
        ),
        disable_igv=args.disable_igv,
    )

    print("\n--- Report Generation Complete ---\n")


if __name__ == "__main__":
    main()
