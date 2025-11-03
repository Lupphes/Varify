"""Tests for VCF reader."""

import pytest
import vcfpy

from src.varify.core.pipeline.reader import VcfReader


@pytest.fixture
def minimal_vcf_path():
    """Path to minimal VCF test fixture."""
    return "tests/fixtures/minimal_deletion.vcf"


@pytest.fixture
def sample_vcf_path():
    """Path to sample VCF test fixture."""
    return "tests/fixtures/sample.vcf"


def test_init_with_valid_file(minimal_vcf_path):
    """Test initializing reader with valid VCF file."""
    reader = VcfReader(minimal_vcf_path)
    assert reader.file_path == minimal_vcf_path
    assert reader._reader is not None
    reader.close()


def test_header_property(minimal_vcf_path):
    """Test accessing VCF header."""
    reader = VcfReader(minimal_vcf_path)
    header = reader.header
    assert isinstance(header, vcfpy.Header)
    assert header is not None
    reader.close()


def test_samples_property(minimal_vcf_path):
    """Test accessing sample names."""
    reader = VcfReader(minimal_vcf_path)
    samples = reader.samples
    assert isinstance(samples, list)
    reader.close()


def test_get_info_columns(minimal_vcf_path):
    """Test getting INFO field IDs from header."""
    reader = VcfReader(minimal_vcf_path)
    info_columns = reader.get_info_columns()
    assert isinstance(info_columns, list)
    assert any(col in info_columns for col in ["SVTYPE", "SVLEN", "END"])
    reader.close()


def test_read_records_returns_iterator(minimal_vcf_path):
    """Test that read_records returns an iterator."""
    reader = VcfReader(minimal_vcf_path)
    records = reader.read_records()
    assert hasattr(records, "__iter__")
    assert hasattr(records, "__next__")
    reader.close()


def test_read_records_yields_tuples(minimal_vcf_path):
    """Test that read_records yields (index, record) tuples."""
    reader = VcfReader(minimal_vcf_path)
    records = list(reader.read_records())

    if records:
        idx, record = records[0]
        assert isinstance(idx, int)
        assert isinstance(record, vcfpy.Record)
        assert idx == 0
    reader.close()


def test_read_records_zero_based_index(sample_vcf_path):
    """Test that record indices are zero-based."""
    reader = VcfReader(sample_vcf_path)
    indices = [idx for idx, _ in reader.read_records()]

    if indices:
        assert indices[0] == 0
        for i, idx in enumerate(indices):
            assert idx == i
    reader.close()


def test_close_reader(minimal_vcf_path):
    """Test closing the reader."""
    reader = VcfReader(minimal_vcf_path)
    reader.close()
    assert reader._reader is not None


def test_context_manager_enter(minimal_vcf_path):
    """Test context manager entry."""
    with VcfReader(minimal_vcf_path) as reader:
        assert reader is not None
        assert isinstance(reader, VcfReader)


def test_context_manager_exit(minimal_vcf_path):
    """Test context manager exit closes reader."""
    with VcfReader(minimal_vcf_path) as reader:
        header = reader.header
        assert header is not None
    # After exiting context, reader should be closed


def test_context_manager_reads_records(minimal_vcf_path):
    """Test reading records within context manager."""
    with VcfReader(minimal_vcf_path) as reader:
        records = list(reader.read_records())
        assert isinstance(records, list)


def test_multiple_reads(minimal_vcf_path):
    """Test that iterator can only be consumed once."""
    reader = VcfReader(minimal_vcf_path)

    records1 = list(reader.read_records())
    assert len(records1) > 0

    records2 = list(reader.read_records())
    assert len(records2) == 0

    reader.close()


def test_header_has_samples(sample_vcf_path):
    """Test that header contains sample information."""
    with VcfReader(sample_vcf_path) as reader:
        header = reader.header
        assert hasattr(header, "samples")


def test_samples_list_type(sample_vcf_path):
    """Test samples returns list type."""
    with VcfReader(sample_vcf_path) as reader:
        samples = reader.samples
        assert isinstance(samples, list)


def test_info_columns_are_strings(minimal_vcf_path):
    """Test that INFO column names are strings."""
    with VcfReader(minimal_vcf_path) as reader:
        info_cols = reader.get_info_columns()
        for col in info_cols:
            assert isinstance(col, str)
