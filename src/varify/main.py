import os
import argparse
from jinja2 import Environment, FileSystemLoader

from .parser import (
    parse_vcf,
    parse_survivor_stats,
    parse_bcftools_stats,
    get_caller_stats,
)
from .report import generate_report
from .combine import generate_combined_report
from .plots import (
    plot_sv_type_distribution,
    plot_sv_size_distribution,
    plot_qual_distribution,
    plot_sv_type_vs_size,
    plot_sv_callers,
    plot_sv_density_by_chromosome,
    plot_sv_size_vs_quality,
    plot_sv_type_heatmap,
    plot_sample_variation,
    plot_strand_bias,
    plot_cumulative_sv_length,
    plot_allele_frequency,
)


def parse_args():
    parser = argparse.ArgumentParser(description="Generate structural variant reports.")

    # Base directories
    parser.add_argument(
        "--output-dir", required=True, help="Path to the output directory."
    )

    # Input files
    parser.add_argument(
        "--bfc-vcf-file", required=True, help="Path to the BFC merged VCF file."
    )
    parser.add_argument(
        "--survivor-vcf-file",
        required=True,
        help="Path to the SURVIVOR merged VCF file.",
    )

    parser.add_argument(
        "--sample-vcf-files", nargs="+", help="Paths to additional sample VCF files."
    )

    parser.add_argument(
        "--bam-files",
        nargs="+",
        help="Paths to BAM files for read depth and alignment analysis.",
    )
    parser.add_argument(
        "--fasta-file", required=True, help="Path to the reference genome FASTA file."
    )

    # Stats files (new)
    parser.add_argument(
        "--bfc-stats-file", required=True, help="Path to the BFC bcftools stats file."
    )
    parser.add_argument(
        "--survivor-stats-file", required=True, help="Path to the SURVIVOR stats file."
    )

    # Output files
    parser.add_argument(
        "--report-file", required=True, help="Path to the final report output file."
    )

    return parser.parse_args()


def main():
    args = parse_args()

    print("\n--- Starting Report Generation ---\n")

    # Parse VCF and stats files
    bfc_df, bfc_info_columns, bfc_sample_columns, bfc_samples = parse_vcf(
        args.bfc_vcf_file
    )
    bcf_stats = parse_bcftools_stats(args.bfc_stats_file)

    survivor_df, survivor_info_columns, survivor_sample_columns, survivor_samples = (
        parse_vcf(args.survivor_vcf_file)
    )
    survivor_stats = parse_survivor_stats(args.survivor_stats_file)

    base_dir = os.path.dirname(__file__)
    template_dir = os.path.join(base_dir, "templates")
    env = Environment(loader=FileSystemLoader(template_dir))

    # Generate and save plots for BFC
    bfc_plots = {
        "plot_sv_callers": plot_sv_callers(
            bfc_df, os.path.join(args.output_dir, "bfc_caller_stats.png")
        ),
        "sv_type_distribution": plot_sv_type_distribution(
            bfc_df, os.path.join(args.output_dir, "bfc_sv_type_distribution.png")
        ),
        "sv_size_distribution": plot_sv_size_distribution(
            bfc_df, os.path.join(args.output_dir, "bfc_sv_size_distribution.png")
        ),
        "qual_distribution": plot_qual_distribution(
            bfc_df, os.path.join(args.output_dir, "bfc_qual_distribution.png")
        ),
        "sv_type_vs_size": plot_sv_type_vs_size(
            bfc_df, os.path.join(args.output_dir, "bfc_sv_type_vs_size.png")
        ),
        # 'sv_density_by_chromosome': plot_sv_density_by_chromosome(bfc_df, os.path.join(args.output_dir, "bfc_sv_density_by_chromosome.png")),
        "sv_size_vs_quality": plot_sv_size_vs_quality(
            bfc_df, os.path.join(args.output_dir, "bfc_sv_size_vs_quality.png")
        ),
        "sv_type_heatmap": plot_sv_type_heatmap(
            bfc_df, os.path.join(args.output_dir, "bfc_sv_type_heatmap.png")
        ),
        # 'sample_variation': plot_sample_variation(bfc_df, os.path.join(args.output_dir, "bfc_sample_variation.png")),
        # 'strand_bias': plot_strand_bias(bfc_df, os.path.join(args.output_dir, "bfc_strand_bias.png")),
        "cumulative_sv_length": plot_cumulative_sv_length(
            bfc_df, os.path.join(args.output_dir, "bfc_cumulative_sv_length.png")
        ),
        # 'allele_frequency': plot_allele_frequency(bfc_df, os.path.join(args.output_dir, "bfc_allele_frequency.png"))
    }

    # Generate and save plots for Survivor
    survivor_plots = {
        "plot_sv_callers": plot_sv_callers(
            survivor_df, os.path.join(args.output_dir, "survivor_caller_stats.png")
        ),
        "sv_type_distribution": plot_sv_type_distribution(
            survivor_df,
            os.path.join(args.output_dir, "survivor_sv_type_distribution.png"),
        ),
        "sv_size_distribution": plot_sv_size_distribution(
            survivor_df,
            os.path.join(args.output_dir, "survivor_sv_size_distribution.png"),
        ),
        "qual_distribution": plot_qual_distribution(
            survivor_df, os.path.join(args.output_dir, "survivor_qual_distribution.png")
        ),
        "sv_type_vs_size": plot_sv_type_vs_size(
            survivor_df, os.path.join(args.output_dir, "survivor_sv_type_vs_size.png")
        ),
        # 'sv_density_by_chromosome': plot_sv_density_by_chromosome(survivor_df, os.path.join(args.output_dir, "survivor_sv_density_by_chromosome.png")),
        "sv_size_vs_quality": plot_sv_size_vs_quality(
            survivor_df,
            os.path.join(args.output_dir, "survivor_sv_size_vs_quality.png"),
        ),
        "sv_type_heatmap": plot_sv_type_heatmap(
            survivor_df, os.path.join(args.output_dir, "survivor_sv_type_heatmap.png")
        ),
        # 'sample_variation': plot_sample_variation(survivor_df, os.path.join(args.output_dir, "survivor_sample_variation.png")),
        # 'strand_bias': plot_strand_bias(survivor_df, os.path.join(args.output_dir, "survivor_strand_bias.png")),
        "cumulative_sv_length": plot_cumulative_sv_length(
            survivor_df,
            os.path.join(args.output_dir, "survivor_cumulative_sv_length.png"),
        ),
        # 'allele_frequency': plot_allele_frequency(survivor_df, os.path.join(args.output_dir, "survivor_allele_frequency.png"))
    }

    # Generate individual reports
    generate_report(
        env,
        args.bfc_vcf_file,
        args.survivor_vcf_file,
        "bfc_structural_variant_report.html",
        args.fasta_file,
        args.bam_files,
        "BFC Merge Report",
        prefix="bfc",
        info_columns=bfc_info_columns,
        sample_columns=bfc_sample_columns,
        samples=bfc_samples,
    )

    generate_report(
        env,
        args.survivor_vcf_file,
        args.bfc_vcf_file,
        "survivor_structural_variant_report.html",
        args.fasta_file,
        args.bam_files,
        "SURVIVOR Merge Report",
        prefix="survivor",
        info_columns=survivor_info_columns,
        sample_columns=survivor_sample_columns,
        samples=survivor_samples,
    )

    generate_combined_report(
        env,
        args.report_file,
        "bfc_structural_variant_report.html",
        "survivor_structural_variant_report.html",
        bfc_df,
        bcf_stats,
        survivor_df,
        survivor_stats,
        bfc_plots=bfc_plots,
        survivor_plots=survivor_plots,
    )

    print("\n--- Report Generation Complete ---\n")


if __name__ == "__main__":
    main()
