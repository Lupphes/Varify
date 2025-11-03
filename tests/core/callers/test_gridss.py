"""Tests for GRIDSS variant caller implementation."""

import pytest
import vcfpy
from unittest.mock import Mock
from src.varify.core.callers.gridss import GridssVariantCaller


@pytest.fixture
def gridss_caller():
    """Create a GRIDSS caller instance."""
    return GridssVariantCaller()


def test_caller_name(gridss_caller):
    """Test that caller name is correct."""
    assert gridss_caller.name == "gridss"


def test_parse_info_fields_with_svtype(gridss_caller):
    """Test parsing when SVTYPE is present."""
    info = {"SVTYPE": "DEL", "SVLEN": -1000}
    result = gridss_caller.parse_info_fields(info)
    assert result["SVTYPE"] == "DEL"
    assert result["SVLEN"] == -1000


def test_parse_info_fields_with_mateid(gridss_caller):
    """Test parsing when MATEID is present (paired breakend)."""
    info = {"MATEID": "variant_id_2", "SVTYPE": "BND"}
    result = gridss_caller.parse_info_fields(info)
    assert result["SVTYPE"] == "BND"
    assert result["MATEID"] == "variant_id_2"


def test_parse_info_fields_singleton_breakend(gridss_caller):
    """Test SVTYPE inference for singleton breakends (no SVTYPE, no MATEID)."""
    info = {"END": 10000}
    result = gridss_caller.parse_info_fields(info)
    assert result["SVTYPE"] == "BND"
    assert result["END"] == 10000


def test_parse_info_fields_singleton_no_svtype_no_mateid(gridss_caller):
    """Test that singleton breakends without SVTYPE get BND assigned."""
    info = {"QUAL": 100, "PRECISE": True}
    result = gridss_caller.parse_info_fields(info)
    assert result["SVTYPE"] == "BND"
    assert result["QUAL"] == 100
    assert result["PRECISE"] is True


def test_parse_info_fields_preserves_gridss_fields(gridss_caller):
    """Test that GRIDSS-specific fields are preserved."""
    info = {
        "SVTYPE": "DEL",
        "CQ": 250.5,
        "REFPAIR": 10,
        "SC_GRIDSS": True,
        "CUSTOM_FIELD": "value",
    }
    result = gridss_caller.parse_info_fields(info)
    assert result["SVTYPE"] == "DEL"
    assert result["CQ"] == 250.5
    assert result["REFPAIR"] == 10
    assert result["SC_GRIDSS"] is True
    assert result["CUSTOM_FIELD"] == "value"


def test_parse_info_fields_empty(gridss_caller):
    """Test parsing empty INFO dict results in BND."""
    info = {}
    result = gridss_caller.parse_info_fields(info)
    assert result["SVTYPE"] == "BND"


def test_parse_info_fields_none_svtype_with_mateid(gridss_caller):
    """Test that MATEID presence prevents BND inference."""
    info = {"MATEID": "mate123", "END": 50000}
    result = gridss_caller.parse_info_fields(info)
    assert result.get("SVTYPE") is None or result["SVTYPE"] != "BND"
    assert result["MATEID"] == "mate123"


def test_parse_info_fields_explicit_svtype_none(gridss_caller):
    """Test when SVTYPE is explicitly None."""
    info = {"SVTYPE": None, "END": 10000}
    result = gridss_caller.parse_info_fields(info)
    assert result["SVTYPE"] == "BND"


def test_calculate_confidence_intervals_uses_generic(gridss_caller):
    """Test that GRIDSS uses generic CI calculation."""
    info = {"CIPOS": [-10, 10], "CIEND": [-5, 5]}
    record = Mock(spec=vcfpy.Record)
    cipos, ciend = gridss_caller.calculate_confidence_intervals(info, record)
    assert cipos == [-10, 10]
    assert ciend == [-5, 5]
