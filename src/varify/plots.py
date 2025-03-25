import os
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

def plot_sv_type_distribution(df, output_path):
    filtered_df = df.dropna(subset=["SVTYPE"])
    plt.figure(figsize=(8, 6))
    sns.countplot(
        data=filtered_df, x="SVTYPE", hue="SVTYPE", palette="viridis", legend=False
    )
    plt.title("SV Type Distribution")
    plt.xlabel("SV Type")
    plt.ylabel("Count")
    plt.savefig(output_path, dpi=300)
    plt.close()
    return {
        "path": os.path.basename(output_path),
        "alt": "SV Type Distribution",
        "width": 600,
    }


def plot_sv_size_distribution(df, output_path):
    lower_quantile = df["SVLEN"].quantile(0.05)
    upper_quantile = df["SVLEN"].quantile(0.95)
    filtered_df = df[(df["SVLEN"] >= lower_quantile) & (df["SVLEN"] <= upper_quantile)]

    plt.figure(figsize=(8, 6))
    sns.histplot(filtered_df["SVLEN"].dropna(), bins=50, kde=True, log_scale=True)
    plt.title("SV Size Distribution (5th–95th percentile)")
    plt.xlabel("SV Length (bp)")
    plt.ylabel("Count")
    plt.savefig(output_path, dpi=300)
    plt.close()
    return {
        "path": os.path.basename(output_path),
        "alt": "SV Size Distribution (5th–95th percentile)",
        "width": 600,
    }


def plot_qual_distribution(df, output_path):
    lower_quantile = df["QUAL"].quantile(0.05)
    upper_quantile = df["QUAL"].quantile(0.95)
    filtered_df = df[(df["QUAL"] >= lower_quantile) & (df["QUAL"] <= upper_quantile)]

    plt.figure(figsize=(8, 6))
    sns.histplot(filtered_df["QUAL"].dropna(), bins=50, kde=True)
    plt.title("Quality Score Distribution (5th–95th percentile)")
    plt.xlabel("Quality Score")
    plt.ylabel("Frequency")
    plt.savefig(output_path, dpi=300)
    plt.close()
    return {
        "path": os.path.basename(output_path),
        "alt": "Quality Score Distribution (5th–95th percentile)",
        "width": 600,
    }


def plot_sv_type_vs_size(df, output_path):
    lower_quantile = df["SVLEN"].quantile(0.05)
    upper_quantile = df["SVLEN"].quantile(0.95)
    filtered_df = df[(df["SVLEN"] >= lower_quantile) & (df["SVLEN"] <= upper_quantile)]

    plt.figure(figsize=(10, 6))
    sns.violinplot(data=filtered_df, x="SVTYPE", y="SVLEN", density_norm="width")
    plt.title("SV Type vs Size Distribution (5th–95th percentile)")
    plt.xlabel("SV Type")
    plt.ylabel("SV Length (bp)")
    plt.savefig(output_path, dpi=300)
    plt.close()
    return {
        "path": os.path.basename(output_path),
        "alt": "SV Type vs Size Distribution (5th–95th percentile)",
        "width": 600,
    }


def plot_sv_density_by_chromosome(df, output_path):
    chrom_counts = df["CHROM"].value_counts()
    lower_quantile = chrom_counts.quantile(0.05)
    upper_quantile = chrom_counts.quantile(0.95)
    filtered_chrom = chrom_counts[
        (chrom_counts >= lower_quantile) & (chrom_counts <= upper_quantile)
    ].index

    filtered_df = df[df["CHROM"].isin(filtered_chrom)]

    plt.figure(figsize=(12, 6))
    sns.histplot(filtered_df["CHROM"].astype(str), bins=len(filtered_chrom), kde=False)
    plt.title("SV Density by Chromosome (5th–95th percentile)")
    plt.xlabel("Chromosome")
    plt.ylabel("Count")
    plt.xticks(rotation=45)
    plt.savefig(output_path, dpi=300)
    plt.close()
    return {
        "path": os.path.basename(output_path),
        "alt": "SV Density by Chromosome (5th–95th percentile)",
        "width": 600,
    }


def plot_sv_size_vs_quality(df, output_path):
    lower_svlen = df["SVLEN"].quantile(0.05)
    upper_svlen = df["SVLEN"].quantile(0.95)
    lower_qual = df["QUAL"].quantile(0.05)
    upper_qual = df["QUAL"].quantile(0.95)

    filtered_df = df[
        (df["SVLEN"] >= lower_svlen)
        & (df["SVLEN"] <= upper_svlen)
        & (df["QUAL"] >= lower_qual)
        & (df["QUAL"] <= upper_qual)
    ]

    plt.figure(figsize=(10, 6))
    sns.scatterplot(
        data=filtered_df, x="SVLEN", y="QUAL", hue="SVTYPE", alpha=0.7, edgecolor=None
    )
    plt.title("SV Size vs Quality Score (5th–95th percentile)")
    plt.xscale("log")
    plt.xlabel("SV Length (bp)")
    plt.ylabel("Quality Score")
    plt.legend(title="SV Type")
    plt.savefig(output_path, dpi=300)
    plt.close()
    return {
        "path": os.path.basename(output_path),
        "alt": "SV Size vs Quality Score (5th–95th percentile)",
        "width": 600,
    }


def plot_sv_type_heatmap(df, output_path):
    plt.figure(figsize=(12, 8))
    sv_by_chrom = df.groupby(["CHROM", "SVTYPE"]).size().unstack().fillna(0)
    sns.heatmap(sv_by_chrom, cmap="YlGnBu", annot=True, fmt=".0f")
    plt.title("SV Type Heatmap by Chromosome")
    plt.xlabel("SV Type")
    plt.ylabel("Chromosome")
    plt.savefig(output_path, dpi=300)
    plt.close()
    return {
        "path": os.path.basename(output_path),
        "alt": "SV Type Heatmap by Chromosome",
        "width": 800,
    }


def plot_sample_variation(df, output_path):
    plt.figure(figsize=(12, 8))
    sns.violinplot(data=df, x="Sample", y="SVLEN", hue="SVTYPE", scale="width")
    plt.title("Sample-Level Structural Variant Distribution")
    plt.xticks(rotation=90)
    plt.xlabel("Sample")
    plt.ylabel("SV Length (bp)")
    plt.savefig(output_path, dpi=300)
    plt.close()
    return {
        "path": os.path.basename(output_path),
        "alt": "Sample-Level SV Distribution",
        "width": 800,
    }


def plot_strand_bias(df, output_path):
    plt.figure(figsize=(8, 6))
    sns.countplot(data=df, x="SVTYPE", hue="STRAND", palette="Set2")
    plt.title("Strand Bias Across Structural Variants")
    plt.xlabel("SV Type")
    plt.ylabel("Count")
    plt.legend(title="Strand")
    plt.savefig(output_path, dpi=300)
    plt.close()
    return {
        "path": os.path.basename(output_path),
        "alt": "Strand Bias Across SV Types",
        "width": 600,
    }


def plot_cumulative_sv_length(df, output_path):
    if "SVLEN" not in df.columns or "CHROM" not in df.columns:
        raise ValueError("Missing 'SVLEN' or 'CHROM' column in input DataFrame")

    sv_length_per_chrom = df.groupby("CHROM")["SVLEN"].sum().reset_index()

    # Handle empty DataFrame
    if sv_length_per_chrom.empty:
        print("No data available for SV length per chromosome.")
        return None

    # Handle NaN and inf values
    sv_length_per_chrom.replace([np.inf, -np.inf], np.nan, inplace=True)
    sv_length_per_chrom.dropna(subset=["SVLEN"], inplace=True)

    plt.figure(figsize=(12, 6))
    sns.barplot(
        data=sv_length_per_chrom,
        x="CHROM",
        y="SVLEN",
        hue="CHROM",  # Fix for Seaborn FutureWarning
        palette="coolwarm",
        legend=False
    )
    plt.title("Cumulative SV Length per Chromosome")
    plt.xticks(rotation=45)
    plt.xlabel("Chromosome")
    plt.ylabel("Cumulative SV Length (bp)")
    plt.savefig(output_path, dpi=300)
    plt.close()

    return {
        "path": os.path.basename(output_path),
        "alt": "Cumulative SV Length per Chromosome",
        "width": 800,
    }


def plot_allele_frequency(df, output_path):
    lower_quantile = df["AF"].quantile(0.05)
    upper_quantile = df["AF"].quantile(0.95)
    filtered_df = df[(df["AF"] >= lower_quantile) & (df["AF"] <= upper_quantile)]

    plt.figure(figsize=(8, 6))
    sns.histplot(filtered_df["AF"].dropna(), bins=30, kde=True)
    plt.title("Allele Frequency Distribution (5th–95th percentile)")
    plt.xlabel("Allele Frequency")
    plt.ylabel("Count")
    plt.savefig(output_path, dpi=300)
    plt.close()
    return {
        "path": os.path.basename(output_path),
        "alt": "Allele Frequency Distribution (5th–95th percentile)",
        "width": 600,
    }


def plot_sv_callers(df, output_path):
    if "CALLER" not in df.columns:
        print("No 'CALLER' column found in the data.")
        return None

    caller_counts = df["CALLER"].value_counts()

    plt.figure(figsize=(8, 6))
    sns.barplot(x=caller_counts.index, y=caller_counts.values, hue=caller_counts.index, palette="viridis", legend=False)
    plt.title("Structural Variant Callers")
    plt.xlabel("Caller")
    plt.ylabel("Number of Variants")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()

    return {
        "path": os.path.basename(output_path),
        "alt": "Structural Variant Callers",
        "width": 600,
    }

