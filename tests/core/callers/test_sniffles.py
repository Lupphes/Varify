"""Tests for Sniffles variant caller implementation."""

import pytest
import vcfpy
from src.varify.core.callers.sniffles import SnifflesVariantCaller


@pytest.fixture
def sniffles_caller():
    """Create Sniffles caller instance."""
    return SnifflesVariantCaller()


def test_caller_name(sniffles_caller):
    """Test caller name property."""
    assert sniffles_caller.name == "sniffles"


def test_parse_info_fields_basic(sniffles_caller):
    """Test basic INFO field parsing."""
    info = {
        "SVTYPE": "DEL",
        "SVLEN": -500,
        "END": 10500,
    }
    parsed = sniffles_caller.parse_info_fields(info)
    assert parsed["SVTYPE"] == "DEL"
    assert parsed["SVLEN"] == -500
    assert parsed["END"] == 10500


def test_parse_info_fields_support(sniffles_caller):
    """Test SUPPORT field parsing."""
    info = {"SUPPORT": 15}
    parsed = sniffles_caller.parse_info_fields(info)
    assert parsed["SUPPORT"] == 15


def test_parse_info_fields_rnames_list(sniffles_caller):
    """Test RNAMES field parsing with list."""
    info = {"RNAMES": ["read1", "read2", "read3"]}
    parsed = sniffles_caller.parse_info_fields(info)
    assert parsed["NUM_RNAMES"] == 3


def test_parse_info_fields_rnames_string(sniffles_caller):
    """Test RNAMES field parsing with string."""
    info = {"RNAMES": "read1,read2,read3"}
    parsed = sniffles_caller.parse_info_fields(info)
    assert parsed["NUM_RNAMES"] == 3


def test_calculate_confidence_intervals_direct(sniffles_caller):
    """Test CI calculation with direct CIPOS/CIEND."""
    info = {
        "CIPOS": [-10, 10],
        "CIEND": [-15, 15],
    }
    record = vcfpy.Record(
        CHROM="chr1", POS=10000, ID=[], REF="N", ALT=[], QUAL=30, FILTER=[], INFO=info
    )
    cipos, ciend = sniffles_caller.calculate_confidence_intervals(info, record)
    assert cipos == [-10, 10]
    assert ciend == [-15, 15]


def test_calculate_confidence_intervals_std(sniffles_caller):
    """Test CI calculation with standard deviation format."""
    info = {
        "CIPOS_STD": 5.0,
        "CIEND_STD": 7.5,
        "END": 10500,
    }
    record = vcfpy.Record(
        CHROM="chr1", POS=10000, ID=[], REF="N", ALT=[], QUAL=30, FILTER=[], INFO=info
    )
    cipos, ciend = sniffles_caller.calculate_confidence_intervals(info, record)
    assert cipos == [10000 - 10, 10000 + 10]
    assert ciend == [int(10500 - 15), int(10500 + 15)]


def test_calculate_confidence_intervals_std_list(sniffles_caller):
    """Test CI calculation with STD as list."""
    info = {
        "CIPOS_STD": [5.0],
        "CIEND_STD": [7.5],
        "END": 10500,
    }
    record = vcfpy.Record(
        CHROM="chr1", POS=10000, ID=[], REF="N", ALT=[], QUAL=30, FILTER=[], INFO=info
    )
    cipos, ciend = sniffles_caller.calculate_confidence_intervals(info, record)
    assert cipos == [10000 - 10, 10000 + 10]
    assert ciend == [int(10500 - 15), int(10500 + 15)]
