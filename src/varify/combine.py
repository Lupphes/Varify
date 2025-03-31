import os
import pandas as pd

BCFTOOLS_SECTION_DESCRIPTIONS = {
    "SN": (
        "<strong>Summary Numbers</strong> – Provides a high-level overview of variant counts, "
        "including total variants, SNPs (single nucleotide polymorphisms), indels (insertions/deletions), and other types."
    ),
    "TSTV": (
        "<strong>Transition/Transversion Ratio</strong> – Displays the ratio of transitions "
        "(e.g. A↔G, C↔T) to transversions (e.g. A↔C, G↔T) for each chromosome. This is a common metric for assessing variant call quality."
    ),
    "SiS": (
        "<strong>Singleton Site Statistics</strong> – Shows statistics for variants that occur only once in the dataset, "
        "including breakdowns by variant type and whether they appear in repeat regions."
    ),
    "AF": (
        "<strong>Allele Frequency Bins</strong> – Groups variants by allele frequency, "
        "and summarizes the types of changes (SNPs, transitions, transversions, indels) for each frequency range."
    ),
    "QUAL": (
        "<strong>Quality Score Distribution</strong> – Summarizes how variant calls are distributed across quality score bins, "
        "including SNP and indel breakdowns, helping you identify low-confidence variants."
    ),
    "IDD": (
        "<strong>Indel Distribution Details</strong> – Provides detailed information on insertions and deletions, "
        "including lengths, variant counts, genotype counts, and mean variant allele frequency."
    ),
    "ST": (
        "<strong>Simple Variant Type Counts</strong> – Counts the number of variants by type "
        "(e.g. SNPs, indels) across the dataset."
    ),
    "DP": (
        "<strong>Depth of Coverage</strong> – Distribution of sequencing read depth across genotypes and variant sites, "
        "helping assess data completeness and reliability."
    ),
}


def render_stats_table(title: str, description: str, df: pd.DataFrame) -> str:
    table_html = df.to_html(
        classes="min-w-full table-auto text-sm text-left text-gray-700",
        border=0,
        index=False,
        escape=False,
    )

    # Remove default Pandas styling
    table_html = table_html.replace(' style="text-align: right;"', "")
    table_html = table_html.replace(' style="text-align: right"', "")

    # Apply Tailwind styling
    table_html = (
        table_html.replace(
            "<thead>",
            '<thead class="bg-blue-600 text-white text-sm uppercase tracking-wider">',
        )
        .replace("<tbody>", '<tbody class="divide-y divide-gray-200">')
        .replace("<tr>", '<tr class="hover:bg-gray-50 even:bg-gray-50">')
        .replace("<th>", '<th class="px-4 py-2 font-medium">')
        .replace("<td>", '<td class="px-4 py-2">')
    )

    return f"""
        <div class="mb-6 overflow-x-auto">
            <h3 class="text-lg font-semibold mb-2">{title}</h3>
            <p class="text-sm text-gray-600 mb-3">{description}</p>
            <div class="overflow-x-auto bg-white border border-gray-300 rounded-md shadow-sm">
                {table_html}
            </div>
        </div>
    """


def generate_combined_report(
    env,
    combined_report_file,
    bcf_html_path,
    survivor_html_path,
    bcf_df,
    bcf_stats,
    survivor_df,
    survivor_stats,
    bcf_plots,
    survivor_plots,
    profiles,
    reference_name,
):
    with open(bcf_html_path, "r") as f:
        bcf_html = f.read()

    with open(survivor_html_path, "r") as f:
        survivor_html = f.read()

    bcf_summary = {
        "total_sv": len(bcf_df),
        "unique_sv": bcf_df["SVTYPE"].nunique(),
        "mqs": (
            round(bcf_df["QUAL"].median(), 2)
            if not bcf_df["QUAL"].isna().all()
            else "N/A"
        ),
    }

    survivor_summary = {
        "total_sv": len(survivor_df),
        "unique_sv": survivor_df["SVTYPE"].nunique(),
        "mqs": (
            round(survivor_df["QUAL"].median(), 2)
            if not survivor_df["QUAL"].isna().all()
            else "N/A"
        ),
    }

    bcf_stats_html = {
        key: render_stats_table(
            title=f"BCFtools - {key} Section",
            description=BCFTOOLS_SECTION_DESCRIPTIONS.get(
                key, "No description available."
            ),
            df=df,
        )
        for key, df in bcf_stats.items()
    }

    survivor_stats_html = render_stats_table(
        title="SURVIVOR Summary Table",
        description=(
            "This table summarizes structural variant types (e.g., Deletions, Duplications, Insertions, Translocations) "
            "across different size ranges. It is derived from SURVIVOR's support file and shows how many variants "
            "fall into each class."
        ),
        df=survivor_stats.reset_index(),
    )

    template = env.get_template("combined_report_template.html")
    rendered_html = template.render(
        bcf_html=bcf_html,
        survivor_html=survivor_html,
        bcf_summary=bcf_summary,
        survivor_summary=survivor_summary,
        survivor_stats=survivor_stats_html,
        bcf_stats_html=bcf_stats_html,
        bcf_plots=bcf_plots,
        survivor_plots=survivor_plots,
        generated_on=os.popen("date").read().strip(),
        BCFTOOLS_SECTION_DESCRIPTIONS=BCFTOOLS_SECTION_DESCRIPTIONS,
        profiles=profiles,
        reference_name=os.path.basename(reference_name),
    )

    with open(combined_report_file, "w") as f:
        f.write(rendered_html)

    print(f"Combined report saved to {combined_report_file}")
