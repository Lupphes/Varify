import os


def generate_combined_report(
    env,
    combined_report_file,
    bfc_html_path,
    survivor_html_path,
    bfc_df,
    bcf_stats,
    survivor_df,
    survivor_stats,
    bfc_plots,
    survivor_plots,
):
    with open(bfc_html_path, "r") as f:
        bfc_html = f.read()

    with open(survivor_html_path, "r") as f:
        survivor_html = f.read()

    bfc_summary = {
        "Total Variants": len(bfc_df),
        "Unique SV Types": bfc_df["SVTYPE"].nunique(),
        "Median Quality Score": (
            round(bfc_df["QUAL"].median(), 2)
            if not bfc_df["QUAL"].isna().all()
            else "N/A"
        ),
    }

    survivor_summary = {
        "Total Variants": len(survivor_df),
        "Unique SV Types": survivor_df["SVTYPE"].nunique(),
        "Median Quality Score": (
            round(survivor_df["QUAL"].median(), 2)
            if not survivor_df["QUAL"].isna().all()
            else "N/A"
        ),
    }

    bcf_stats_html = {
        key: df.to_html(classes="table table-bordered") for key, df in bcf_stats.items()
    }

    template = env.get_template("combined_report_template.html")
    rendered_html = template.render(
        bfc_html=bfc_html,
        survivor_html=survivor_html,
        bfc_summary=bfc_summary,
        survivor_summary=survivor_summary,
        survivor_stats=survivor_stats.to_html(classes="table table-bordered"),
        bcf_stats_html=bcf_stats_html,
        bfc_plots=bfc_plots,
        survivor_plots=survivor_plots,
        generated_on=os.popen("date").read().strip(),
    )

    with open(combined_report_file, "w") as f:
        f.write(rendered_html)

    print(f"Combined report saved to {combined_report_file}")
