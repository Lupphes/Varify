import argparse
import tempfile
from igv_reports.report import create_report


def generate_report(
    env,
    main_vcf,
    second_vcf,
    output_file,
    genome_file,
    bam_files,
    title,
    prefix,
    info_columns,
    sample_columns,
    samples,
):
    """
    Generates an IGV report from a VCF file using our parametric template.
    """
    print(f"Generating IGV report for {title} with prefix='{prefix}'...")

    # 1) Render the parametric template with the prefix
    template = env.get_template("custom_template.html")
    rendered_html = template.render(prefix=prefix)

    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".html") as tmpf:
        tmpf.write(rendered_html)
        template_path = tmpf.name

    print("Info:", info_columns)
    print("Sample columns", sample_columns)
    print("Samples", samples)

    tracks = [main_vcf, second_vcf]
    if bam_files:
        tracks.extend(bam_files)  # Add BAM files to tracks

    # 2) Create the IGV report with that generated template
    args = argparse.Namespace(
        sites=main_vcf,
        fasta=genome_file,
        genome=None,
        type=None,
        ideogram=None,
        tracks=tracks,
        track_config=None,
        roi=[main_vcf, second_vcf],
        sort=True,
        template=template_path,
        output=output_file,
        info_columns=info_columns,
        info_columns_prefixes=None,
        samples=samples,
        sample_columns=sample_columns,
        flanking=1000,
        window=None,
        standalone=True,
        title=title,
        sequence=None,
        begin=None,
        end=None,
        zero_based=None,
        idlink=None,
        exclude_flags=1536,
        no_embed=False,
        subsample=None,
        maxlen=10000,
        translate_sequence_track=False,
    )

    create_report(args)
    print(f"IGV report saved to {output_file}")
