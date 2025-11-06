import datetime
import hashlib
import json
import os


def summarize_sv(df):
    """
    Summarize structural variants from a DataFrame.
    Args:
        df: pandas DataFrame with structural variant data
    Returns:
        Dictionary with total_sv, unique_sv, and mqs (median quality score)
    """

    total_sv = len(df)
    unique_sv = df["SVTYPE"].nunique() if "SVTYPE" in df.columns else "N/A"
    if "QUAL" in df.columns and not df["QUAL"].isna().all():
        mqs = round(df["QUAL"].median(), 2)
    else:
        mqs = "N/A"
    return {
        "total_sv": total_sv,
        "unique_sv": unique_sv,
        "mqs": mqs,
    }


def get_package_resource(relative_path):
    """
    Get absolute path to a package resource file.
    Args:
        relative_path: Path relative to the varify package directory
                      e.g., "templates/report-template.html" or "dist/bundle.js"

    Returns:
        Absolute path to the resource file
    """
    reporting_dir = os.path.dirname(os.path.abspath(__file__))
    package_dir = os.path.dirname(reporting_dir)

    return os.path.join(package_dir, relative_path)


def generate_combined_report(
    combined_report_file,
    bcf_vcf_path,
    survivor_vcf_path,
    fasta_path,
    bcf_df,
    survivor_df,
    profiles,
    reference_name,
    bcf_stats_file=None,
    survivor_stats_file=None,
):
    """
    Generate Varify report with metadata.json and pre-bundled HTML.

    Stats files are copied to genome_files/ and parsed in browser (not in Python).
    """

    bcf_summary = summarize_sv(bcf_df)
    survivor_summary = summarize_sv(survivor_df)
    output_dir = os.path.dirname(combined_report_file)
    if not output_dir:
        output_dir = "."

    fasta_filename = None
    bcf_vcf_filename = None
    survivor_vcf_filename = None

    genome_files_dir = os.path.join(output_dir, "genome_files")

    print("Copying genome files...")

    os.makedirs(genome_files_dir, exist_ok=True)

    import shutil

    copied_files = []

    source_files = []
    if bcf_vcf_path and os.path.exists(bcf_vcf_path):
        source_files.append(bcf_vcf_path)
    if survivor_vcf_path and os.path.exists(survivor_vcf_path):
        source_files.append(survivor_vcf_path)
    if fasta_path and os.path.exists(fasta_path):
        source_files.append(fasta_path)

    bcf_stats_filename = None
    survivor_stats_filename = None

    if fasta_path and os.path.exists(fasta_path):
        fasta_filename = os.path.basename(fasta_path)
        fasta_dest = os.path.join(genome_files_dir, fasta_filename)
        fasta_fai_src = fasta_path + ".fai"
        fasta_fai_dest = fasta_dest + ".fai"

        shutil.copy2(fasta_path, fasta_dest)
        copied_files.append(fasta_dest)

        if os.path.exists(fasta_fai_src):
            shutil.copy2(fasta_fai_src, fasta_fai_dest)
            copied_files.append(fasta_fai_dest)

    if bcf_vcf_path and os.path.exists(bcf_vcf_path):
        bcf_vcf_filename = os.path.basename(bcf_vcf_path)
        bcf_vcf_dest = os.path.join(genome_files_dir, bcf_vcf_filename)

        if os.path.exists(bcf_vcf_dest):
            copied_files.append(bcf_vcf_dest)
        else:
            shutil.copy2(bcf_vcf_path, bcf_vcf_dest)
            copied_files.append(bcf_vcf_dest)

        if bcf_vcf_path.endswith(".gz"):
            tbi_src = bcf_vcf_path + ".tbi"
            tbi_dest = bcf_vcf_dest + ".tbi"
            if os.path.exists(tbi_dest):
                copied_files.append(tbi_dest)
            elif os.path.exists(tbi_src):
                shutil.copy2(tbi_src, tbi_dest)
                copied_files.append(tbi_dest)

            uncompressed_filename = bcf_vcf_filename.replace(".gz", "")
            uncompressed_dest = os.path.join(genome_files_dir, uncompressed_filename)
            if os.path.exists(uncompressed_dest):
                copied_files.append(uncompressed_dest)

    if survivor_vcf_path and os.path.exists(survivor_vcf_path):
        survivor_vcf_filename = os.path.basename(survivor_vcf_path)
        survivor_vcf_dest = os.path.join(genome_files_dir, survivor_vcf_filename)

        if os.path.exists(survivor_vcf_dest):
            copied_files.append(survivor_vcf_dest)
        else:
            shutil.copy2(survivor_vcf_path, survivor_vcf_dest)
            copied_files.append(survivor_vcf_dest)

        if survivor_vcf_filename.endswith(".gz"):
            survivor_tbi_src = f"{survivor_vcf_path}.tbi"
            survivor_tbi_dest = os.path.join(genome_files_dir, f"{survivor_vcf_filename}.tbi")
            if os.path.exists(survivor_tbi_dest):
                copied_files.append(survivor_tbi_dest)
            elif os.path.exists(survivor_tbi_src):
                shutil.copy2(survivor_tbi_src, survivor_tbi_dest)
                copied_files.append(survivor_tbi_dest)

            uncompressed_filename = survivor_vcf_filename.replace(".gz", "")
            uncompressed_dest = os.path.join(genome_files_dir, uncompressed_filename)
            if os.path.exists(uncompressed_dest):
                copied_files.append(uncompressed_dest)

    if bcf_stats_file and os.path.exists(bcf_stats_file):
        bcf_stats_filename = os.path.basename(bcf_stats_file)
        bcf_stats_dest = os.path.join(genome_files_dir, bcf_stats_filename)
        shutil.copy2(bcf_stats_file, bcf_stats_dest)
        copied_files.append(bcf_stats_dest)

    if survivor_stats_file and os.path.exists(survivor_stats_file):
        survivor_stats_filename = os.path.basename(survivor_stats_file)
        survivor_stats_dest = os.path.join(genome_files_dir, survivor_stats_filename)
        shutil.copy2(survivor_stats_file, survivor_stats_dest)
        copied_files.append(survivor_stats_dest)

    version_parts = []
    for file_path in source_files:
        if os.path.exists(file_path):
            stat = os.stat(file_path)
            version_parts.append(f"{os.path.basename(file_path)}:{stat.st_mtime}:{stat.st_size}")

    version_string = "|".join(sorted(version_parts))
    file_version = hashlib.md5(version_string.encode()).hexdigest()[:16]

    metadata = {
        "generated_on": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "profiles": profiles,
        "reference_name": reference_name,
        "file_version": file_version,
        "fasta_filename": fasta_filename,
        "bcf": (
            {
                "summary": bcf_summary,
                "vcf_filename": bcf_vcf_filename,
                "stats_filename": bcf_stats_filename,
            }
            if bcf_summary
            else None
        ),
        "survivor": (
            {
                "summary": survivor_summary,
                "vcf_filename": survivor_vcf_filename,
                "stats_filename": survivor_stats_filename,
            }
            if survivor_summary
            else None
        ),
    }

    template_path = get_package_resource("templates/report-template.html")
    bundle_js_path = get_package_resource("dist/bundle.js")
    bundle_css_path = get_package_resource("dist/bundle.css")
    metadata_json = json.dumps(metadata, ensure_ascii=False)

    for path, name in [
        (template_path, "Template"),
        (bundle_js_path, "JavaScript bundle"),
        (bundle_css_path, "CSS bundle"),
    ]:
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"{name} not found: {path}\n" f"Run: npm run build:package && pip install -e ."
            )

    try:
        with open(bundle_js_path, "r", encoding="utf-8") as f:
            bundle_js = f.read()
        with open(bundle_css_path, "r", encoding="utf-8") as f:
            bundle_css = f.read()
    except FileNotFoundError as e:
        print("ERROR: Bundle files not found. Please run: npm run build:package")
        print(f"Looking for: {bundle_js_path}")
        raise e

    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    bundled_css = f"<style>{bundle_css}</style>"
    bundled_js = f"<script>{bundle_js}</script>"

    metadata_script = f"<script>window.REPORT_METADATA = {metadata_json};</script>"

    html_content = html_content.replace("<!-- BUNDLE_CSS -->", bundled_css)
    html_content = html_content.replace("<!-- BUNDLE_JS -->", bundled_js)
    html_content = html_content.replace("<!-- REPORT_METADATA -->", metadata_script)

    with open(combined_report_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"Report: {combined_report_file}")
    print(f"Genome files: {len(copied_files)} files -> {genome_files_dir}/")
