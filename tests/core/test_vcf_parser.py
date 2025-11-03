"""
Unit tests for VCF parser module.
"""

from pathlib import Path

import pandas as pd
import pytest

from src.varify.core.vcf_parser import VcfType, parse_vcf


@pytest.fixture
def sample_vcf_path():
    """Path to sample VCF fixture."""
    return Path(__file__).parent.parent / "fixtures" / "sample.vcf"


@pytest.fixture
def sample_vcf_data(sample_vcf_path):
    """Parse sample VCF and return DataFrame."""
    df, samples = parse_vcf(str(sample_vcf_path), VcfType.BCF)
    return df, samples


def test_parse_vcf_returns_dataframe(sample_vcf_data):
    """Test that parse_vcf returns a DataFrame."""
    df, samples = sample_vcf_data
    assert isinstance(df, pd.DataFrame)
    assert isinstance(samples, list)


def test_vcf_has_expected_columns(sample_vcf_data):
    """Test that parsed VCF has expected columns."""
    df, _ = sample_vcf_data
    expected_columns = ["CHROM", "POSITION", "ID", "REF", "ALT", "QUAL", "FILTER", "SVTYPE"]
    for col in expected_columns:
        assert col in df.columns, f"Missing column: {col}"


def test_vcf_has_correct_number_of_variants(sample_vcf_data):
    """Test that all variants are parsed."""
    df, _ = sample_vcf_data
    assert len(df) == 17, f"Expected 17 variants, got {len(df)}"


def test_variant_types_are_correct(sample_vcf_data):
    """Test that SVTYPE is correctly extracted."""
    df, _ = sample_vcf_data

    svtype_counts = df["SVTYPE"].value_counts()

    assert svtype_counts.get("DEL", 0) == 4, "Should have 4 deletions"
    assert svtype_counts.get("INS", 0) == 3, "Should have 3 insertions"
    assert svtype_counts.get("DUP", 0) == 5, "Should have 5 duplications"
    assert svtype_counts.get("INV", 0) == 5, "Should have 5 inversions"


def test_svlen_extraction(sample_vcf_data):
    """Test that SVLEN is correctly extracted."""
    df, _ = sample_vcf_data

    del_variants = df[df["SVTYPE"] == "DEL"]
    first_del = del_variants.iloc[0]

    assert abs(first_del["SVLEN"]) == 500, "First deletion should have SVLEN=500 or -500"


def test_confidence_intervals_extraction(sample_vcf_data):
    """Test that confidence intervals are extracted."""
    df, _ = sample_vcf_data

    variants_with_ci = df[df["CIPOS"].notna()]

    assert len(variants_with_ci) == 9, "Should have 9 variants with confidence intervals"

    first_ci_variant = variants_with_ci.iloc[0]
    assert first_ci_variant["CIPOS"] is not None


def test_supporting_callers_extraction(sample_vcf_data):
    """Test that supporting callers are extracted."""
    df, _ = sample_vcf_data

    multi_caller = df[df["SUPP_CALLERS"].str.contains(",", na=False)]

    assert len(multi_caller) == 14, "Should have 14 variants supported by multiple callers"


def test_filter_pass_variants(sample_vcf_data):
    """Test filtering by PASS status."""
    df, _ = sample_vcf_data

    pass_variants = df[df["FILTER"] == "PASS"]
    assert len(pass_variants) == 17, "Should have 17 PASS variants"


def test_chromosome_extraction(sample_vcf_data):
    """Test that chromosomes are correctly extracted."""
    df, _ = sample_vcf_data

    chromosomes = df["CHROM"].unique()
    assert "chr1" in chromosomes, "Should have chr1 variants"
    assert "chr2" in chromosomes, "Should have chr2 variants"


def test_quality_scores(sample_vcf_data):
    """Test that quality scores are numeric."""
    df, _ = sample_vcf_data

    assert df["QUAL"].dtype in [int, float, "float64"], "Quality scores should be numeric"
    assert df["QUAL"].min() == 25.0, "Minimum quality score should be 25.0"


def test_end_position_extraction(sample_vcf_data):
    """Test that END positions are extracted."""
    df, _ = sample_vcf_data

    end_values = df["END"]

    assert end_values.notna().sum() == 17, "All 17 variants should have END position"


def test_parse_vcf_empty_file():
    """Test parsing an empty VCF file."""
    import tempfile

    with tempfile.NamedTemporaryFile(mode="w", suffix=".vcf", delete=False) as f:
        f.write("##fileformat=VCFv4.2\n")
        f.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n")
        temp_path = f.name

    try:
        df, samples = parse_vcf(temp_path, VcfType.BCF)
        assert len(df) == 0, "Empty VCF should return empty DataFrame"
    finally:
        Path(temp_path).unlink()


def test_vcf_type_enum():
    """Test VcfType enum values."""
    assert VcfType.BCF.value == "bcf"
    assert VcfType.SURVIVOR.value == "survivor"


def test_svtype_column_exists(sample_vcf_data):
    """Test that SVTYPE column exists and is populated."""
    df, _ = sample_vcf_data

    assert "SVTYPE" in df.columns, "DataFrame should have SVTYPE column"
    first_variant = df.iloc[0]
    assert first_variant["SVTYPE"] is not None, "SVTYPE should be populated"
    assert first_variant["SVTYPE"] in ["DEL", "INS", "DUP", "INV", "BND"], "SVTYPE should be valid"


def test_multiple_chromosomes_sorting(sample_vcf_data):
    """Test that variants can be sorted by chromosome and position."""
    df, _ = sample_vcf_data

    sorted_df = df.sort_values(["CHROM", "POSITION"])

    assert sorted_df.iloc[0]["CHROM"] in ["chr1", "chr2"]

    chr1_data = sorted_df[sorted_df["CHROM"] == "chr1"]
    positions = chr1_data["POSITION"].tolist()
    assert positions == sorted(positions), "Positions should be sorted within chromosome"


def test_ref_alt_alleles(sample_vcf_data):
    """Test that REF and ALT alleles are extracted."""
    df, _ = sample_vcf_data

    first_variant = df.iloc[0]
    assert isinstance(first_variant["REF"], str), "REF should be a string"
    assert isinstance(first_variant["ALT"], str), "ALT should be a string"
    assert len(first_variant["REF"]) == 1, "REF should be 'N' (1 character)"
    assert len(first_variant["ALT"]) == 5, "ALT should be '<DEL>' (5 characters)"
