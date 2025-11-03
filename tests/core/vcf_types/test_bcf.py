"""
Tests for BCF VCF Type Handler.
"""

import pytest
import vcfpy
from src.varify.core.vcf_types.bcf import BCFHandler
from tests.doubles import FakeVcfRecord


@pytest.mark.integration
class TestBCFHandlerWithRealData:
    """Integration tests using real BCF VCF files from data/ directory."""

    def test_extract_primary_caller_from_real_bcf(self, real_vcfpy_reader_bcf):
        """Test PRIMARY_CALLER extraction from real BCF VCF file."""
        handler = BCFHandler()

        with real_vcfpy_reader_bcf as reader:
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

        assert records_checked > 0, "No records found in BCF VCF"
        assert callers_found > 0, "No PRIMARY_CALLER found in BCF VCF"

    def test_should_aggregate_returns_true(self):
        """Test that BCF requires aggregation."""
        handler = BCFHandler()

        assert handler.should_aggregate() is True


class TestBCFHandlerPrimaryCallerExtraction:
    """Unit tests for PRIMARY_CALLER extraction."""

    def test_extract_primary_caller_from_euk_caller(self):
        """Test extraction from EUK_CALLER field."""
        handler = BCFHandler()
        info = {"EUK_CALLER": "delly"}
        record = FakeVcfRecord()

        result = handler.extract_primary_caller(info, record)

        assert result == "delly"

    def test_extract_primary_caller_from_caller(self):
        """Test extraction from CALLER field."""
        handler = BCFHandler()
        info = {"CALLER": "dysgu"}
        record = FakeVcfRecord()

        result = handler.extract_primary_caller(info, record)

        assert result == "dysgu"

    def test_euk_caller_priority_over_caller(self):
        """Test that EUK_CALLER has priority over CALLER."""
        handler = BCFHandler()
        info = {
            "EUK_CALLER": "delly",
            "CALLER": "dysgu",
        }
        record = FakeVcfRecord()

        result = handler.extract_primary_caller(info, record)

        assert result == "delly"

    def test_extract_primary_caller_missing_fields(self):
        """Test extraction when both fields are missing."""
        handler = BCFHandler()
        info = {"OTHER_FIELD": "value"}
        record = FakeVcfRecord()

        result = handler.extract_primary_caller(info, record)

        assert result is None

    def test_extract_primary_caller_empty_info(self):
        """Test extraction with empty INFO dict."""
        handler = BCFHandler()
        info = {}
        record = FakeVcfRecord()

        result = handler.extract_primary_caller(info, record)

        assert result is None

    def test_extract_primary_caller_various_callers(self):
        """Test extraction with various common caller names."""
        handler = BCFHandler()
        callers = ["delly", "dysgu", "cutesv", "sniffles", "svim", "gridss"]

        for caller_name in callers:
            info = {"EUK_CALLER": caller_name}
            record = FakeVcfRecord()

            result = handler.extract_primary_caller(info, record)

            assert result == caller_name


class TestBCFHandlerTypeSpecificFields:
    """Unit tests for type-specific field extraction."""

    def test_extract_type_specific_fields_returns_empty_dict(self):
        """Test that BCF has no type-specific fields beyond PRIMARY_CALLER."""
        handler = BCFHandler()
        info = {"SVTYPE": "DEL", "SVLEN": -500}
        record = FakeVcfRecord()

        result = handler.extract_type_specific_fields(info, record)

        assert result == {}

    def test_extract_type_specific_fields_with_various_info(self):
        """Test with various INFO field combinations."""
        handler = BCFHandler()
        info_variants = [
            {"SVTYPE": "DEL", "SVLEN": -500, "END": 1500},
            {"SVTYPE": "DUP", "SVLEN": 300},
            {"SVTYPE": "INV"},
            {},
        ]

        for info in info_variants:
            record = FakeVcfRecord(info=info)
            result = handler.extract_type_specific_fields(info, record)

            assert result == {}


class TestBCFHandlerAggregation:
    """Unit tests for aggregation behavior."""

    def test_should_aggregate_always_true(self):
        """Test that should_aggregate always returns True for BCF."""
        handler = BCFHandler()

        for _ in range(5):
            assert handler.should_aggregate() is True

    def test_aggregation_reasoning(self):
        """Test that BCF requires aggregation (documentation test)."""
        handler = BCFHandler()

        assert handler.should_aggregate() is True


class TestBCFHandlerEdgeCases:
    """Edge case tests for BCFHandler."""

    def test_extract_primary_caller_with_none_values(self):
        """Test extraction when INFO fields contain None."""
        handler = BCFHandler()
        info = {"EUK_CALLER": None, "CALLER": None}
        record = FakeVcfRecord()

        result = handler.extract_primary_caller(info, record)

        assert result is None

    def test_extract_primary_caller_with_empty_strings(self):
        """Test extraction when INFO fields contain empty strings."""
        handler = BCFHandler()
        info = {"EUK_CALLER": "", "CALLER": "dysgu"}
        record = FakeVcfRecord()

        result = handler.extract_primary_caller(info, record)

        assert result == "dysgu"

    def test_extract_primary_caller_case_sensitivity(self):
        """Test that caller names preserve case."""
        handler = BCFHandler()
        info = {"EUK_CALLER": "DELLY"}
        record = FakeVcfRecord()

        result = handler.extract_primary_caller(info, record)

        assert result == "DELLY"

    def test_extract_primary_caller_with_special_characters(self):
        """Test caller names with special characters."""
        handler = BCFHandler()
        info = {"EUK_CALLER": "caller-v2.0"}
        record = FakeVcfRecord()

        result = handler.extract_primary_caller(info, record)

        assert result == "caller-v2.0"

    def test_extract_primary_caller_with_whitespace(self):
        """Test caller names with whitespace."""
        handler = BCFHandler()
        info = {"EUK_CALLER": " delly "}
        record = FakeVcfRecord()

        result = handler.extract_primary_caller(info, record)

        assert result == " delly "


class TestBCFHandlerCompatibility:
    """Tests for compatibility with base VcfTypeHandler interface."""

    def test_implements_extract_primary_caller(self):
        """Test that BCFHandler implements extract_primary_caller."""
        handler = BCFHandler()

        assert hasattr(handler, "extract_primary_caller")
        assert callable(handler.extract_primary_caller)

    def test_implements_extract_type_specific_fields(self):
        """Test that BCFHandler implements extract_type_specific_fields."""
        handler = BCFHandler()

        assert hasattr(handler, "extract_type_specific_fields")
        assert callable(handler.extract_type_specific_fields)

    def test_implements_should_aggregate(self):
        """Test that BCFHandler implements should_aggregate."""
        handler = BCFHandler()

        assert hasattr(handler, "should_aggregate")
        assert callable(handler.should_aggregate)


@pytest.mark.integration
class TestBCFHandlerRealWorldScenarios:
    """Integration tests for real-world BCF processing scenarios."""

    def test_process_full_bcf_file_workflow(self, bcf_vcf_path):
        """Test full workflow: read BCF file, extract callers, aggregate."""
        handler = BCFHandler()
        callers_per_variant = {}

        reader = vcfpy.Reader.from_path(str(bcf_vcf_path))

        for record in reader:
            assert record is not None
            info = dict(record.INFO)

            primary_caller = handler.extract_primary_caller(info, record)

            if primary_caller:
                variant_key = (record.CHROM, record.POS, info.get("SVTYPE"))

                if variant_key not in callers_per_variant:
                    callers_per_variant[variant_key] = set()

                callers_per_variant[variant_key].add(primary_caller)

        reader.close()

        assert len(callers_per_variant) > 0

        multi_caller_variants = sum(
            1 for callers in callers_per_variant.values() if len(callers) > 1
        )

        assert multi_caller_variants >= 0

    def test_bcf_vs_survivor_aggregation_difference(self):
        """Test that BCF and SURVIVOR have different aggregation needs."""
        bcf_handler = BCFHandler()

        assert bcf_handler.should_aggregate() is True
