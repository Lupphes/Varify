import os
from typing import List, Optional
import pandas as pd
import json

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
        <div class="mb-6 mt-6 mx-4 overflow-x-auto">
            <h3 class="text-lg font-semibold mb-2">{title}</h3>
            <p class="text-sm text-gray-600 mb-3">{description}</p>
            <div class="overflow-x-auto bg-white border border-gray-300 rounded-md shadow-sm">
                {table_html}
            </div>
        </div>
    """

def render_interactive_variant_table(
    df: pd.DataFrame,
    table_id: str,
    label: str,
    columns_to_display: Optional[List[str]] = None
) -> str:
    if columns_to_display is None:
        display_columns = [
            col for col in df.columns
            if col not in ("INFO", "FORMAT") and not df[col].apply(lambda x: isinstance(x, list)).any()
        ]
    else:
        display_columns = [col for col in columns_to_display if col in df.columns]

    df_to_display = df[display_columns].copy()
    
    # Add checkbox column first
    df_to_display["Select"] = "checkbox"  # Use a placeholder value
    
    # Define column priority
    header_priority = [
        # Core variant identification
        "unique_id", "CHROM", "POSITION", "ID", "REF", "ALT",
        # Core structural variant fields
        "SVTYPE", "END", "SVLEN",
        # Support/caller-related
        "CALLER", "FILTER",
        # Quality and alignment
        "QUAL", "STRANDS",
        # Breakpoint and confidence info
        "CHROM2", "IMPRECISE", "PRECISE",
        # Event and mate info
        "MATE_ID", "EVENT_ID"
    ]

    # Reorder columns based on priority
    # First, get columns that are in the priority list
    ordered_columns = [col for col in header_priority if col in df_to_display.columns]
    # Then add any remaining columns that weren't in the priority list
    remaining_columns = [col for col in df_to_display.columns if col not in ordered_columns and col != "Select"]
    final_columns = ["Select"] + ordered_columns + remaining_columns
    
    # Reorder the DataFrame
    df_to_display = df_to_display[final_columns]

    # Preprocess categorical columns (excluding the Select column)
    for col in df_to_display.select_dtypes(include="object").columns:
        if col != "Select":  # Skip preprocessing for the Select column
            # Convert to string and clean up
            df_to_display[col] = df_to_display[col].astype(str)
            # Remove leading/trailing whitespace
            df_to_display[col] = df_to_display[col].str.strip()
            # Truncate long strings
            df_to_display[col] = df_to_display[col].str.slice(0, 100)
            # Replace empty strings with None
            df_to_display[col] = df_to_display[col].replace('', None)

    # Get unique values for categorical fields before creating the table
    categorical_fields = [
        col for col in df_to_display.columns
        if df_to_display[col].nunique() <= 30 and col != "Select"
    ]
    
    # Create a mapping of column names to their unique values
    categorical_values = {
        col: sorted(df_to_display[col].dropna().unique().tolist())
        for col in categorical_fields
    }

    table_html = df_to_display.to_html(
        index=False,
        escape=False,
        table_id=table_id,
        classes="stripe hover row-border order-column nowrap text-sm",
        border=0,
    )

    # Replace the placeholder values with actual checkboxes
    table_html = table_html.replace(
        '>checkbox<', '><input type="checkbox" class="row-checkbox" /><'
    ).replace(
        "<th>Select</th>", '<th><input type="checkbox" id="select-all" /></th>'
    )

    filter_inputs_html = "".join([
        f"""
        <label for="filter_{col}" class="mr-2 text-sm font-medium text-gray-700">{col}:</label>
        <select id="filter_{col}" class="mr-4 px-2 py-1 border rounded text-sm bg-white text-gray-800">
            <option value="">All</option>
            {"".join(f'<option value="{val}">{val}</option>' for val in values)}
        </select>
        """ for col, values in categorical_values.items()
    ])

    return f"""
    <div class="mb-6 mt-6 mx-4">
        <h3 class="text-lg font-semibold mb-2">{label} Variant Table</h3>
        <p class="text-sm text-gray-600 mb-3">
            Interactive structural variant table from the {label.upper()} VCF file.
        </p>
        <div class="flex flex-wrap gap-4 mb-4 items-center">
            <div class="flex-1">
                <input type="text" id="global-search" placeholder="Search across all columns..." 
                       class="w-full px-3 py-1 border rounded text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            {filter_inputs_html}
            <div class="flex gap-2">
                <button onclick="exportSelectedToCSV('{table_id}')" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">CSV</button>
            </div>
        </div>
        <div class="bg-white border border-gray-300 rounded-md shadow-sm p-2">
            <div style="overflow-x: auto;">
                {table_html}
            </div>
        </div>
    </div>

    <script>
        $(document).ready(function() {{
            const table = $('#{table_id}').DataTable({{
                scrollX: true,
                scrollY: '400px',
                scrollCollapse: true,
                paging: false,
                pageLength: -1,
                dom: 'rt',
                buttons: [],
                fixedHeader: true,
                order: [], // Disable initial sorting
                search: {{ return: true }}, // Enable search functionality
                columnDefs: [
                    {{
                        targets: 'caller-checkbox',
                        render: function(data, type, row) {{
                            if (type === 'display') {{
                                const callers = data.split(',').filter(c => c);
                                return callers.map(caller => 
                                    `<div class="flex items-center">
                                        <input type="checkbox" class="caller-checkbox" value="${{caller}}" 
                                               ${{caller_list_raw.includes(caller) ? 'checked' : ''}}>
                                        <span class="ml-1">${{caller}}</span>
                                    </div>`
                                ).join('');
                            }}
                            return data;
                        }}
                    }}
                ]
            }});

            // Add global search functionality
            $('#global-search').on('keyup', function() {{
                table.search(this.value).draw();
                
                // Update select-all checkbox state after searching
                const visibleRows = table.rows({{ search: 'applied' }}).nodes();
                const visibleCheckboxes = $('.row-checkbox', visibleRows);
                const allChecked = visibleCheckboxes.length > 0 && 
                                 visibleCheckboxes.filter(':checked').length === visibleCheckboxes.length;
                $('#select-all').prop('checked', allChecked);
            }});

            // Fix checkbox functionality
            $('#select-all').on('click', function () {{
                const isChecked = $(this).prop('checked');
                table.rows({{ search: 'applied' }}).every(function () {{
                    const row = this.node();
                    $('input.row-checkbox', row).prop('checked', isChecked);
                }});
            }});

            // Handle individual row checkboxes
            $('#{table_id} tbody').on('change', '.row-checkbox', function() {{
                const visibleRows = table.rows({{ search: 'applied' }}).nodes();
                const visibleCheckboxes = $('.row-checkbox', visibleRows);
                const allChecked = visibleCheckboxes.length > 0 && 
                                 visibleCheckboxes.filter(':checked').length === visibleCheckboxes.length;
                $('#select-all').prop('checked', allChecked);
            }});

            // Handle caller checkbox changes
            $('#{table_id} tbody').on('change', '.caller-checkbox', function() {{
                const caller = $(this).val();
                const row = $(this).closest('tr');
                const callerList = row.find('.caller-list').val().split(',').filter(c => c);
                
                if ($(this).is(':checked')) {{
                    if (!callerList.includes(caller)) {{
                        callerList.push(caller);
                    }}
                }} else {{
                    const index = callerList.indexOf(caller);
                    if (index > -1) {{
                        callerList.splice(index, 1);
                    }}
                }}
                
                row.find('.caller-list').val(callerList.join(','));
            }});

            // Add event listeners for filters
            const categoricalFields = {categorical_fields};
            categoricalFields.forEach(function(colName) {{
                const colIdx = $('#{table_id} thead th').filter(function () {{
                    return $(this).text().trim() === colName;
                }}).index();

                $('#filter_' + colName).on('change', function () {{
                    const searchValue = this.value;
                    table.column(colIdx).search(searchValue).draw();
                    
                    // Update select-all checkbox state after filtering
                    const visibleRows = table.rows({{ search: 'applied' }}).nodes();
                    const visibleCheckboxes = $('.row-checkbox', visibleRows);
                    const allChecked = visibleCheckboxes.length > 0 && 
                                     visibleCheckboxes.filter(':checked').length === visibleCheckboxes.length;
                    $('#select-all').prop('checked', allChecked);
                }});
            }});
        }});

        function exportSelectedToCSV(tableId) {{
            const rows = getSelectedRows(tableId);
            if (rows.length === 0) return alert("No rows selected.");
            const csv = [Object.keys(rows[0]).join(",")];
            rows.forEach(row => {{
                csv.push(Object.values(row).map(v => '"' + v + '"').join(","));
            }});
            downloadFile(csv.join("\\n"), "selected_variants.csv", "text/csv");
        }}

        function getSelectedRows(tableId) {{
            const table = $('#' + tableId).DataTable();
            const headers = table.columns().header().toArray().map(h => $(h).text().trim()).slice(1);
            const rows = [];
            table.rows().every(function () {{
                const row = this.node();
                if ($('input.row-checkbox', row).is(':checked')) {{
                    const data = this.data();
                    const values = Object.values(data).slice(1);
                    const rowObj = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
                    rows.push(rowObj);
                }}
            }});
            return rows;
        }}

        function downloadFile(content, filename, mimeType) {{
            const blob = content instanceof Blob ? content : new Blob([content], {{ type: mimeType }});
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }}
    </script>
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
    bcf_sample_columns,
    survivor_sample_columns
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

    bcf_variant_table_html = render_interactive_variant_table(
        bcf_df,
        table_id="bcf_variant_table",
        label="BCF",
        columns_to_display=bcf_sample_columns
    )
    survivor_variant_table_html = render_interactive_variant_table(
        survivor_df,
        table_id="survivor_variant_table",
        label="SURVIVOR",
        columns_to_display=survivor_sample_columns
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
        bcf_variant_table_html=bcf_variant_table_html,
        survivor_variant_table_html=survivor_variant_table_html,
    )

    with open(combined_report_file, "w") as f:
        f.write(rendered_html)

    print(f"Combined report saved to {combined_report_file}")
