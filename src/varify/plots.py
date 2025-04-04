import os
from typing import Optional, Dict

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from scipy.stats import gaussian_kde

from .parser import VcfType

def save_fig(fig: go.Figure, output_path: str) -> None:
    fig.write_html(
        output_path,
        include_plotlyjs="cdn",
        full_html=True,
        config={"responsive": True},
    )
    fig.write_image(output_path.replace(".html", ".png"), scale=2)


def standard_layout(fig: go.Figure, title: str) -> None:
    fig.update_layout(
        title=title,
        template="plotly_white",
        autosize=True,
        margin=dict(l=40, r=40, t=60, b=60),
        legend=dict(orientation="v", x=1.05, xanchor="left", y=1),
        xaxis=dict(title_font=dict(size=12)),
        yaxis=dict(title_font=dict(size=12)),
    )


def relative_path(output_path: str, subfolder: str = "plots") -> str:
    return os.path.join(subfolder, os.path.basename(output_path))


def _wrap_output(output_path: str, alt: str, subfolder: str) -> Dict[str, str]:
    return {
        "path": relative_path(output_path, subfolder),
        "alt": alt,
        "width": "100%",
        "type": "html",
    }


def normalize_svlen(df: pd.DataFrame) -> pd.DataFrame:
    df_copy = df.copy()
    df_copy["SVLEN"] = pd.to_numeric(df_copy["SVLEN"], errors="coerce").abs()
    return df_copy[df_copy["SVLEN"] < 1_000_000]


def plot_sv_callers(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Optional[Dict[str, str]]:
    if "CALLER" not in df.columns:
        print("No 'CALLER' column found in the data.")
        return None

    exploded = (
        df.dropna(subset=["CALLER"])
        .assign(CALLER=df["CALLER"].str.split(","))
        .explode("CALLER")
        .assign(CALLER=lambda d: d["CALLER"].str.strip())
    )
    df_counts = exploded["CALLER"].value_counts().reset_index()
    df_counts.columns = ["Caller", "Count"]

    fig = px.bar(df_counts, x="Caller", y="Count", color="Caller")
    standard_layout(fig, "Structural Variant Callers")
    save_fig(fig, output_path)
    return _wrap_output(output_path, "Structural Variant Callers", subfolder)


def plot_sv_type_distribution(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    filtered = df.dropna(subset=["SVTYPE"])

    # Sort filtered alphabetically by SVTYPE
    filtered = filtered.sort_values(by="SVTYPE")

    fig = px.histogram(filtered, x="SVTYPE", color="SVTYPE")
    standard_layout(fig, "SV Type Distribution")
    save_fig(fig, output_path)
    return _wrap_output(output_path, "SV Type Distribution", subfolder)


def plot_sv_size_distribution(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    df_copy = normalize_svlen(df)
    
    # Filter out rows with SVLEN of 0 and SVTYPE of 'TRA'
    df_copy = df_copy[~((df_copy["SVLEN"] == 0) & (df_copy["SVTYPE"] == "TRA"))]
    
    lower, upper = df_copy["SVLEN"].quantile([0.05, 0.95])
    filtered = df_copy[(df_copy["SVLEN"] >= lower) & (df_copy["SVLEN"] <= upper)]

    # TODO: Do nicer
    if len(filtered) == 0:
        return None

    # Calculate number of bins using Sturge's rule: k = 1 + 3.322 * log10(n)
    n_bins = int(1 + np.log2(len(filtered)))
    fig = px.histogram(
        filtered, x="SVLEN", nbins=n_bins, histnorm='percent', labels={"SVLEN": "SV Length (bp)"},
        range_y=[0,100]
    )
    standard_layout(fig, "SV Size Distribution (5th–95th percentile)")
    save_fig(fig, output_path)
    return _wrap_output(
        output_path, "SV Size Distribution (5th–95th percentile)", subfolder
    )


def plot_qual_distribution(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    # Filter out values outside the 5th to 95th percentile
    lower, upper = df["QUAL"].quantile([0.05, 0.95])
    filtered = df[(df["QUAL"] >= lower) & (df["QUAL"] <= upper)]

    # Calculate the KDE (Kernel Density Estimate)
    kde = gaussian_kde(filtered["QUAL"])
    x_vals = np.linspace(filtered["QUAL"].min(), filtered["QUAL"].max(), 1000)
    y_vals = kde(x_vals)

    # Normalize the KDE to match the histogram's total count
    bin_width = (filtered["QUAL"].max() - filtered["QUAL"].min()) / 50  # Number of bins (same as in the histogram)
    kde_area = np.sum(y_vals) * bin_width  # This gives the area under the KDE curve
    y_vals_normalized = y_vals / kde_area  # Normalize the KDE

    # Plotting the histogram as percentages
    fig = px.histogram(filtered, x="QUAL", histnorm='percent', nbins=50, opacity=0.8, labels={"QUAL": "Quality Score"})

    # Scale the KDE to the same percentage range as the histogram
    y_vals_normalized_percent = y_vals_normalized * 100  # Scale to percentage

    # Adding the KDE line
    fig.add_trace(
        go.Scatter(
            x=x_vals,
            y=y_vals_normalized_percent * len(filtered),  # Scale the KDE to match the histogram's total count
            mode="lines",
            name="KDE",
            line=dict(color="red", width=2),
        )
    )

    # Update the layout with titles and axis labels
    fig.update_layout(
        title="Quality Score Distribution (5th–95th percentile)",
        template="plotly_white",
        margin=dict(l=40, r=40, t=60, b=60),
        xaxis_title="Quality Score",
        yaxis_title="Percentage",
    )

    save_fig(fig, output_path)
    return _wrap_output(output_path, "Quality Score Distribution (5th–95th percentile)", subfolder)


def plot_sv_type_vs_size(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    # Normalize SVLEN values to absolute before plotting
    df_copy = normalize_svlen(df)
    
    # Explicitly calculate the quantiles on the absolute values
    df_copy["SVLEN"] = df_copy["SVLEN"].abs()  # Ensure absolute values are used for calculations

    # Filter using absolute quantiles for whiskers
    lower, upper = df_copy["SVLEN"].quantile([0.05, 0.95])
    filtered = df_copy[(df_copy["SVLEN"] >= lower) & (df_copy["SVLEN"] <= upper)]

    # Sort filtered alphabetically by SVTYPE
    filtered = filtered.sort_values(by="SVTYPE")

    # Plotting the violin plot
    fig = px.violin(
        filtered,
        x="SVTYPE",
        y="SVLEN",
        box=True,
        points="all",  # Show all points, not just outliers
        color="SVTYPE",  # Color by SVTYPE for better distinction
        labels={"SVLEN": "SV Length (bp)", "SVTYPE": "SV Type"},
    )

    # Adjust the layout and axis to ensure readability
    fig.update_layout(
        title="SV Type vs Size Distribution (5th–95th percentile)",
        template="plotly_white",
        margin=dict(l=40, r=40, t=60, b=60),
        xaxis_title="SV Type",
        yaxis_title="SV Length (bp)",
    )

    # Apply standard layout
    standard_layout(fig, "SV Type vs Size Distribution (5th–95th percentile)")

    # Save the figure
    save_fig(fig, output_path)
    
    return _wrap_output(output_path, "SV Type vs Size Distribution (5th–95th percentile)", subfolder)


def plot_sv_size_vs_quality(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    df_copy = normalize_svlen(df)
    
    # Filter out rows with SVLEN of 0 and SVTYPE of 'TR'
    df_copy = df_copy[~((df_copy["SVLEN"] == 0) & (df_copy["SVTYPE"] == "TRA"))]
    
    bounds = df_copy[["SVLEN", "QUAL"]].quantile([0.05, 0.95])
    filtered = df_copy[
        (df_copy["SVLEN"] >= bounds.loc[0.05, "SVLEN"])
        & (df_copy["SVLEN"] <= bounds.loc[0.95, "SVLEN"])
        & (df_copy["QUAL"] >= bounds.loc[0.05, "QUAL"])
        & (df_copy["QUAL"] <= bounds.loc[0.95, "QUAL"])
    ]

    # Sort filtered alphabetically by SVTYPE
    filtered = filtered.sort_values(by="SVTYPE")

    fig = px.scatter(
        filtered,
        x="SVLEN",
        y="QUAL",
        color="SVTYPE",
        labels={"SVLEN": "SV Length (bp)", "QUAL": "Quality Score"},
    )
    standard_layout(fig, "SV Size vs Quality Score (5th–95th percentile)")
    save_fig(fig, output_path)
    return _wrap_output(
        output_path, "SV Size vs Quality Score (5th–95th percentile)", subfolder
    )


def plot_sv_type_heatmap(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    sv_by_chrom = df.groupby(["CHROM", "SVTYPE"]).size().unstack().fillna(0)

    fig = go.Figure(
        data=go.Heatmap(
            z=sv_by_chrom.values,
            x=sv_by_chrom.columns,
            y=sv_by_chrom.index,
            colorscale="YlGnBu",
            hoverongaps=False,
        )
    )
    fig.update_layout(
        title="SV Type Heatmap by Chromosome",
        xaxis_title="SV Type",
        yaxis_title="Chromosome",
        template="plotly_white",
        margin=dict(l=40, r=40, t=60, b=60),
    )
    save_fig(fig, output_path)
    return _wrap_output(output_path, "SV Type Heatmap by Chromosome", subfolder)


def plot_cumulative_sv_length(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    if not {"SVLEN", "CHROM"}.issubset(df.columns):
        raise ValueError("Missing 'SVLEN' or 'CHROM' column in input DataFrame")

    df_copy = normalize_svlen(df)
    sv_length = df_copy.groupby("CHROM")["SVLEN"].sum().reset_index()
    sv_length.replace([np.inf, -np.inf], np.nan, inplace=True)
    sv_length.dropna(subset=["SVLEN"], inplace=True)

    fig = px.bar(
        sv_length,
        x="CHROM",
        y="SVLEN",
        labels={"CHROM": "Chromosome", "SVLEN": "Cumulative SV Length (bp)"},
        color="CHROM",
    )
    fig.update_layout(
        template="plotly_white", showlegend=False, margin=dict(l=40, r=40, t=60, b=60)
    )
    save_fig(fig, output_path)
    return _wrap_output(output_path, "Cumulative SV Length per Chromosome", subfolder)


def extract_callers_with_duplicates(id_field: Optional[str]) -> list[str]:
    if isinstance(id_field, list):
        id_field = ",".join(map(str, id_field))
    if not isinstance(id_field, str) or not id_field:
        return []
    
    callers = []
    for part in id_field.split(","):
        if "_" in part:
            callers.append(part.split("_")[0])
    return callers


def plot_bcf_exact_instance_combinations(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    df = df.copy()
    df["caller_list_raw"] = df["ID"].apply(extract_callers_with_duplicates)

    # Count the number of callers per SV
    df["num_callers"] = df["caller_list_raw"].apply(lambda x: len(x))

    # Split the caller list into separate columns for each caller
    callers = sorted(
        set([caller for sublist in df["caller_list_raw"].dropna() for caller in sublist]),
        key=lambda x: df["caller_list_raw"].apply(lambda y: x in y).sum(),
        reverse=True
    )
    for caller in callers:
        df[caller] = df["caller_list_raw"].apply(lambda x: int(caller in x))
    
    # Count how many SVs were called by exactly 1, 2, 3, ..., n callers
    counts = df.groupby("num_callers")[list(callers)].sum()

    # Plotting: We need to plot counts as the number of SVs called by 1, 2, 3, etc. callers
    # Calculate total counts for each number of callers
    total_counts = counts.sum(axis=1)
    
    fig = px.bar(
        counts,
        x=counts.index,
        y=counts.columns,
        title="SV Callers Distribution Across Different Number of Callers",
        labels={
            "x": "Number of Callers per SV",
            "y": "Count of SVs",
        },
        text_auto=True,
        orientation="v",  # Vertical bars
        barmode="stack",  # Stack the bars by caller
    )
    
    # Add secondary labels showing total counts
    fig.update_xaxes(
        ticktext=[f"{x}<br>(Count: {total_counts[x]})" for x in counts.index],
        tickvals=counts.index
    )

    # Update legend title to specify callers
    fig.update_layout(
        template="plotly_white",
        showlegend=True,
        legend_title="SV Callers",  # Title for the legend
        margin=dict(l=40, r=40, t=60, b=60)
    )

    # Customize axis titles further if needed
    fig.update_xaxes(title="Number of Callers per SV")
    fig.update_yaxes(title="Count of SVs")

    # Save the figure
    save_fig(fig, output_path)
    return _wrap_output(output_path, "SV Callers Distribution", subfolder)

def plot_survivor_exact_instance_combinations(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    df = df.copy()
    df["caller_list_raw"] = df["ID"].apply(extract_callers_with_duplicates)

    # Count the number of callers per SV
    df["num_callers"] = df["caller_list_raw"].apply(lambda x: len(x))

    # Split the caller list into separate columns for each caller
    callers = sorted(
        set([caller for sublist in df["caller_list_raw"].dropna() for caller in sublist]),
        key=lambda x: df["caller_list_raw"].apply(lambda y: x in y).sum(),
        reverse=True
    )
    for caller in callers:
        df[caller] = df["caller_list_raw"].apply(lambda x: int(caller in x))
    
    # Count how many SVs were called by exactly 1, 2, 3, ..., n callers
    counts = df.groupby("num_callers")[list(callers)].sum()

    # Plotting: We need to plot counts as the number of SVs called by 1, 2, 3, etc. callers
    # Calculate total counts for each number of callers
    total_counts = counts.sum(axis=1)
    
    fig = px.bar(
        counts,
        x=counts.index,
        y=counts.columns,
        title="Survivor Exact Caller Instance Combinations (Decoded)",
        labels={ 
            "x": "Number of Callers per SV",
            "y": "Count of SVs",
        },
        text_auto=True,
        orientation="v",  # Vertical bars
        barmode="stack",  # Stack the bars by caller
    )

    # Add secondary labels showing total counts
    fig.update_xaxes(
        ticktext=[f"{x}<br>(Count: {total_counts[x]})" for x in counts.index],
        tickvals=counts.index
    )

    # Update legend title to specify callers
    fig.update_layout(
        template="plotly_white",
        showlegend=True,
        legend_title="SV Callers",  # Title for the legend
        margin=dict(l=40, r=40, t=60, b=60)
    )

    # Customize axis titles further if needed
    fig.update_xaxes(title="Number of Callers per SV")
    fig.update_yaxes(title="Count of SVs")

    # Save the figure
    save_fig(fig, output_path)
    return _wrap_output(output_path, "Survivor Exact Caller Instance Combinations", subfolder)