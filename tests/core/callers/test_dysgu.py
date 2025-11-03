"""Tests for Dysgu variant caller implementation."""

import pytest
import vcfpy
from src.varify.core.callers.dysgu import DysguVariantCaller


@pytest.fixture
def dysgu_caller():
    """Create Dysgu caller instance."""
    return DysguVariantCaller()


def test_caller_name(dysgu_caller):
    """Test caller name property."""
    assert dysgu_caller.name == "Dysgu"


def test_parse_info_fields_nmp(dysgu_caller):
    """Test NMP field parsing."""
    info = {"NMP": 5}
    parsed = dysgu_caller.parse_info_fields(info)
    assert parsed["NMP"] == 5


def test_parse_info_fields_nmp_list(dysgu_caller):
    """Test NMP field parsing with list."""
    info = {"NMP": [5]}
    parsed = dysgu_caller.parse_info_fields(info)
    assert parsed["NMP"] == 5


def test_parse_info_fields_mapq(dysgu_caller):
    """Test MAPQ field parsing."""
    info = {"MAPQ": 42.5}
    parsed = dysgu_caller.parse_info_fields(info)
    assert parsed["MAPQ"] == 42.5


def test_parse_info_fields_mapq_list(dysgu_caller):
    """Test MAPQ field parsing with list."""
    info = {"MAPQ": [42.5]}
    parsed = dysgu_caller.parse_info_fields(info)
    assert parsed["MAPQ"] == 42.5


def test_calculate_confidence_intervals_ci95(dysgu_caller):
    """Test CI calculation with CIPOS95/CIEND95 format."""
    info = {
        "CIPOS95": 20,
        "CIEND95": 30,
        "END": 10500,
    }
    record = vcfpy.Record(
        CHROM="chr1", POS=10000, ID=[], REF="N", ALT=[], QUAL=30, FILTER=[], INFO=info
    )
    cipos, ciend = dysgu_caller.calculate_confidence_intervals(info, record)
    assert cipos == [10000 - 10, 10000 + 10]
    assert ciend == [10500 - 15, 10500 + 15]


def test_calculate_confidence_intervals_ci95_list(dysgu_caller):
    """Test CI calculation with CIPOS95/CIEND95 as list."""
    info = {
        "CIPOS95": [20],
        "CIEND95": [30],
        "END": 10500,
    }
    record = vcfpy.Record(
        CHROM="chr1", POS=10000, ID=[], REF="N", ALT=[], QUAL=30, FILTER=[], INFO=info
    )
    cipos, ciend = dysgu_caller.calculate_confidence_intervals(info, record)
    assert cipos == [10000 - 10, 10000 + 10]
    assert ciend == [10500 - 15, 10500 + 15]


def test_calculate_confidence_intervals_direct(dysgu_caller):
    """Test CI calculation with direct CIPOS/CIEND."""
    info = {
        "CIPOS": [-10, 10],
        "CIEND": [-15, 15],
    }
    record = vcfpy.Record(
        CHROM="chr1", POS=10000, ID=[], REF="N", ALT=[], QUAL=30, FILTER=[], INFO=info
    )
    cipos, ciend = dysgu_caller.calculate_confidence_intervals(info, record)
    assert cipos == [-10, 10]
    assert ciend == [-15, 15]
