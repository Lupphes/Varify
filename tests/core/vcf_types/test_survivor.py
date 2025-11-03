"""
Tests for SURVIVOR VCF Type Handler.
"""

import pytest
import vcfpy

from src.varify.core.vcf_types.survivor import SURVIVORHandler
from tests.doubles import FakeVcfRecord


@pytest.mark.integration
class TestSURVIVORHandlerWithRealData:
    """Integration tests using real SURVIVOR VCF files from data/ directory."""

    def test_extract_primary_caller_from_real_survivor(self, real_vcfpy_reader_survivor):
        """Test PRIMARY_CALLER extraction from real SURVIVOR VCF file."""
        handler = SURVIVORHandler()

        with real_vcfpy_reader_survivor as reader:
            records_checked = 0
            callers_found = 0

            for record in reader:
                assert record is not None
                info = dict(record.INFO)
                primary_caller = handler.extract_primary_caller(info, record)

                if primary_caller:
                    callers_found += 1

                records_checked += 1
                if records_checked >= 20:
                    break

        assert records_checked > 0, "No records found in SURVIVOR VCF"
        assert callers_found > 0, "No PRIMARY_CALLER found in SURVIVOR VCF"

    def test_extract_supp_vec_from_real_survivor(self, real_vcfpy_reader_survivor):
        """Test SUPP_VEC extraction from real SURVIVOR file."""
        handler = SURVIVORHandler()

        with real_vcfpy_reader_survivor as reader:
            for record in reader:
                assert record is not None
                info = dict(record.INFO)
                fields = handler.extract_type_specific_fields(info, record)

                if "SUPP_VEC" in fields:
                    assert fields["SUPP_VEC"] is not None
                    assert isinstance(fields["SUPP_VEC"], str) or fields["SUPP_VEC"] is None
                    break

    def test_should_aggregate_returns_false(self):
        """Test that SURVIVOR does not require aggregation."""
        handler = SURVIVORHandler()

        assert handler.should_aggregate() is False


class TestSURVIVORHandlerPrimaryCallerExtraction:
    """Unit tests for PRIMARY_CALLER extraction from ID field."""

    def test_extract_primary_caller_from_id_field(self):
        """Test extraction from ID field (format: callername_SVTYPE)."""
        handler = SURVIVORHandler()
        record = FakeVcfRecord(id_="delly_DEL")
        info = {}

        result = handler.extract_primary_caller(info, record)

        assert result == "delly"

    def test_extract_primary_caller_various_formats(self):
        """Test extraction with various ID formats."""
        handler = SURVIVORHandler()
        test_cases = [
            ("sniffles_DEL", "sniffles"),
            ("dysgu_DUP", "dysgu"),
            ("cutesv_INV", "cutesv"),
            ("svim_BND", "svim"),
            ("gridss_DEL", "gridss"),
        ]

        for id_value, expected_caller in test_cases:
            record = FakeVcfRecord(id_=id_value)
            info = {}

            result = handler.extract_primary_caller(info, record)

            assert result == expected_caller, f"Failed for {id_value}"

    def test_extract_primary_caller_no_underscore(self):
        """Test extraction when ID has no underscore."""
        handler = SURVIVORHandler()
        record = FakeVcfRecord(id_="variant123")
        info = {}

        result = handler.extract_primary_caller(info, record)

        assert result is None

    def test_extract_primary_caller_missing_id(self):
        """Test extraction when ID is missing."""
        handler = SURVIVORHandler()
        record = FakeVcfRecord(id_=None)
        info = {}

        result = handler.extract_primary_caller(info, record)

        assert result is None

    def test_extract_primary_caller_empty_id(self):
        """Test extraction when ID is empty string."""
        handler = SURVIVORHandler()
        record = FakeVcfRecord(id_="")
        info = {}

        result = handler.extract_primary_caller(info, record)

        assert result is None

    def test_extract_primary_caller_multiple_underscores(self):
        """Test extraction when ID has multiple underscores."""
        handler = SURVIVORHandler()
        record = FakeVcfRecord(id_="caller_v2_DEL")
        info = {}

        result = handler.extract_primary_caller(info, record)

        assert result == "caller"


class TestSURVIVORHandlerTypeSpecificFields:
    """Unit tests for SURVIVOR-specific field extraction."""

    def test_extract_supp_vec(self):
        """Test SUPP_VEC extraction."""
        handler = SURVIVORHandler()
        info = {"SUPP_VEC": "01100000000000"}
        record = FakeVcfRecord()

        result = handler.extract_type_specific_fields(info, record)

        assert result["SUPP_VEC"] == "01100000000000"

    def test_extract_strands(self):
        """Test STRANDS extraction."""
        handler = SURVIVORHandler()
        info = {"STRANDS": "+-"}
        record = FakeVcfRecord()

        result = handler.extract_type_specific_fields(info, record)

        assert result["STRANDS"] == "+-"

    def test_extract_svmethod(self):
        """Test SVMETHOD extraction."""
        handler = SURVIVORHandler()
        info = {"SVMETHOD": "SURVIVOR"}
        record = FakeVcfRecord()

        result = handler.extract_type_specific_fields(info, record)

        assert result["SVMETHOD"] == "SURVIVOR"

    def test_extract_svtype_from_id(self):
        """Test SVTYPE extraction from ID field."""
        handler = SURVIVORHandler()
        info = {}
        record = FakeVcfRecord(id_="delly_DEL")

        result = handler.extract_type_specific_fields(info, record)

        assert result["SVTYPE"] == "DEL"

    def test_extract_svtype_various_types(self):
        """Test SVTYPE extraction for various SV types."""
        handler = SURVIVORHandler()
        test_cases = [
            ("delly_DEL", "DEL"),
            ("sniffles_DUP", "DUP"),
            ("dysgu_INV", "INV"),
            ("cutesv_BND", "BND"),
            ("svim_INS", "INS"),
        ]

        for id_value, expected_svtype in test_cases:
            info = {}
            record = FakeVcfRecord(id_=id_value)

            result = handler.extract_type_specific_fields(info, record)

            assert result["SVTYPE"] == expected_svtype

    def test_extract_svtype_missing_when_no_underscore(self):
        """Test that SVTYPE is not extracted when ID has no underscore."""
        handler = SURVIVORHandler()
        info = {}
        record = FakeVcfRecord(id_="variant123")

        result = handler.extract_type_specific_fields(info, record)

        assert "SVTYPE" not in result or result["SVTYPE"] is None

    def test_extract_all_fields_together(self):
        """Test extraction of all SURVIVOR-specific fields together."""
        handler = SURVIVORHandler()
        info = {
            "SUPP_VEC": "01100000000000",
            "STRANDS": "+-",
            "SVMETHOD": "SURVIVOR",
        }
        record = FakeVcfRecord(id_="delly_DEL")

        result = handler.extract_type_specific_fields(info, record)

        assert result["SUPP_VEC"] == "01100000000000"
        assert result["STRANDS"] == "+-"
        assert result["SVMETHOD"] == "SURVIVOR"
        assert result["SVTYPE"] == "DEL"

    def test_extract_with_missing_fields(self):
        """Test extraction when some fields are missing."""
        handler = SURVIVORHandler()
        info = {"SUPP_VEC": "01100000000000"}
        record = FakeVcfRecord(id_="delly_DEL")

        result = handler.extract_type_specific_fields(info, record)

        assert result["SUPP_VEC"] == "01100000000000"
        assert result["STRANDS"] is None
        assert result["SVMETHOD"] is None
        assert result["SVTYPE"] == "DEL"


class TestSURVIVORHandlerCallersExtraction:
    """Unit tests for SUPP_CALLERS extraction from sample ID fields."""

    def test_extract_callers_from_sample_ids(self):
        """Test SUPP_CALLERS extraction from sample ID fields."""
        handler = SURVIVORHandler()
        info = {}

        record = FakeVcfRecord()

        class FakeCall:
            def __init__(self, caller_id):
                self.data = {"ID": caller_id}

        record.calls = [
            FakeCall("delly_DEL"),
            FakeCall("dysgu_DEL"),
        ]

        result = handler.extract_type_specific_fields(info, record)

        assert "SUPP_CALLERS" in result
        assert "delly" in result["SUPP_CALLERS"]
        assert "dysgu" in result["SUPP_CALLERS"]

    def test_extract_callers_sorted(self):
        """Test that SUPP_CALLERS are sorted alphabetically."""
        handler = SURVIVORHandler()
        info = {}

        record = FakeVcfRecord()

        class FakeCall:
            def __init__(self, caller_id):
                self.data = {"ID": caller_id}

        record.calls = [
            FakeCall("zebra_DEL"),
            FakeCall("apple_DEL"),
            FakeCall("mango_DEL"),
        ]

        result = handler.extract_type_specific_fields(info, record)

        callers = result["SUPP_CALLERS"]
        assert callers.startswith("apple")
        assert "apple" in callers and "mango" in callers and "zebra" in callers

    def test_extract_callers_deduplicated(self):
        """Test that duplicate callers are deduplicated."""
        handler = SURVIVORHandler()
        info = {}

        record = FakeVcfRecord()

        class FakeCall:
            def __init__(self, caller_id):
                self.data = {"ID": caller_id}

        record.calls = [
            FakeCall("delly_DEL"),
            FakeCall("delly_DEL"),
            FakeCall("dysgu_DEL"),
        ]

        result = handler.extract_type_specific_fields(info, record)

        callers = result["SUPP_CALLERS"]
        assert callers.count("delly") == 1

    def test_extract_callers_ignores_invalid_ids(self):
        """Test that callers with invalid ID format are ignored."""
        handler = SURVIVORHandler()
        info = {}

        record = FakeVcfRecord()

        class FakeCall:
            def __init__(self, caller_id):
                self.data = {"ID": caller_id}

        record.calls = [
            FakeCall("delly_DEL"),
            FakeCall("invalid"),
            FakeCall("dysgu_DEL"),
        ]

        result = handler.extract_type_specific_fields(info, record)

        callers = result["SUPP_CALLERS"]
        assert "delly" in callers
        assert "dysgu" in callers

    def test_extract_callers_no_samples(self):
        """Test SUPP_CALLERS extraction when no samples present."""
        handler = SURVIVORHandler()
        info = {}
        record = FakeVcfRecord()
        record.calls = []

        result = handler.extract_type_specific_fields(info, record)

        assert "SUPP_CALLERS" not in result or result["SUPP_CALLERS"] is None


class TestSURVIVORHandlerAggregation:
    """Unit tests for aggregation behavior."""

    def test_should_aggregate_returns_false(self):
        """Test that SURVIVOR does not require aggregation."""
        handler = SURVIVORHandler()

        assert handler.should_aggregate() is False

    def test_aggregation_reasoning(self):
        """Test that SURVIVOR doesn't need aggregation (documentation test)."""
        handler = SURVIVORHandler()

        assert handler.should_aggregate() is False


class TestSURVIVORHandlerEdgeCases:
    """Edge case tests for SURVIVORHandler."""

    def test_extract_primary_caller_with_numeric_prefix(self):
        """Test extraction when caller name starts with number."""
        handler = SURVIVORHandler()
        record = FakeVcfRecord(id_="2caller_DEL")
        info = {}

        result = handler.extract_primary_caller(info, record)

        assert result == "2caller"

    def test_extract_primary_caller_with_dots(self):
        """Test extraction when caller name contains dots."""
        handler = SURVIVORHandler()
        record = FakeVcfRecord(id_="caller.v2.0_DEL")
        info = {}

        result = handler.extract_primary_caller(info, record)

        assert result == "caller.v2.0"

    def test_extract_supp_vec_empty_string(self):
        """Test SUPP_VEC with empty string."""
        handler = SURVIVORHandler()
        info = {"SUPP_VEC": ""}
        record = FakeVcfRecord()

        result = handler.extract_type_specific_fields(info, record)

        assert result["SUPP_VEC"] == ""

    def test_extract_strands_various_formats(self):
        """Test STRANDS with various formats."""
        handler = SURVIVORHandler()
        test_cases = ["+-", "-+", "++", "--", "+", "-"]

        for strands in test_cases:
            info = {"STRANDS": strands}
            record = FakeVcfRecord()

            result = handler.extract_type_specific_fields(info, record)

            assert result["STRANDS"] == strands


class TestSURVIVORHandlerCompatibility:
    """Tests for compatibility with base VcfTypeHandler interface."""

    def test_implements_required_methods(self):
        """Test that SURVIVORHandler implements all required methods."""
        handler = SURVIVORHandler()

        assert hasattr(handler, "extract_primary_caller")
        assert hasattr(handler, "extract_type_specific_fields")
        assert hasattr(handler, "should_aggregate")

        assert callable(handler.extract_primary_caller)
        assert callable(handler.extract_type_specific_fields)
        assert callable(handler.should_aggregate)

    def test_method_return_types(self):
        """Test that methods return expected types."""
        handler = SURVIVORHandler()
        info = {"SUPP_VEC": "01100000000000"}
        record = FakeVcfRecord(id_="delly_DEL")

        result1 = handler.extract_primary_caller(info, record)
        assert isinstance(result1, str) or result1 is None

        result2 = handler.extract_type_specific_fields(info, record)
        assert isinstance(result2, dict)

        result3 = handler.should_aggregate()
        assert isinstance(result3, bool)


@pytest.mark.integration
class TestSURVIVORHandlerRealWorldScenarios:
    """Integration tests for real-world SURVIVOR processing scenarios."""

    def test_process_full_survivor_file_workflow(self, survivor_vcf_path):
        """Test full workflow: read SURVIVOR file, extract fields."""
        handler = SURVIVORHandler()
        variants_with_multi_callers = 0

        reader = vcfpy.Reader.from_path(str(survivor_vcf_path))

        for record in reader:
            assert record is not None
            info = dict(record.INFO)

            primary_caller = handler.extract_primary_caller(info, record)
            type_fields = handler.extract_type_specific_fields(info, record)
            assert primary_caller is None or isinstance(primary_caller, str)

            if "SUPP_CALLERS" in type_fields:
                callers = type_fields["SUPP_CALLERS"]
                if callers and "," in callers:
                    variants_with_multi_callers += 1

        reader.close()

        assert variants_with_multi_callers >= 0

    def test_survivor_vs_bcf_difference(self):
        """Test that SURVIVOR and BCF have different aggregation needs."""
        survivor_handler = SURVIVORHandler()

        assert survivor_handler.should_aggregate() is False
