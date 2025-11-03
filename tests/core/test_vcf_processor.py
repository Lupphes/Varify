"""Tests for VcfProcessor class."""

from pathlib import Path

import pytest

from src.varify.core import VcfProcessor, VcfType


@pytest.fixture
def sample_vcf_path():
    """Path to sample VCF fixture."""
    return Path(__file__).parent.parent / "fixtures" / "sample.vcf"


@pytest.fixture
def bcftools_stats_path():
    """Path to bcftools stats fixture."""
    return Path(__file__).parent.parent / "fixtures" / "bcftools.stats"


@pytest.fixture
def survivor_stats_path():
    """Path to SURVIVOR stats fixture."""
    return Path(__file__).parent.parent / "fixtures" / "survivor.stats"


@pytest.fixture
def temp_output_dir(tmp_path):
    """Create temporary output directory."""
    return str(tmp_path / "output")


def test_vcf_processor_initialization(sample_vcf_path, temp_output_dir):
    """Test VcfProcessor initialization."""
    processor = VcfProcessor(VcfType.BCF, str(sample_vcf_path), temp_output_dir)
    assert processor.vcf_type == VcfType.BCF
    assert processor.vcf_path == str(sample_vcf_path)
    assert processor.output_dir == temp_output_dir


def test_vcf_processor_bcf_process(sample_vcf_path, bcftools_stats_path, temp_output_dir):
    """Test BCF VCF processing."""
    processor = VcfProcessor(VcfType.BCF, str(sample_vcf_path), temp_output_dir)
    df, stats, plots, enriched_vcf_path = processor.process(str(bcftools_stats_path))

    assert df is not None
    assert not df.empty
    assert len(df) == 17

    assert stats is None
    assert plots is None

    assert enriched_vcf_path is not None
    assert Path(enriched_vcf_path).exists()


def test_vcf_processor_survivor_process(survivor_vcf_path, survivor_stats_path, temp_output_dir):
    """Test SURVIVOR VCF processing."""
    processor = VcfProcessor(VcfType.SURVIVOR, str(survivor_vcf_path), temp_output_dir)
    df, stats, plots, enriched_vcf_path = processor.process(str(survivor_stats_path))

    assert df is not None
    assert not df.empty
    assert len(df) == 1059

    assert stats is None
    assert plots is None

    assert enriched_vcf_path is not None
    assert Path(enriched_vcf_path).exists()


def test_vcf_processor_no_stats(sample_vcf_path, temp_output_dir):
    """Test VCF processing without stats file."""
    processor = VcfProcessor(VcfType.BCF, str(sample_vcf_path), temp_output_dir)
    df, stats, plots, enriched_vcf_path = processor.process()

    assert df is not None
    assert not df.empty

    assert stats is None
    assert plots is None

    assert enriched_vcf_path is not None
    assert Path(enriched_vcf_path).exists()
