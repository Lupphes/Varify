import os
import argparse
from typing import Optional, Dict, Tuple, List

import pandas as pd
from jinja2 import Environment, FileSystemLoader

from .parser import parse_vcf, parse_survivor_stats, parse_bcftools_stats
from .report import generate_report
from .combine import generate_combined_report
from .plots import (
    plot_sv_type_distribution,
    plot_sv_size_distribution,
    plot_qual_distribution,
    plot_sv_type_vs_size,
    plot_sv_callers,
    plot_sv_size_vs_quality,
    plot_sv_type_heatmap,
    plot_cumulative_sv_length,
    plot_bcf_exact_instance_combinations,
    plot_survivor_exact_instance_combinations,
)

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate structural variant reports.")

    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--bcf-vcf-file", required=True, help="BCF merged VCF")
    parser.add_argument("--survivor-vcf-file", required=True, help="SURVIVOR merged VCF")
    parser.add_argument("--sample-vcf-files", nargs="+", help="Optional additional sample VCFs")
    parser.add_argument("--bam-files", nargs="+", help="BAM files for IGV")
    parser.add_argument("--fasta-file", required=True, help="Reference FASTA")
    parser.add_argument("--bcf-stats-file", required=True, help="bcftools stats for BCF merged VCF")
    parser.add_argument("--survivor-stats-file", required=True, help="SURVIVOR stats")
    parser.add_argument("--report-file", required=True, help="Path to save the combined HTML report")
    parser.add_argument("--profile", default="default", help="Profile run from the pipeline")

    return parser.parse_args()

def plot_caller_combinations(df: pd.DataFrame, label: str, output_path: str, subfolder: str = "plots") -> Optional[Dict[str, str]]:
    if label == "survivor":
        return plot_survivor_exact_instance_combinations(df, output_path, subfolder)
    elif label == "bcf":
        return plot_bcf_exact_instance_combinations(df, output_path, subfolder)
    print(f"[Warning] Unknown label '{label}' - skipping caller combination plot.")
    return None

def generate_plots(
    df: pd.DataFrame,
    prefix: str,
    output_dir: str,
    label: str,
    subfolder: str = "plots",
    ext: str = "html"
) -> Dict[str, Optional[Dict[str, str]]]:
    """Generate and save all variant plots; return metadata for each plot."""
    plot_dir = os.path.join(output_dir, subfolder)
    os.makedirs(plot_dir, exist_ok=True)

    def out(name: str) -> str:
        return os.path.join(plot_dir, f"{prefix}_{name}.{ext}")

    return {
        "plot_sv_callers": plot_sv_callers(df, out("caller_stats")),
        "caller_combinations": plot_caller_combinations(df, label, out("caller_combinations")),
        "sv_type_distribution": plot_sv_type_distribution(df, out("sv_type_distribution")),
        "sv_size_distribution": plot_sv_size_distribution(df, out("sv_size_distribution")),
        "qual_distribution": plot_qual_distribution(df, out("qual_distribution")),
        "sv_type_vs_size": plot_sv_type_vs_size(df, out("sv_type_vs_size")),
        "sv_size_vs_quality": plot_sv_size_vs_quality(df, out("sv_size_vs_quality")),
        "sv_type_heatmap": plot_sv_type_heatmap(df, out("sv_type_heatmap")),
        "cumulative_sv_length": plot_cumulative_sv_length(df, out("cumulative_sv_length")),
    }

def process_vcf_and_generate_report(
    env: Environment,
    label: str,
    vcf_path: str,
    alt_vcf_path: str,
    fasta: str,
    bam_files: Optional[List[str]],
    output_dir: str
) -> Tuple[pd.DataFrame, List[str], List[str], List[str], str]:
    os.makedirs(output_dir, exist_ok=True)
    df, info_columns, sample_columns, cleaned_samples = parse_vcf(vcf_path, label=label)

    non_empty_info_columns = [col for col in info_columns if col in df.columns and df[col].notna().any()]
    html_path = os.path.join(output_dir, f"{label}_structural_variant_report.html")

    generate_report(
        env=env,
        main_vcf=vcf_path,
        second_vcf=alt_vcf_path,
        output_file=html_path,
        genome_file=fasta,
        bam_files=bam_files,
        title=f"{label.upper()} Merge Report",
        prefix=label,
        info_columns=non_empty_info_columns,
        sample_columns=None,
        samples=None,
    )

    return df, non_empty_info_columns, sample_columns, cleaned_samples, html_path

def main() -> None:
    args = parse_args()
    print("\n--- Starting Report Generation ---\n")

    env = Environment(loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates")))

    bcf_df, _, _, _, bcf_html = process_vcf_and_generate_report(
        env, "bcf", args.bcf_vcf_file, args.survivor_vcf_file, args.fasta_file, args.bam_files, args.output_dir
    )
    bcf_stats = parse_bcftools_stats(args.bcf_stats_file)
    bcf_plots = generate_plots(bcf_df, "bcf", args.output_dir, label="bcf")

    survivor_df, _, _, _, survivor_html = process_vcf_and_generate_report(
        env, "survivor", args.survivor_vcf_file, args.bcf_vcf_file, args.fasta_file, args.bam_files, args.output_dir
    )
    survivor_stats = parse_survivor_stats(args.survivor_stats_file)
    survivor_plots = generate_plots(survivor_df, "survivor", args.output_dir, label="survivor")

    generate_combined_report(
        env=env,
        combined_report_file=args.report_file,
        bcf_html_path=bcf_html,
        survivor_html_path=survivor_html,
        bcf_df=bcf_df,
        bcf_stats=bcf_stats,
        survivor_df=survivor_df,
        survivor_stats=survivor_stats,
        bcf_plots=bcf_plots,
        survivor_plots=survivor_plots,
        profiles=args.profile,
    )

    print("\n--- Report Generation Complete ---\n")

if __name__ == "__main__":
    main()