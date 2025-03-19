#!/usr/bin/env python3

import argparse
from varify import generate_html_report

def main():
    parser = argparse.ArgumentParser(description="Generate an HTML report from a merged VCF file, individual VCF files, and SURVIVOR analysis.")
    parser.add_argument("--merged_vcf", required=True, help="Path to the merged VCF file.")
    parser.add_argument("--other_vcfs", nargs='*', default=[], help="List of individual VCF files for separate analysis.")
    parser.add_argument("--survivor_vcf", required=True, help="Path to the SURVIVOR merged VCF file.")
    parser.add_argument("--survivor_stats", required=True, help="Path to the SURVIVOR stats table.")
    parser.add_argument("--output_dir", required=True, help="Path to the output directory for HTML reports.")
    args = parser.parse_args()

    generate_html_report(args.merged_vcf, args.other_vcfs, args.survivor_vcf, args.survivor_stats, args.output_dir)

if __name__ == "__main__":
    main()
