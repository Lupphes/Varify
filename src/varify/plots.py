import os
from typing import Optional, Dict

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from scipy.stats import gaussian_kde


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


def empty_plot(
    title: str, output_path: str, subfolder: str = "plots"
) -> dict[str, str]:
    fig = go.Figure()
    fig.update_layout(title=title)
    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)


def extract_callers_with_duplicates(callers: Optional[str]) -> list[str]:
    if not callers:
        return []

    # Ensure input is a string
    callers_str = (
        ",".join(map(str, callers)) if isinstance(callers, list) else str(callers)
    )

    result = []
    for part in callers_str.split(","):
        result.append(part.strip())  # fallback for entries without "_"

    return result


def extract_callers(df: pd.DataFrame, column: str = "SUPP_CALLERS") -> pd.DataFrame:
    """Explodes the given caller column into a 'Caller' column for grouped analysis."""
    df = df.copy()
    df["caller_list"] = (
        df[column]
        .fillna("")
        .str.split(",")
        .apply(lambda x: [caller.strip() for caller in x if caller.strip()])
    )
    return df.explode("caller_list").rename(columns={"caller_list": "Caller"})


def plot_sv_callers(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Optional[Dict[str, str]]:
    title = "Structural Variant Callers"

    if df.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

    exploded = extract_callers(df)  # Uses SUPP_CALLERS by default

    # Count the number of times each caller appears
    caller_counts = exploded["Caller"].value_counts().reset_index()
    caller_counts.columns = ["Caller", "Count"]

    fig = px.bar(caller_counts, x="Caller", y="Count", color="Caller", title=title)
    standard_layout(fig, title)
    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)


def plot_sv_primary_callers(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    title = "Primary Structural Variant Callers"

    if df.empty or "PRIMARY_CALLER" not in df.columns:
        print("No data or 'PRIMARY_CALLER' column found.")
        return empty_plot(title, output_path, subfolder)

    df_counts = df["PRIMARY_CALLER"].value_counts().reset_index()
    df_counts.columns = ["Caller", "Count"]

    fig = px.bar(df_counts, x="Caller", y="Count", color="Caller", title=title)
    standard_layout(fig, title)
    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)


def plot_sv_type_distribution(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    title = "Structural Variant Type Distribution"

    filtered = df.dropna(subset=["SVTYPE"])
    if filtered.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

    fig = px.histogram(
        filtered.sort_values("SVTYPE"), x="SVTYPE", color="SVTYPE", title=title
    )
    standard_layout(fig, title)
    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)


def plot_sv_size_distribution(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    title = "Structural Variant Size Distribution (5th–95th percentile)"

    # Filter: remove SVLEN == 0 for translocations
    df_filtered = df[~((df["SVLEN"] == 0) & (df["SVTYPE"] == "TRA"))]

    # Percentile filter
    lower, upper = df_filtered["SVLEN"].quantile([0.05, 0.95])
    df_filtered = df_filtered[df_filtered["SVLEN"].between(lower, upper)]

    if df_filtered.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

    # Plot histogram
    fig = px.histogram(
        df_filtered,
        x="SVLEN",
        nbins=50,
        histnorm="percent",
        labels={"SVLEN": "SV Length (bp)"},
        range_y=[0, 100],
        title=title,
    )
    standard_layout(fig, title)
    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)


def plot_qual_distribution(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    title = "Quality Score Distribution (5th–95th percentile)"

    # Filter QUAL within 5th–95th percentile
    lower, upper = df["QUAL"].quantile([0.05, 0.95])
    filtered = df[df["QUAL"].between(lower, upper)]

    if filtered.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

    fig = px.histogram(
        filtered,
        x="QUAL",
        histnorm="percent",
        nbins=50,
        opacity=0.8,
        labels={"QUAL": "Quality Score"},
        title=title,
    )

    # Overlay KDE if enough variation
    if filtered["QUAL"].nunique() > 1:
        kde = gaussian_kde(filtered["QUAL"])
        x_vals = np.linspace(filtered["QUAL"].min(), filtered["QUAL"].max(), 1000)
        y_vals = kde(x_vals)

        # Normalize to percentage scale
        bin_width = (x_vals.max() - x_vals.min()) / 50
        y_vals_percent = (y_vals / (np.sum(y_vals) * bin_width)) * 100 * len(filtered)

        fig.add_trace(
            go.Scatter(
                x=x_vals,
                y=y_vals_percent,
                mode="lines",
                name="KDE",
                line=dict(color="red", width=2),
            )
        )

    fig.update_layout(
        template="plotly_white",
        margin=dict(l=40, r=40, t=60, b=60),
        xaxis_title="Quality Score",
        yaxis_title="Percentage",
    )

    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)


def plot_sv_type_vs_size(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    title = "Structural Variant Type vs Size Distribution (5th–95th percentile)"

    # Use absolute SVLEN and filter 5th–95th percentiles
    df_filtered = df.copy()
    df_filtered["SVLEN"] = df_filtered["SVLEN"].abs()
    lower, upper = df_filtered["SVLEN"].quantile([0.05, 0.95])
    df_filtered = df_filtered[df_filtered["SVLEN"].between(lower, upper)]

    if df_filtered.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

    # Create violin plot
    fig = px.violin(
        df_filtered.sort_values("SVTYPE"),
        x="SVTYPE",
        y="SVLEN",
        box=True,
        points="all",
        color="SVTYPE",
        labels={"SVLEN": "SV Length (bp)", "SVTYPE": "SV Type"},
        title=title,
    )

    standard_layout(fig, title)
    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)


def plot_sv_size_vs_quality(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    title = "SV Size vs Quality Score (5th–95th percentile)"

    # Filter out rows where SVLEN == 0 and SVTYPE == 'TRA'
    df_filtered = df[~((df["SVLEN"] == 0) & (df["SVTYPE"] == "TRA"))]

    # Filter 5th–95th percentiles for SVLEN and QUAL
    bounds = df_filtered[["SVLEN", "QUAL"]].quantile([0.05, 0.95])
    df_filtered = df_filtered[
        df_filtered["SVLEN"].between(
            bounds.loc[0.05, "SVLEN"], bounds.loc[0.95, "SVLEN"]
        )
        & df_filtered["QUAL"].between(
            bounds.loc[0.05, "QUAL"], bounds.loc[0.95, "QUAL"]
        )
    ]

    if df_filtered.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

    fig = px.scatter(
        df_filtered.sort_values("SVTYPE"),
        x="SVLEN",
        y="QUAL",
        color="SVTYPE",
        labels={"SVLEN": "SV Length (bp)", "QUAL": "Quality Score"},
        title=title,
    )

    standard_layout(fig, title)
    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)


def plot_sv_type_heatmap(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    title = "Structural Variant Type Heatmap by Chromosome"

    sv_by_chrom = df.groupby(["CHROM", "SVTYPE"]).size().unstack(fill_value=0)
    if sv_by_chrom.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

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
        title=title,
        xaxis_title="SV Type",
        yaxis_title="Chromosome",
        template="plotly_white",
        margin=dict(l=40, r=40, t=60, b=60),
    )

    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)


def plot_cumulative_sv_length(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    title = "Cumulative Structural Variant Length per Chromosome"

    if not {"SVLEN", "CHROM"}.issubset(df.columns):
        raise ValueError("Missing 'SVLEN' or 'CHROM' column in input DataFrame")

    sv_length = (
        df.groupby("CHROM")["SVLEN"]
        .sum()
        .replace([np.inf, -np.inf], np.nan)
        .dropna()
        .reset_index()
    )

    if sv_length.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

    fig = px.bar(
        sv_length,
        x="CHROM",
        y="SVLEN",
        labels={"CHROM": "Chromosome", "SVLEN": "Cumulative SV Length (bp)"},
        color="CHROM",
        title=title,
    )
    fig.update_layout(
        template="plotly_white", showlegend=False, margin=dict(l=40, r=40, t=60, b=60)
    )
    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)


def plot_bcf_exact_instance_combinations(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    if df.empty:
        print("No data to plot.")
        return empty_plot(
            "Structural Variant Caller Distribution", output_path, subfolder
        )

    df = df.copy()
    df["caller_list_raw"] = df["SUPP_CALLERS"].apply(extract_callers_with_duplicates)

    # Count the number of callers per SV
    df["num_callers"] = df["caller_list_raw"].apply(lambda x: len(x))

    # Split the caller list into separate columns for each caller
    callers = sorted(
        set(
            [caller for sublist in df["caller_list_raw"].dropna() for caller in sublist]
        ),
        key=lambda x: df["caller_list_raw"].apply(lambda y: x in y).sum(),
        reverse=True,
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
        title="Structural Variant Caller Distribution",
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
        ticktext=[
            f"{x}<br>(Count: {total_counts[x] if x in total_counts.keys() else 0})"
            for x in range(1, max(counts.index) + 1)
        ],
        tickvals=list(range(1, max(counts.index) + 1)),
    )

    fig.update_yaxes(range=[0, counts.sum(axis=1).max() * 1.1])

    # Add slider
    fig.update_layout(
        sliders=[
            dict(
                active=0,  # Start with minimum elements visible
                y=-0.5,  # Position of first slider
                currentvalue={"prefix": "Min. Number of Callers: "},
                steps=[
                    dict(
                        label=str(i + 1),
                        method="update",
                        args=[
                            {
                                "x": [counts.index[i:]],  # Show from i onwards
                                "y": [counts.iloc[i:][col] for col in counts.columns],
                            },
                            {
                                "yaxis": {
                                    "range": [
                                        0,
                                        counts.iloc[i:].sum(axis=1).max() * 1.1,
                                    ]
                                }
                            },
                        ],
                    )
                    for i in range(len(counts.index))
                ],
            ),
            dict(
                active=len(counts.index) - 1,  # Start with all elements visible
                y=-1.0,  # Position of second slider
                currentvalue={"prefix": "Max. Number of Callers: "},
                steps=[
                    dict(
                        label=str(i + 1),
                        method="update",
                        args=[
                            {
                                "x": [
                                    counts.index[: i + 1]
                                ],  # Show only up to i+1 elements
                                "y": [
                                    counts.iloc[: i + 1][col] for col in counts.columns
                                ],
                            },
                            {
                                "yaxis": {
                                    "range": [
                                        0,
                                        counts.iloc[: i + 1].sum(axis=1).max() * 1.1,
                                    ]
                                }
                            },
                        ],
                    )
                    for i in range(len(counts.index))
                ],
            ),
        ]
    )

    # Update legend title to specify callers
    fig.update_layout(
        template="plotly_white",
        showlegend=True,
        legend_title="SV Callers",  # Title for the legend
        margin=dict(l=40, r=40, t=60, b=60),
    )

    # Customize axis titles further if needed
    fig.update_xaxes(title="Number of Callers per SV")
    fig.update_yaxes(title="Count of SVs")

    # Save the figure
    save_fig(fig, output_path)
    return _wrap_output(output_path, "Structural Variant Caller Distribution", subfolder)


def plot_survivor_exact_instance_combinations(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    if df.empty:
        print("No data to plot.")
        return empty_plot(
            "Structural Variant Caller Distribution", output_path, subfolder
        )

    df = df.copy()
    df["caller_list_raw"] = df["SUPP_CALLERS"].apply(extract_callers_with_duplicates)

    # Count the number of callers per SV
    df["num_callers"] = df["caller_list_raw"].apply(lambda x: len(x))

    # Split the caller list into separate columns for each caller
    callers = sorted(
        set(
            [caller for sublist in df["caller_list_raw"].dropna() for caller in sublist]
        ),
        key=lambda x: df["caller_list_raw"].apply(lambda y: x in y).sum(),
        reverse=True,
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
        title="Structural Variant Caller Distribution",
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
        ticktext=[
            f"{x}<br>(Count: {total_counts[x] if x in total_counts.keys() else 0})"
            for x in range(1, max(counts.index) + 1)
        ],
        tickvals=list(range(1, max(counts.index) + 1)),
    )

    fig.update_yaxes(range=[0, counts.sum(axis=1).max() * 1.1])

    # Add slider
    fig.update_layout(
        sliders=[
            dict(
                active=0,  # Start with minimum elements visible
                y=-0.5,  # Position of first slider
                currentvalue={"prefix": "Min. Number of Callers: "},
                steps=[
                    dict(
                        label=str(i + 1),
                        method="update",
                        args=[
                            {
                                "x": [counts.index[i:]],  # Show from i onwards
                                "y": [counts.iloc[i:][col] for col in counts.columns],
                            },
                            {
                                "yaxis": {
                                    "range": [
                                        0,
                                        counts.iloc[i:].sum(axis=1).max() * 1.1,
                                    ]
                                }
                            },
                        ],
                    )
                    for i in range(len(counts.index))
                ],
            ),
            dict(
                active=len(counts.index) - 1,  # Start with all elements visible
                y=-1.0,  # Position of second slider below first
                currentvalue={"prefix": "Max. Number of Callers: "},
                steps=[
                    dict(
                        label=str(i + 1),
                        method="update",
                        args=[
                            {
                                "x": [
                                    counts.index[: i + 1]
                                ],  # Show only up to i+1 elements
                                "y": [
                                    counts.iloc[: i + 1][col] for col in counts.columns
                                ],
                            },
                            {
                                "yaxis": {
                                    "range": [
                                        0,
                                        counts.iloc[: i + 1].sum(axis=1).max() * 1.1,
                                    ]
                                }
                            },
                        ],
                    )
                    for i in range(len(counts.index))
                ],
            ),
        ]
    )

    # Update legend title to specify callers
    fig.update_layout(
        template="plotly_white",
        showlegend=True,
        legend_title="SV Callers",  # Title for the legend
        margin=dict(l=40, r=40, t=60, b=60),
    )

    # Customize axis titles further if needed
    fig.update_xaxes(title="Number of Callers per SV")
    fig.update_yaxes(title="Count of SVs")

    # Save the figure
    save_fig(fig, output_path)
    return _wrap_output(
        output_path, "Structural Variant Caller Distribution", subfolder
    )


def plot_sv_types_by_caller(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    title = "Types Reported by Caller"

    if df.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

    exploded = extract_callers(df)

    counts = pd.crosstab(exploded["Caller"], exploded["SVTYPE"])
    if counts.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

    counts = counts.loc[counts.sum(axis=1).sort_values(ascending=False).index]

    fig = px.bar(
        counts,
        title=title,
        labels={"value": "Count", "Caller": "Caller", "SVTYPE": "SV Type"},
        barmode="stack",
    )

    standard_layout(fig, title)
    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)


def plot_quality_by_caller(
    df: pd.DataFrame, output_path: str, subfolder: str = "plots"
) -> Dict[str, str]:
    title = "Quality Spread of Structural Variants by Supporting Callers (5th–95th percentile)"

    if df.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

    # Filter QUAL between 5th and 95th percentiles
    lower, upper = df["QUAL"].quantile([0.05, 0.95])
    df = df[df["QUAL"].between(lower, upper)]

    if df.empty:
        print("No data to plot.")
        return empty_plot(title, output_path, subfolder)

    exploded = extract_callers(df)

    fig = px.violin(
        exploded,
        x="Caller",
        y="QUAL",
        box=True,
        points="all",
        title=title,
        labels={"QUAL": "Quality Score", "Caller": "Caller"},
    )

    standard_layout(fig, title)
    save_fig(fig, output_path)
    return _wrap_output(output_path, title, subfolder)
