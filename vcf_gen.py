#!/usr/bin/env python3

import os
import argparse
import pandas as pd
import plotly.express as px
import vcfpy
import dominate
from dominate.tags import html, head, title, body, h1, p, h2, div, table, tr, th, td, script, a, pre

def parse_vcf(file_path):
    """Parses a VCF file using vcfpy and returns a pandas DataFrame."""
    reader = vcfpy.Reader.from_path(file_path)
    records = []
    for record in reader:
        info = record.INFO
        svtype = info.get("SVTYPE", [None])[0]
        caller = info.get("CALLER", [None])[0]
        end = info.get("END")
        if isinstance(end, list):
            end = end[0]  # Extract first element if it's a list
        qual = record.QUAL
        records.append({
            "CHROM": record.CHROM,
            "POS": record.POS,
            "ID": record.ID,
            "REF": record.REF,
            "ALT": str(record.ALT),
            "QUAL": qual,
            "FILTER": ";".join(record.FILTER),
            "SVTYPE": svtype,
            "CALLER": caller,
            "END": end
        })

    return pd.DataFrame(records)

def parse_survivor_stats(file_path):
    """Parses a SURVIVOR stats file into a pandas DataFrame."""
    return pd.read_csv(file_path, sep='\t', index_col=0)

def read_vcf_text(file_path):
    """Reads the full content of a VCF file as text."""
    with open(file_path, "r") as f:
        return f.read()

def generate_vcf_report(df, title_text, output_file, vcf_text):
    """Generates an individual HTML page for a given VCF dataframe with statistics and raw VCF content."""
    doc = dominate.document(title=title_text)

    stats = {
        "Total Variants": len(df),
        "Unique SV Types": df["SVTYPE"].nunique(),
        "Mean Quality Score": round(df["QUAL"].mean(), 2) if not df["QUAL"].isna().all() else "N/A"
    }

    with doc:
        head()
        script(src="https://cdn.plot.ly/plotly-latest.min.js")
        with body():
            h1(title_text)
            h2("Summary Statistics")
            with table(border="1"):
                for key, value in stats.items():
                    with tr():
                        th(key)
                        td(value)
            h2("Variant Table")
            with table(border="1"):
                with tr():
                    for col in df.columns:
                        th(col)
                for _, row in df.iterrows():
                    with tr():
                        for col in df.columns:
                            td(str(row[col]))
            h2("Full VCF File")
            pre(vcf_text)

    with open(output_file, "w") as f:
        f.write(doc.render())

def generate_survivor_report(survivor_df, survivor_stats_df, output_file, vcf_text):
    """Generates an HTML page combining SURVIVOR VCF data, stats, and raw VCF content."""
    doc = dominate.document(title="SURVIVOR VCF and Stats Report")

    survivor_summary = {
        "Total Variants": len(survivor_df),
        "Unique SV Types": survivor_df["SVTYPE"].nunique(),
        "Mean Quality Score": round(survivor_df["QUAL"].mean(), 2) if not survivor_df["QUAL"].isna().all() else "N/A"
    }

    with doc:
        head()
        script(src="https://cdn.plot.ly/plotly-latest.min.js")
        with body():
            h1("SURVIVOR VCF and Stats Report")
            h2("SURVIVOR Statistics Table")
            with table(border="1"):
                with tr():
                    th("Length Category")
                    for col in survivor_stats_df.columns:
                        th(col)
                for idx, row in survivor_stats_df.iterrows():
                    with tr():
                        td(idx)
                        for col in survivor_stats_df.columns:
                            td(str(row[col]))
            h2("Summary Statistics")
            with table(border="1"):
                for key, value in survivor_summary.items():
                    with tr():
                        th(key)
                        td(value)
            h2("SURVIVOR Structural Variants")
            with table(border="1"):
                with tr():
                    for col in survivor_df.columns:
                        th(col)
                for _, row in survivor_df.iterrows():
                    with tr():
                        for col in survivor_df.columns:
                            td(str(row[col]))
            h2("Full VCF File")
            pre(vcf_text)

    with open(output_file, "w") as f:
        f.write(doc.render())

def generate_index(output_dir, other_vcfs):
    """Generates an index HTML page linking to all reports."""
    doc = dominate.document(title="VCF Analysis Reports")

    with doc:
        head()
        with body():
            h1("VCF Analysis Reports")
            p("Select a report to view:")
            a("Merged VCF Report", href="merged_report.html")
            p()
            a("SURVIVOR VCF and Stats Report", href="survivor_report.html")
            p()
            for vcf_file in other_vcfs:
                vcf_name = os.path.basename(vcf_file).replace(".vcf", "")
                a(f"{vcf_name} Report", href=f"{vcf_name}_report.html")
                p()

    with open(os.path.join(output_dir, "index.html"), "w") as f:
        f.write(doc.render())

def generate_html_report(merged_vcf, other_vcfs, survivor_vcf, survivor_stats, output_dir):
    """Generates multiple HTML pages for VCF files and SURVIVOR stats using Dominate with analysis and raw VCF content."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Generate merged VCF report
    merged_df = parse_vcf(merged_vcf)
    merged_vcf_text = read_vcf_text(merged_vcf)
    generate_vcf_report(merged_df, "Merged VCF Report", os.path.join(output_dir, "merged_report.html"), merged_vcf_text)

    # Generate SURVIVOR report
    survivor_df = parse_vcf(survivor_vcf)
    survivor_stats_df = parse_survivor_stats(survivor_stats)
    survivor_vcf_text = read_vcf_text(survivor_vcf)
    generate_survivor_report(survivor_df, survivor_stats_df, os.path.join(output_dir, "survivor_report.html"), survivor_vcf_text)

    # Generate reports for individual VCFs
    for vcf_file in other_vcfs:
        vcf_df = parse_vcf(vcf_file)
        vcf_text = read_vcf_text(vcf_file)
        vcf_name = os.path.basename(vcf_file).replace(".vcf", "")
        generate_vcf_report(vcf_df, f"{vcf_name} Report", os.path.join(output_dir, f"{vcf_name}_report.html"), vcf_text)

    # Generate index page
    generate_index(output_dir, other_vcfs)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate an HTML report from a merged VCF file, individual VCF files, and SURVIVOR analysis.")
    parser.add_argument("--merged_vcf", required=True, help="Path to the merged VCF file.")
    parser.add_argument("--other_vcfs", nargs='*', default=[], help="List of individual VCF files for separate analysis.")
    parser.add_argument("--survivor_vcf", required=True, help="Path to the SURVIVOR merged VCF file.")
    parser.add_argument("--survivor_stats", required=True, help="Path to the SURVIVOR stats table.")
    parser.add_argument("--output_dir", required=True, help="Path to the output directory for HTML reports.")
    args = parser.parse_args()

    generate_html_report(args.merged_vcf, args.other_vcfs, args.survivor_vcf, args.survivor_stats, args.output_dir)
