import argparse
import tempfile
import json
from typing import List, Optional
from jinja2 import Environment
from igv_reports.report import create_report


def generate_report(
    env: Environment,
    main_vcf: str,
    second_vcf: str,
    output_file: str,
    genome_file: str,
    bam_files: Optional[List[str]],
    title: str,
    prefix: str,
    info_columns: Optional[List[str]],
    sample_columns: Optional[List[str]],
    samples: Optional[List[str]],
) -> None:
    """
    Generates an IGV report using a custom template and track configuration.
    """
    print(f"Generating IGV report for {title} with prefix='{prefix}'...")

    template_path = _render_template(env, prefix)
    track_config_path = _write_track_config(main_vcf, second_vcf, bam_files, prefix)

    args = _build_igv_args(
        main_vcf=main_vcf,
        second_vcf=second_vcf,
        genome_file=genome_file,
        output_file=output_file,
        title=title,
        template_path=template_path,
        track_config_path=track_config_path,
        info_columns=info_columns,
        sample_columns=sample_columns,
        samples=samples,
    )

    create_report(args)
    print(f"IGV report saved to {output_file}")


def _render_template(env: Environment, prefix: str) -> str:
    template = env.get_template("custom_template.html")
    rendered_html = template.render(prefix=prefix)
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".html") as tmp:
        tmp.write(rendered_html)
        return tmp.name


def _write_track_config(
    main_vcf: str, second_vcf: str, bam_files: Optional[List[str]], prefix: str
) -> str:
    config = [
        {"url": main_vcf, "format": "vcf", "name": f"{prefix.upper()} VCF"},
        {
            "url": second_vcf,
            "format": "vcf",
            "name": "SURVIVOR VCF" if prefix == "bcf" else "BCF VCF",
        },
    ]
    if bam_files:
        config.extend(
            {"url": bam, "format": "bam", "name": f"Alignment {i+1}"}
            for i, bam in enumerate(bam_files)
        )

    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as tmp:
        json.dump(config, tmp)
        return tmp.name


def _build_igv_args(
    main_vcf: str,
    second_vcf: str,
    genome_file: str,
    output_file: str,
    title: str,
    template_path: str,
    track_config_path: str,
    info_columns: Optional[List[str]],
    sample_columns: Optional[List[str]],
    samples: Optional[List[str]],
) -> argparse.Namespace:
    return argparse.Namespace(
        sites=main_vcf,
        fasta=genome_file,
        genome=None,
        type=None,
        ideogram=None,
        tracks=None,
        track_config=[track_config_path],
        roi=[main_vcf, second_vcf],
        sort="INSERT_SIZE",
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
