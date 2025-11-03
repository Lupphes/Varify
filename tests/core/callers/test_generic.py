"""Tests for generic variant caller implementation."""

from unittest.mock import Mock

import pytest
import vcfpy

from src.varify.core.callers.generic import GenericVariantCaller


@pytest.fixture
def generic_caller():
    """Create a generic caller instance."""
    return GenericVariantCaller()


def test_caller_name(generic_caller):
    """Test that caller name is correct."""
    assert generic_caller.name == "generic"


def test_parse_info_fields_basic(generic_caller):
    """Test basic INFO field parsing."""
    info = {"SVTYPE": "DEL", "SVLEN": -1000, "END": 10000}
    result = generic_caller.parse_info_fields(info)
    assert result["SVTYPE"] == "DEL"
    assert result["SVLEN"] == -1000
    assert result["END"] == 10000


def test_parse_info_fields_preserves_all(generic_caller):
    """Test that all INFO fields are preserved."""
    info = {
        "SVTYPE": "DUP",
        "SVLEN": 500,
        "END": 20000,
        "IMPRECISE": True,
        "CustomField": "value",
    }
    result = generic_caller.parse_info_fields(info)
    assert result["SVTYPE"] == "DUP"
    assert result["SVLEN"] == 500
    assert result["END"] == 20000
    assert result["IMPRECISE"] is True
    assert result["CustomField"] == "value"


def test_parse_info_fields_empty(generic_caller):
    """Test parsing empty INFO dict."""
    info = {}
    result = generic_caller.parse_info_fields(info)
    assert result == {}


def test_parse_info_fields_with_lists(generic_caller):
    """Test parsing INFO fields with list values."""
    info = {"AF": [0.1, 0.2], "SVTYPE": "INS"}
    result = generic_caller.parse_info_fields(info)
    assert result["AF"] == [0.1, 0.2]
    assert result["SVTYPE"] == "INS"


def test_calculate_confidence_intervals_both(generic_caller):
    """Test CI calculation with both CIPOS and CIEND."""
    info = {"CIPOS": [-10, 10], "CIEND": [-5, 5]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos == [-10, 10]
    assert ciend == [-5, 5]


def test_calculate_confidence_intervals_only_cipos(generic_caller):
    """Test CI calculation with only CIPOS."""
    info = {"CIPOS": [-20, 20]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos == [-20, 20]
    assert ciend is None


def test_calculate_confidence_intervals_only_ciend(generic_caller):
    """Test CI calculation with only CIEND."""
    info = {"CIEND": [-15, 15]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos is None
    assert ciend == [-15, 15]


def test_calculate_confidence_intervals_missing(generic_caller):
    """Test CI calculation with no confidence intervals."""
    info = {"SVTYPE": "DEL"}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos is None
    assert ciend is None


def test_calculate_confidence_intervals_invalid_cipos(generic_caller):
    """Test CI calculation with invalid CIPOS format."""
    info = {"CIPOS": "not_a_list", "CIEND": [-5, 5]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos is None
    assert ciend == [-5, 5]


def test_calculate_confidence_intervals_invalid_ciend(generic_caller):
    """Test CI calculation with invalid CIEND format."""
    info = {"CIPOS": [-10, 10], "CIEND": "invalid"}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos == [-10, 10]
    assert ciend is None


def test_calculate_confidence_intervals_short_list(generic_caller):
    """Test CI calculation with incomplete list."""
    info = {"CIPOS": [5], "CIEND": [-10]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos is None
    assert ciend is None


def test_calculate_confidence_intervals_empty_list(generic_caller):
    """Test CI calculation with empty lists."""
    info = {"CIPOS": [], "CIEND": []}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos is None
    assert ciend is None


def test_calculate_confidence_intervals_non_numeric(generic_caller):
    """Test CI calculation with non-numeric values."""
    info = {"CIPOS": ["a", "b"], "CIEND": ["x", "y"]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos is None
    assert ciend is None


def test_calculate_confidence_intervals_zero_values(generic_caller):
    """Test CI calculation with zero values."""
    info = {"CIPOS": [0, 0], "CIEND": [0, 0]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos == [0, 0]
    assert ciend == [0, 0]


def test_calculate_confidence_intervals_negative_values(generic_caller):
    """Test CI calculation with negative values."""
    info = {"CIPOS": [-50, -10], "CIEND": [-100, -20]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos == [-50, -10]
    assert ciend == [-100, -20]


def test_calculate_confidence_intervals_large_values(generic_caller):
    """Test CI calculation with large values."""
    info = {"CIPOS": [-10000, 10000], "CIEND": [-5000, 5000]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = generic_caller.calculate_confidence_intervals(info, record)
    assert cipos == [-10000, 10000]
    assert ciend == [-5000, 5000]
