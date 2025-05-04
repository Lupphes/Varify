import os
from typing import List, Optional
import pandas as pd
import json
import numpy as np

from .parser import VcfType

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
    label: VcfType,
    columns_to_display: Optional[List[str]] = None,
) -> str:
    if columns_to_display is None:
        display_columns = [
            col
            for col in df.columns
            if col not in ("INFO", "FORMAT")
            and not df[col].apply(lambda x: isinstance(x, list)).any()
            and not df[col].isna().all()  # Drop columns that are all NaN
        ]
    else:
        display_columns = [
            col
            for col in columns_to_display
            if col in df.columns and not df[col].isna().all()
        ]

    df_to_display = df[display_columns].copy()

    header_priority = [
        "unique_id",
        "CHROM",
        "SUPP_CALLERS",
        "ID",
        "SVTYPE",
        "SVLEN",
        "POSITION",
        "END",
        "PRIMARY_CALLER",
        "FILTER",
        "QUAL",
        "STRANDS",
        "MATE_ID",
        "EVENT_ID",
        "CIPOS",
        "CIEND",
        "HOMSEQ",
        "HOMLEN",
        "REF",
        "ALT",
        "CHROM2",
        "IMPRECISE",
        "PRECISE",
    ]

    ordered_columns = [col for col in header_priority if col in df_to_display.columns]
    remaining_columns = [
        col for col in df_to_display.columns if col not in ordered_columns
    ]
    final_columns = ["Select"] + ordered_columns + remaining_columns
    df_to_display["Select"] = "checkbox"
    df_to_display = df_to_display[final_columns]

    # Preprocess categorical columns (excluding the Select column)
    for col in df_to_display.select_dtypes(include="object").columns:
        if col != "Select":  # Skip preprocessing for the Select column
            # Skip string conversion for columns that contain lists
            if not df_to_display[col].apply(lambda x: isinstance(x, list)).any():
                # Convert to string and clean up
                df_to_display[col] = df_to_display[col].astype(str)
                # Remove leading/trailing whitespace
                df_to_display[col] = df_to_display[col].str.strip()
                # Truncate long strings
                df_to_display[col] = df_to_display[col].str.slice(0, 100)
                # Replace empty strings with None
                df_to_display[col] = df_to_display[col].replace("", None)

    # Get unique values for categorical fields before creating the table
    format_fields = {"GT", "PR", "SR", "GQ", "REF", "END"}
    categorical_fields = [
        col
        for col in df_to_display.columns
        if col != "Select"
        and col not in format_fields
        and not df_to_display[col]
        .apply(lambda x: isinstance(x, list))
        .any()  # Check for lists first
        and df_to_display[col].nunique()
        <= 100  # Only count unique values for non-list columns
    ]

    # Create a mapping of column names to their unique values
    categorical_values = {
        col: sorted(df_to_display[col].dropna().unique().tolist())
        for col in categorical_fields
    }

    # Handle different types of null values: None, empty strings, empty lists, and NaN
    for col in df_to_display.columns:
        if df_to_display[col].dtype == "object":  # For string and mixed columns
            df_to_display[col] = df_to_display[col].apply(
                lambda x: (
                    "-"
                    if (isinstance(x, list) and len(x) == 0)
                    or (
                        not isinstance(x, list) and (pd.isna(x) or x is None or x == "")
                    )
                    else x
                )
            )
        else:  # For numeric columns
            df_to_display[col] = df_to_display[col].fillna("-")

    table_html = df_to_display.to_html(
        index=False,
        escape=False,
        table_id=table_id,
        classes="stripe hover row-border order-column nowrap text-sm",
        border=0,
    )

    # Replace the placeholder values with actual checkboxes
    table_html = table_html.replace(
        ">checkbox<", '><input type="checkbox" class="row-checkbox" /><'
    ).replace("<th>Select</th>", '<th><input type="checkbox" id="select-all" /></th>')

    filter_inputs_html = "".join(
        [
            (
                f"""
        <label for="filter_{label.value}_{col}" class="mr-2 text-sm font-medium text-gray-700">{col}:</label>
        <div class="relative inline-block text-left mr-4">
            <button type="button" class="px-2 py-1 border rounded text-sm bg-white text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" id="dropdown_{label.value}_{col}">All</button>
            <div class="hidden origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10" id="dropdown-menu_{label.value}_{col}">
                <div class="py-1 max-h-60 overflow-y-auto">
                    {"".join(f'''
                    <div class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <label class="flex items-center">
                            <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600" value="{val}">
                            <span class="ml-2">{val}</span>
                        </label>
                    </div>
                    ''' for val in values)}
                </div>
            </div>
        </div>
        """
                if col == "SUPP_CALLERS"
                else f"""
        <label for="filter_{label.value}_{col}" class="mr-2 text-sm font-medium text-gray-700">{col}:</label>
        <select id="filter_{label.value}_{col}" class="mr-4 px-2 py-1 border rounded text-sm bg-white text-gray-800">
            <option value="">All</option>
            {"".join(f'<option value="{val}">{val}</option>' for val in values)}
        </select>
        """
            )
            for col, values in categorical_values.items()
        ]
    )

    return f"""
    <div class="mb-6 mt-6 mx-4">
        <h3 class="text-lg font-semibold mb-2">{label.value.upper()} Variant Table</h3>
        <p class="text-sm text-gray-600 mb-3">
            Interactive structural variant table from the {label.value.upper()} VCF file.
        </p>
        <div class="flex flex-wrap gap-4 mb-4 items-center">
            <div class="flex-1">
                <input type="text" id="global-search-{label.value}" placeholder="Search across all columns..." 
                       class="w-48 px-3 py-1 border rounded text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            {filter_inputs_html}
            <div class="flex items-center mt-2">
                <label for="min_callers_{label.value}" class="mr-2 text-sm font-medium text-gray-700">Number of callers:</label>
                <select id="min_callers_{label.value}" class="w-20 px-2 py-1 border rounded text-sm bg-white text-gray-800">
                    <option value="0">All</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                    <option value="4">4+</option>
                    <option value="5">5+</option>
                </select>
            </div>
            <div class="flex gap-2">
                <button onclick="exportSelectedToCSV('{table_id}')" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">CSV</button>
                <button onclick="exportSelectedToVCF('{table_id}')" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">VCF</button>
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
            }});

            // Add global search functionality
            $('#global-search-{label.value}').on('keyup', function() {{
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

            // Add event listeners for filters
            const categoricalFields = {categorical_fields};
            categoricalFields.forEach(function(colName) {{
                if (colName.trim() === 'SUPP_CALLERS') {{
                    const colIdx = $('#{table_id} thead th').filter(function () {{
                        return $(this).text().trim() === colName;
                    }}).index();
                    
                    // Convert column data to strings using DataTables API
                    const columnData = table.column(colIdx).data();
                    const stringData = [];
                    for (let i = 0; i < columnData.length; i++) {{
                        stringData[i] = String(columnData[i] || '');
                    }}
                    table.column(colIdx).data(stringData);

                    // Filter out values containing commas from the select box
                    const uniqueValues = [...new Set(stringData)].filter(val => !val.includes(','));
                    const dropdownMenu = $('#dropdown-menu_{label.value}_' + colName);
                    dropdownMenu.empty();
                    uniqueValues.forEach(val => {{
                        dropdownMenu.append(`
                            <div class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <label class="flex items-center">
                                    <input type="checkbox" class="form-checkbox h-4 w-4 text-blue-600" value="${{val}}">
                                    <span class="ml-2">${{val}}</span>
                                </label>
                            </div>
                        `);
                    }});

                    // Toggle dropdown menu
                    $('#dropdown_{label.value}_' + colName).on('click', function(e) {{
                        e.stopPropagation();
                        $('#dropdown-menu_{label.value}_' + colName).toggleClass('hidden');
                    }});

                    // Close dropdown when clicking outside
                    $(document).on('click', function(e) {{
                        if (!$(e.target).closest('#dropdown_{label.value}_' + colName).length) {{
                            $('#dropdown-menu_{label.value}_' + colName).addClass('hidden');
                        }}
                    }});

                    // Handle checkbox changes
                    $('#dropdown-menu_{label.value}_' + colName).on('change', 'input[type="checkbox"]', function() {{
                        const selectedValues = $('#dropdown-menu_{label.value}_' + colName + ' input[type="checkbox"]:checked')
                            .map(function() {{ return $(this).val(); }}).get();
                        
                        if (selectedValues.length === 0) {{
                            table.column(colIdx).search('').draw();
                        }} else {{
                            const searchPattern = selectedValues.map(val => `(?=.*${{val}})`).join('');
                            table.column(colIdx).search(searchPattern, true, false).draw();
                        }}

                        // Update button text
                        const buttonText = selectedValues.length > 0 
                            ? `${{selectedValues}}`
                            : `All`;
                        $('#dropdown_{label.value}_' + colName).text(buttonText);
                        
                        // Update select-all checkbox state after filtering
                        const visibleRows = table.rows({{ search: 'applied' }}).nodes();
                        const visibleCheckboxes = $('.row-checkbox', visibleRows);
                        const allChecked = visibleCheckboxes.length > 0 && 
                                        visibleCheckboxes.filter(':checked').length === visibleCheckboxes.length;
                        $('#select-all').prop('checked', allChecked);
                    }});
                }}
                else {{
                    const colIdx = $('#{table_id} thead th').filter(function () {{
                        return $(this).text().trim() === colName;
                    }}).index();

                    $('#filter_{label.value}_' + colName).on('change', function () {{
                        const searchValue = this.value === '' ? '.*' : "(^"+this.value+"$)";
                        table.column(colIdx).search(searchValue, true, false).draw();
                        
                        // Update select-all checkbox state after filtering
                        const visibleRows = table.rows({{ search: 'applied' }}).nodes();
                        const visibleCheckboxes = $('.row-checkbox', visibleRows);
                        const allChecked = visibleCheckboxes.length > 0 && 
                                        visibleCheckboxes.filter(':checked').length === visibleCheckboxes.length;
                        $('#select-all').prop('checked', allChecked);
                    }});
                }}
            }});
            
            // Add event listener for caller count filter
            $('#min_callers_{label.value}').on('change', function () {{
                const minCallers = parseInt($('#min_callers_{label.value}').val());
                
                // Get the CALLER column index
                const colIdx = $('#{table_id} thead th').filter(function () {{
                    return $(this).text().trim() === 'SUPP_CALLERS';
                }}).index();
                
                // Convert column data to strings using DataTables API
                const columnData = table.column(colIdx).data();
                const stringData = [];
                for (let i = 0; i < columnData.length; i++) {{
                    stringData[i] = String(columnData[i] || '');
                }}
                
                // Create a simple search string based on min/max values
                let searchString = '';
                if (minCallers > 0) {{
                    const range = [];
                    for (let i = 1; i < minCallers; i++) {{
                        range.push(',');
                    }}
                    searchString = range.join('.*');
                }} else {{
                    searchString = '';
                }}

                // Apply the search and redraw
                table.column(colIdx).search(searchString, {{regex: true, smart: false}}).draw();
                
                // Update select-all checkbox state after filtering
                const visibleRows = table.rows({{ search: 'applied' }}).nodes();
                const visibleCheckboxes = $('.row-checkbox', visibleRows);
                const allChecked = visibleCheckboxes.length > 0 && 
                                visibleCheckboxes.filter(':checked').length === visibleCheckboxes.length;
                $('#select-all').prop('checked', allChecked);
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

        function exportSelectedToVCF(tableId) {{
            const rows = getSelectedRows(tableId);
            if (rows.length === 0) return alert("No rows selected.");
            
            // VCF header
            const vcfHeader = [
                '##fileformat=VCFv4.2',
                '##source=Varify',
                '##FILTER=<ID=PASS,Description="All filters passed">',
                '##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type of structural variant">',
                '##INFO=<ID=END,Number=1,Type=Integer,Description="End position of the variant described in this record">',
                '##INFO=<ID=SVLEN,Number=.,Type=Integer,Description="Difference in length between REF and ALT alleles">',
                '##INFO=<ID=STRANDS,Number=.,Type=String,Description="Strands of evidence in the final merged call">',
                '##INFO=<ID=IMPRECISE,Number=0,Type=Flag,Description="Imprecise structural variation">',
                '##INFO=<ID=PRECISE,Number=0,Type=Flag,Description="Precise structural variation">',
                '##INFO=<ID=MATEID,Number=.,Type=String,Description="ID of mate breakend">',
                '##INFO=<ID=EVENT,Number=1,Type=String,Description="ID of event associated to breakend">',
                '##INFO=<ID=SUPP_CALLERS,Number=1,Type=String,Description="Callers that generated this variant">',
                '##INFO=<ID=CIPOS,Number=.,Type=Integer,Description="Confidence interval for the start of the variant">',   
                '##INFO=<ID=CIEND,Number=.,Type=Integer,Description="Confidence interval for the end of the variant">',
                '##INFO=<ID=HOMSEQ,Number=.,Type=String,Description="Homozygous sequence for the variant">',
                '##INFO=<ID=HOMLEN,Number=.,Type=Integer,Description="Length of the homozygous sequence for the variant">',
                '##INFO=<ID=GQ,Number=.,Type=Integer,Description="Genotype quality">',
                '##INFO=<ID=PR,Number=.,Type=Integer,Description="Phred-scaled genotype posterior probabilities">',
                '##INFO=<ID=SR,Number=.,Type=Integer,Description="Strand read count">',
                '##INFO=<ID=CHROM2,Number=.,Type=String,Description="Chromosome of mate breakend">',
                '##ALT=<ID=DEL,Description="Deletion">',
                '##ALT=<ID=DUP,Description="Duplication">',
                '##ALT=<ID=INV,Description="Inversion">',
                '##ALT=<ID=INS,Description="Insertion">',
                '##ALT=<ID=CNV,Description="Copy Number Variant">',
                '##ALT=<ID=BND,Description="Breakend">',
                '#CHROM\\tPOS\\tID\\tREF\\tALT\\tQUAL\\tFILTER\\tINFO'
            ];
            
            // Process each row to create VCF entries
            const vcfRows = rows.map(row => {{
                // Extract required fields
                const chrom = row['CHROM'] || '.';
                const pos = row['POSITION'] || '.';
                const id = row['ID'] || '.';
                const ref = row['REF'] || '.';
                const alt = row['ALT'] || '.';
                const qual = row['QUAL'] || '.';
                const filter = row['FILTER'] || 'PASS';
                
                // Build INFO field
                const infoParts = [];
                
                if (row['SVTYPE']) infoParts.push(`SVTYPE=${{row['SVTYPE']}}`);
                if (row['END']) infoParts.push(`END=${{row['END']}}`);
                if (row['SVLEN']) infoParts.push(`SVLEN=${{row['SVLEN']}}`);
                if (row['STRANDS']) infoParts.push(`STRANDS=${{row['STRANDS']}}`);
                if (row['CHROM2']) infoParts.push(`CHROM2=${{row['CHROM2']}}`);
                if (row['CIPOS']) infoParts.push(`CIPOS=${{row['CIPOS']}}`);    
                if (row['CIEND']) infoParts.push(`CIEND=${{row['CIEND']}}`);
                if (row['HOMSEQ']) infoParts.push(`HOMSEQ=${{row['HOMSEQ']}}`);
                if (row['HOMLEN']) infoParts.push(`HOMLEN=${{row['HOMLEN']}}`);
                if (row['MATE_ID']) infoParts.push(`MATEID=${{row['MATE_ID']}}`);
                if (row['EVENT_ID']) infoParts.push(`EVENT=${{row['EVENT_ID']}}`);
                if (row['SUPP_CALLERS']) infoParts.push(`SUPP_CALLERS=${{row['SUPP_CALLERS']}}`);
                
                // Add any other fields as custom INFO tags
                Object.entries(row).forEach(([key, value]) => {{
                    if (!['CHROM', 'POSITION', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 
                           'SVTYPE', 'END', 'SVLEN', 'STRANDS', 'CIPOS', 'CIEND', 'HOMSEQ', 'HOMLEN', 
                           'MATE_ID', 'EVENT_ID', 'SUPP_CALLERS'].includes(key) && value) {{
                        infoParts.push(`${{key}}=${{value}}`);
                    }}
                }});
                
                const info = infoParts.join(';');
                
                // Return VCF line
                return `${{chrom}}\\t${{pos}}\\t${{id}}\\t${{ref}}\\t${{alt}}\\t${{qual}}\\t${{filter}}\\t${{info}}`;
            }});
            
            // Combine header and rows
            const vcfContent = [...vcfHeader, ...vcfRows].join('\\n');
            downloadFile(vcfContent, "selected_variants.vcf", "text/vcf");
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
    bcf_html,
    survivor_html,
    bcf_df,
    bcf_stats,
    survivor_df,
    survivor_stats,
    bcf_plots,
    survivor_plots,
    profiles,
    reference_name,
    bcf_sample_columns,
    survivor_sample_columns,
    disable_igv,
):
    bcf_summary = (
        {
            "total_sv": len(bcf_df),
            "unique_sv": bcf_df["SVTYPE"].nunique(),
            "mqs": (
                round(bcf_df["QUAL"].median(), 2)
                if not bcf_df["QUAL"].isna().all()
                else "N/A"
            ),
        }
        if bcf_df is not None
        else None
    )

    survivor_summary = (
        {
            "total_sv": len(survivor_df),
            "unique_sv": survivor_df["SVTYPE"].nunique(),
            "mqs": (
                round(survivor_df["QUAL"].median(), 2)
                if not survivor_df["QUAL"].isna().all()
                else "N/A"
            ),
        }
        if survivor_df is not None
        else None
    )

    bcf_stats_html = (
        {
            key: render_stats_table(
                title=f"{VcfType.BCF.value.upper()} - {key} Section",
                description=BCFTOOLS_SECTION_DESCRIPTIONS.get(
                    key, "No description available."
                ),
                df=df,
            )
            for key, df in bcf_stats.items()
            if not (df.empty or (df.values == "0.00")[0, :].any())
        }
        if bcf_stats is not None
        else {}
    )

    survivor_stats_html = (
        render_stats_table(
            title=f"{VcfType.SURVIVOR.value.upper()} Summary Table",
            description=(
                "This table summarizes structural variant types (e.g., Deletions, Duplications, Insertions, Translocations) "
                "across different size ranges. It is derived from SURVIVOR's support file and shows how many variants "
                "fall into each class."
            ),
            df=survivor_stats.reset_index(),
        )
        if survivor_stats is not None and not survivor_stats.empty
        else ""
    )

    bcf_variant_table_html = (
        render_interactive_variant_table(
            bcf_df,
            table_id="bcf_variant_table",
            label=VcfType.BCF,
            columns_to_display=bcf_sample_columns,
        )
        if bcf_df is not None
        else ""
    )

    survivor_variant_table_html = (
        render_interactive_variant_table(
            survivor_df,
            table_id="survivor_variant_table",
            label=VcfType.SURVIVOR,
            columns_to_display=survivor_sample_columns,
        )
        if survivor_df is not None
        else ""
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
        reference_name=reference_name,
        bcf_variant_table_html=bcf_variant_table_html,
        survivor_variant_table_html=survivor_variant_table_html,
        disable_igv=disable_igv,
    )

    with open(combined_report_file, "w") as f:
        f.write(rendered_html)

    print(f"Combined report saved to {combined_report_file}")
