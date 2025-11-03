"""Tests for cuteSV variant caller implementation."""

import pytest
import vcfpy
from unittest.mock import Mock
from src.varify.core.callers.cutesv import CuteSVVariantCaller


@pytest.fixture
def cutesv_caller():
    """Create a cuteSV caller instance."""
    return CuteSVVariantCaller()


def test_caller_name(cutesv_caller):
    """Test that caller name is correct."""
    assert cutesv_caller.name == "cuteSV"


def test_parse_info_fields_re_single(cutesv_caller):
    """Test parsing RE (read support) field as single value."""
    info = {"RE": 15, "SVTYPE": "DEL"}
    result = cutesv_caller.parse_info_fields(info)
    assert result["RE"] == 15
    assert result["SVTYPE"] == "DEL"


def test_parse_info_fields_re_list(cutesv_caller):
    """Test parsing RE field as list."""
    info = {"RE": [20]}
    result = cutesv_caller.parse_info_fields(info)
    assert result["RE"] == 20


def test_parse_info_fields_re_none(cutesv_caller):
    """Test parsing RE field with None value."""
    info = {"RE": None}
    result = cutesv_caller.parse_info_fields(info)
    assert result["RE"] is None


def test_parse_info_fields_re_invalid(cutesv_caller):
    """Test parsing invalid RE field."""
    info = {"RE": "invalid"}
    result = cutesv_caller.parse_info_fields(info)
    assert result["RE"] is None


def test_parse_info_fields_strand(cutesv_caller):
    """Test parsing STRAND field."""
    info = {"STRAND": "+-"}
    result = cutesv_caller.parse_info_fields(info)
    assert result["STRAND"] == "+-"


def test_parse_info_fields_rnames_list(cutesv_caller):
    """Test parsing RNAMES field as list."""
    info = {"RNAMES": ["read1", "read2", "read3"]}
    result = cutesv_caller.parse_info_fields(info)
    assert result["NUM_RNAMES"] == 3


def test_parse_info_fields_rnames_string(cutesv_caller):
    """Test parsing RNAMES field as comma-separated string."""
    info = {"RNAMES": "read1,read2,read3,read4"}
    result = cutesv_caller.parse_info_fields(info)
    assert result["NUM_RNAMES"] == 4


def test_parse_info_fields_af_single(cutesv_caller):
    """Test parsing AF (allele frequency) field."""
    info = {"AF": 0.25}
    result = cutesv_caller.parse_info_fields(info)
    assert result["AF"] == 0.25


def test_parse_info_fields_af_list(cutesv_caller):
    """Test parsing AF field as list."""
    info = {"AF": [0.33]}
    result = cutesv_caller.parse_info_fields(info)
    assert result["AF"] == 0.33


def test_parse_info_fields_af_none(cutesv_caller):
    """Test parsing AF field with None value."""
    info = {"AF": None}
    result = cutesv_caller.parse_info_fields(info)
    assert result["AF"] is None


def test_parse_info_fields_af_invalid(cutesv_caller):
    """Test parsing invalid AF field."""
    info = {"AF": "invalid"}
    result = cutesv_caller.parse_info_fields(info)
    assert result["AF"] is None


def test_parse_info_fields_all_fields(cutesv_caller):
    """Test parsing all cuteSV-specific fields together."""
    info = {
        "RE": 10,
        "STRAND": "++",
        "RNAMES": ["r1", "r2"],
        "AF": 0.5,
        "SVTYPE": "DEL",
        "SVLEN": -1000,
    }
    result = cutesv_caller.parse_info_fields(info)
    assert result["RE"] == 10
    assert result["STRAND"] == "++"
    assert result["NUM_RNAMES"] == 2
    assert result["AF"] == 0.5
    assert result["SVTYPE"] == "DEL"
    assert result["SVLEN"] == -1000


def test_parse_info_fields_empty(cutesv_caller):
    """Test parsing empty INFO dict."""
    info = {}
    result = cutesv_caller.parse_info_fields(info)
    assert result == {}


def test_calculate_confidence_intervals_direct(cutesv_caller):
    """Test CI calculation with direct CIPOS/CIEND."""
    info = {"CIPOS": [-10, 10], "CIEND": [-5, 5]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = cutesv_caller.calculate_confidence_intervals(info, record)
    assert cipos == [-10, 10]
    assert ciend == [-5, 5]


def test_calculate_confidence_intervals_only_cipos(cutesv_caller):
    """Test CI calculation with only CIPOS."""
    info = {"CIPOS": [-20, 20]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = cutesv_caller.calculate_confidence_intervals(info, record)
    assert cipos == [-20, 20]
    assert ciend is None


def test_calculate_confidence_intervals_only_ciend(cutesv_caller):
    """Test CI calculation with only CIEND."""
    info = {"CIEND": [-15, 15]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = cutesv_caller.calculate_confidence_intervals(info, record)
    assert cipos is None
    assert ciend == [-15, 15]


def test_calculate_confidence_intervals_missing(cutesv_caller):
    """Test CI calculation with no confidence intervals."""
    info = {"SVTYPE": "DEL"}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = cutesv_caller.calculate_confidence_intervals(info, record)
    assert cipos is None
    assert ciend is None


def test_calculate_confidence_intervals_invalid_format(cutesv_caller):
    """Test CI calculation with invalid format (not a list)."""
    info = {"CIPOS": "invalid", "CIEND": 10}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = cutesv_caller.calculate_confidence_intervals(info, record)
    assert cipos is None
    assert ciend is None


def test_calculate_confidence_intervals_short_list(cutesv_caller):
    """Test CI calculation with list too short."""
    info = {"CIPOS": [5], "CIEND": []}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = cutesv_caller.calculate_confidence_intervals(info, record)
    assert cipos is None
    assert ciend is None
