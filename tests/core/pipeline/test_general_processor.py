"""Tests for general VCF processor."""

from unittest.mock import Mock

import pytest
import vcfpy

from src.varify.core.pipeline.general_processor import GeneralProcessor


@pytest.fixture
def processor():
    """Create a general processor instance."""
    return GeneralProcessor()


def test_normalize_svlen_positive_int(processor):
    """Test normalizing positive integer SVLEN."""
    result = processor.normalize_svlen(1000)
    assert result == 1000


def test_normalize_svlen_negative_int(processor):
    """Test normalizing negative integer SVLEN."""
    result = processor.normalize_svlen(-1000)
    assert result == 1000


def test_normalize_svlen_list_positive(processor):
    """Test normalizing SVLEN as list with positive value."""
    result = processor.normalize_svlen([500])
    assert result == 500


def test_normalize_svlen_list_negative(processor):
    """Test normalizing SVLEN as list with negative value."""
    result = processor.normalize_svlen([-750])
    assert result == 750


def test_normalize_svlen_zero(processor):
    """Test normalizing zero SVLEN."""
    result = processor.normalize_svlen(0)
    assert result == 0


def test_normalize_svlen_none(processor):
    """Test normalizing None SVLEN."""
    result = processor.normalize_svlen(None)
    assert result is None


def test_normalize_svlen_invalid_string(processor):
    """Test normalizing invalid string SVLEN."""
    result = processor.normalize_svlen("invalid")
    assert result is None


def test_normalize_svlen_empty_list(processor):
    """Test normalizing empty list SVLEN returns None."""
    result = processor.normalize_svlen([])
    assert result is None


def test_normalize_svlen_string_number(processor):
    """Test normalizing string number SVLEN."""
    result = processor.normalize_svlen("-500")
    assert result == 500


def test_extract_core_fields_basic(processor):
    """Test extracting core fields from VCF record."""
    record = Mock(spec=vcfpy.Record)
    record.CHROM = "chr1"
    record.POS = 1000
    record.ID = ["variant1"]
    record.REF = "A"
    record.ALT = []
    record.QUAL = 30.5
    record.FILTER = ["PASS"]

    result = processor.extract_core_fields(record)
    assert result["CHROM"] == "chr1"
    assert result["POSITION"] == 1000
    assert result["ID"] == "variant1"
    assert result["REF"] == "A"
    assert result["QUAL"] == 30.5
    assert result["FILTER"] == "PASS"


def test_extract_core_fields_no_id(processor):
    """Test extracting core fields when ID is empty."""
    record = Mock(spec=vcfpy.Record)
    record.CHROM = "chr2"
    record.POS = 2000
    record.ID = []
    record.REF = "G"
    record.ALT = []
    record.QUAL = None
    record.FILTER = []

    result = processor.extract_core_fields(record)
    assert result["ID"] is None
    assert result["FILTER"] is None


def test_extract_core_fields_multiple_filters(processor):
    """Test extracting core fields with multiple filters."""
    record = Mock(spec=vcfpy.Record)
    record.CHROM = "chr3"
    record.POS = 3000
    record.ID = ["var2"]
    record.REF = "T"
    record.ALT = []
    record.QUAL = 50.0
    record.FILTER = ["LowQual", "HighDP"]

    result = processor.extract_core_fields(record)
    assert result["FILTER"] == "LowQual;HighDP"


def test_extract_core_fields_with_alt(processor):
    """Test extracting core fields with ALT alleles."""
    alt1 = Mock()
    alt1.serialize = Mock(return_value="<DEL>")
    alt2 = Mock()
    alt2.serialize = Mock(return_value="<DUP>")

    record = Mock(spec=vcfpy.Record)
    record.CHROM = "chr4"
    record.POS = 4000
    record.ID = ["var3"]
    record.REF = "C"
    record.ALT = [alt1, alt2]
    record.QUAL = 100.0
    record.FILTER = ["PASS"]

    result = processor.extract_core_fields(record)
    assert result["ALT"] == "<DEL>,<DUP>"


def test_extract_core_fields_alt_no_serialize(processor):
    """Test extracting core fields with ALT without serialize method."""
    record = Mock(spec=vcfpy.Record)
    record.CHROM = "chr5"
    record.POS = 5000
    record.ID = ["var4"]
    record.REF = "A"
    record.ALT = ["G", "T"]
    record.QUAL = 75.0
    record.FILTER = []

    result = processor.extract_core_fields(record)
    assert result["ALT"] == "G,T"


def test_extract_basic_info_fields_complete(processor):
    """Test extracting basic INFO fields."""
    info = {
        "SVTYPE": "DEL",
        "SVLEN": -1000,
        "END": 10000,
        "IMPRECISE": True,
        "PRECISE": None,
        "CHR2": "chr2",
        "MATEID": "mate1",
        "HOMLEN": 50,
        "HOMSEQ": "ATCG",
    }

    result = processor.extract_basic_info_fields(info)
    assert result["SVTYPE"] == "DEL"
    assert result["SVLEN"] == -1000
    assert result["END"] == 10000
    assert result["IMPRECISE"] is True
    assert result["PRECISE"] is False
    assert result["CHROM2"] == "chr2"
    assert result["MATE_ID"] == "mate1"
    assert result["HOMLEN"] == 50
    assert result["HOMSEQ"] == "ATCG"


def test_extract_basic_info_fields_minimal(processor):
    """Test extracting basic INFO fields with minimal data."""
    info = {"SVTYPE": "INS"}

    result = processor.extract_basic_info_fields(info)
    assert result["SVTYPE"] == "INS"
    assert result["SVLEN"] is None
    assert result["END"] is None
    assert result["IMPRECISE"] is False
    assert result["PRECISE"] is False


def test_extract_basic_info_fields_empty(processor):
    """Test extracting basic INFO fields from empty dict."""
    info = {}

    result = processor.extract_basic_info_fields(info)
    assert result["SVTYPE"] is None
    assert result["IMPRECISE"] is False
    assert result["PRECISE"] is False


def test_extract_basic_info_fields_precise_flag(processor):
    """Test PRECISE flag handling."""
    info = {"SVTYPE": "DUP", "PRECISE": True}

    result = processor.extract_basic_info_fields(info)
    assert result["PRECISE"] is True
    assert result["IMPRECISE"] is False


def test_validate_required_fields_valid(processor):
    """Test validation with all required fields."""
    record_data = {"SVLEN": 1000, "SVTYPE": "DEL"}
    assert processor.validate_required_fields(record_data) is True


def test_validate_required_fields_missing_svlen(processor):
    """Test validation fails without SVLEN."""
    record_data = {"SVTYPE": "DEL"}
    assert processor.validate_required_fields(record_data) is False


def test_validate_required_fields_none_svlen(processor):
    """Test validation fails with None SVLEN."""
    record_data = {"SVLEN": None, "SVTYPE": "DEL"}
    assert processor.validate_required_fields(record_data) is False


def test_validate_required_fields_missing_svtype(processor):
    """Test validation fails without SVTYPE."""
    record_data = {"SVLEN": 1000}
    assert processor.validate_required_fields(record_data) is False


def test_validate_required_fields_none_svtype(processor):
    """Test validation fails with None SVTYPE."""
    record_data = {"SVLEN": 1000, "SVTYPE": None}
    assert processor.validate_required_fields(record_data) is False


def test_validate_required_fields_both_missing(processor):
    """Test validation fails when both required fields missing."""
    record_data = {}
    assert processor.validate_required_fields(record_data) is False


def test_validate_required_fields_with_extra_fields(processor):
    """Test validation succeeds with extra fields."""
    record_data = {
        "SVLEN": 500,
        "SVTYPE": "INS",
        "END": 10000,
        "CUSTOM": "value",
    }
    assert processor.validate_required_fields(record_data) is True
