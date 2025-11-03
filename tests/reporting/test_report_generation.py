"""
Integration tests for report generation.
"""

import shutil
import tempfile
from pathlib import Path

import pytest

from src.varify.core.vcf_parser import VcfType, parse_vcf
from src.varify.reporting.html_generator import generate_combined_report


@pytest.fixture
def sample_vcf_path():
    """Path to sample VCF fixture."""
    return Path(__file__).parent.parent / "fixtures" / "sample.vcf"


@pytest.fixture
def temp_output_dir():
    """Create a temporary output directory."""
    temp_dir = tempfile.mkdtemp()
    yield Path(temp_dir)
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def sample_data(sample_vcf_path):
    """Load sample VCF data."""
    bcf_df, _ = parse_vcf(str(sample_vcf_path), VcfType.BCF)
    survivor_df, _ = parse_vcf(str(sample_vcf_path), VcfType.SURVIVOR)
    return bcf_df, survivor_df


def test_generate_combined_report_creates_html(
    sample_data,
    sample_vcf_path,
    temp_output_dir,
):
    """Test that generate_combined_report creates an HTML file."""
    bcf_df, survivor_df = sample_data

    output_path = temp_output_dir / "test_report.html"

    generate_combined_report(
        combined_report_file=str(output_path),
        bcf_vcf_path=str(sample_vcf_path),
        survivor_vcf_path=str(sample_vcf_path),
        fasta_path=None,
        bcf_df=bcf_df,
        survivor_df=survivor_df,
        profiles=[],
        reference_name=None,
    )

    assert output_path.exists(), "Report HTML should be created"
    assert output_path.stat().st_size > 0, "Report HTML should not be empty"


def test_report_contains_expected_sections(
    sample_data,
    sample_vcf_path,
    temp_output_dir,
):
    """Test that generated report contains expected sections."""
    bcf_df, survivor_df = sample_data

    output_path = temp_output_dir / "test_report.html"

    generate_combined_report(
        combined_report_file=str(output_path),
        bcf_vcf_path=str(sample_vcf_path),
        survivor_vcf_path=str(sample_vcf_path),
        fasta_path=None,
        bcf_df=bcf_df,
        survivor_df=survivor_df,
        profiles=[],
        reference_name=None,
    )

    with open(output_path, "r") as f:
        html_content = f.read()

    assert "<!DOCTYPE html>" in html_content or "<html" in html_content, "Should be valid HTML"
    assert "Varify" in html_content, "Should contain Varify branding"


def test_report_with_stats_files(
    sample_data,
    sample_vcf_path,
    temp_output_dir,
):
    """Test report generation with stats files."""
    bcf_df, survivor_df = sample_data

    bcf_stats_path = Path(__file__).parent.parent / "fixtures" / "bcftools.stats"
    survivor_stats_path = Path(__file__).parent.parent / "fixtures" / "survivor.stats"

    output_path = temp_output_dir / "test_report_with_stats.html"

    generate_combined_report(
        combined_report_file=str(output_path),
        bcf_vcf_path=str(sample_vcf_path),
        survivor_vcf_path=str(sample_vcf_path),
        fasta_path=None,
        bcf_df=bcf_df,
        survivor_df=survivor_df,
        profiles=[],
        reference_name=None,
        bcf_stats_file=str(bcf_stats_path),
        survivor_stats_file=str(survivor_stats_path),
    )

    assert output_path.exists(), "Report with stats should be created"


def test_report_handles_missing_survivor_data(
    sample_data,
    sample_vcf_path,
    temp_output_dir,
):
    """Test report generation with missing SURVIVOR data."""
    bcf_df, _ = sample_data

    output_path = temp_output_dir / "test_report_no_survivor.html"

    generate_combined_report(
        combined_report_file=str(output_path),
        bcf_vcf_path=str(sample_vcf_path),
        survivor_vcf_path=None,
        fasta_path=None,
        bcf_df=bcf_df,
        survivor_df=None,
        profiles=[],
        reference_name=None,
    )

    assert output_path.exists(), "Report without SURVIVOR should be created"


def test_report_contains_javascript_bundle(
    sample_data,
    sample_vcf_path,
    temp_output_dir,
):
    """Test that report contains embedded JavaScript bundle."""
    bcf_df, survivor_df = sample_data

    output_path = temp_output_dir / "test_report.html"

    generate_combined_report(
        combined_report_file=str(output_path),
        bcf_vcf_path=str(sample_vcf_path),
        survivor_vcf_path=str(sample_vcf_path),
        fasta_path=None,
        bcf_df=bcf_df,
        survivor_df=survivor_df,
        profiles=[],
        reference_name=None,
    )

    with open(output_path, "r") as f:
        html_content = f.read()

    assert "<script>" in html_content, "Should contain embedded JavaScript"


def test_vcf_parser_integration(sample_vcf_path):
    """Integration test for VCF parsing."""
    # Parse VCF
    df, samples = parse_vcf(str(sample_vcf_path), VcfType.BCF)

    # Verify basic properties
    assert len(df) == 17, f"Should parse 17 variants, got {len(df)}"
    assert "CHROM" in df.columns, "Should have CHROM column"
    assert "POSITION" in df.columns, "Should have POSITION column"
    assert "SVTYPE" in df.columns, "Should have SVTYPE column"

    # Verify data is parsed correctly
    first_variant = df.iloc[0]
    assert isinstance(first_variant["SVTYPE"], str), "SVTYPE should be a string"
    assert first_variant["SVTYPE"] in ["DEL", "INS", "DUP", "INV", "BND"], "SVTYPE should be valid"


def test_generate_report_function_exists():
    """Test that generate_combined_report function exists and is callable."""
    from src.varify.reporting import html_generator

    assert hasattr(
        html_generator, "generate_combined_report"
    ), "Should have generate_combined_report function"
    assert callable(
        html_generator.generate_combined_report
    ), "generate_combined_report should be callable"
