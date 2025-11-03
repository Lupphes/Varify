"""Tests for TIDDIT variant caller implementation."""

import pytest
import vcfpy

from src.varify.core.callers.tiddit import TIDDITVariantCaller


@pytest.fixture
def tiddit_caller():
    """Create TIDDIT caller instance."""
    return TIDDITVariantCaller()


def test_caller_name(tiddit_caller):
    """Test caller name property."""
    assert tiddit_caller.name == "TIDDIT"


def test_parse_info_fields_cilen_list(tiddit_caller):
    """Test CILEN field parsing with list."""
    info = {"CILEN": [100, 200]}
    parsed = tiddit_caller.parse_info_fields(info)
    assert parsed["CILEN_MIN"] == 100
    assert parsed["CILEN_MAX"] == 200


def test_parse_info_fields_cilen_single(tiddit_caller):
    """Test CILEN field parsing with single value."""
    info = {"CILEN": 150}
    parsed = tiddit_caller.parse_info_fields(info)
    assert parsed["CILEN"] == 150


def test_parse_info_fields_oa(tiddit_caller):
    """Test OA field parsing."""
    info = {"OA": "++"}
    parsed = tiddit_caller.parse_info_fields(info)
    assert parsed["OA"] == "++"


def test_calculate_confidence_intervals_reg_string(tiddit_caller):
    """Test CI calculation with REG format as string."""
    info = {
        "CIPOS_REG": "9990,10010",
        "CIEND_REG": "10490,10510",
    }
    record = vcfpy.Record(
        CHROM="chr1", POS=10000, ID=[], REF="N", ALT=[], QUAL=30, FILTER=[], INFO=info
    )
    cipos, ciend = tiddit_caller.calculate_confidence_intervals(info, record)
    assert cipos == [9990, 10010]
    assert ciend == [10490, 10510]


def test_calculate_confidence_intervals_reg_list(tiddit_caller):
    """Test CI calculation with REG format as list."""
    info = {
        "CIPOS_REG": [9990, 10010],
        "CIEND_REG": [10490, 10510],
    }
    record = vcfpy.Record(
        CHROM="chr1", POS=10000, ID=[], REF="N", ALT=[], QUAL=30, FILTER=[], INFO=info
    )
    cipos, ciend = tiddit_caller.calculate_confidence_intervals(info, record)
    assert cipos == [9990, 10010]
    assert ciend == [10490, 10510]


def test_calculate_confidence_intervals_direct(tiddit_caller):
    """Test CI calculation with direct CIPOS/CIEND."""
    info = {
        "CIPOS": [-10, 10],
        "CIEND": [-15, 15],
    }
    record = vcfpy.Record(
        CHROM="chr1", POS=10000, ID=[], REF="N", ALT=[], QUAL=30, FILTER=[], INFO=info
    )
    cipos, ciend = tiddit_caller.calculate_confidence_intervals(info, record)
    assert cipos == [-10, 10]
    assert ciend == [-15, 15]
