"""
Unit tests for enriched VCF generation.
"""

import tempfile
from pathlib import Path

import pandas as pd
import pytest
import vcfpy

from src.varify.core.vcf_parser import VcfType, parse_vcf, write_enriched_vcf


@pytest.fixture
def sample_vcf_path():
    return Path(__file__).parent.parent / "fixtures" / "sample.vcf"


@pytest.fixture
def negative_svlen_vcf_path():
    return Path(__file__).parent.parent / "fixtures" / "negative_svlen.vcf"


@pytest.fixture
def minimal_vcf_path():
    return Path(__file__).parent.parent / "fixtures" / "minimal.vcf"


@pytest.fixture
def sample_dataframe(sample_vcf_path):
    df, _ = parse_vcf(str(sample_vcf_path), VcfType.BCF)
    return df


@pytest.fixture
def enriched_vcf_path(sample_vcf_path, sample_dataframe):
    with tempfile.NamedTemporaryFile(mode="w", suffix="_enriched.vcf", delete=False) as f:
        output_path = f.name

    write_enriched_vcf(str(sample_vcf_path), sample_dataframe, output_path)
    yield output_path
    Path(output_path).unlink(missing_ok=True)


class TestEnrichedVCFGeneration:

    def test_enriched_vcf_file_is_created(self, enriched_vcf_path):
        assert Path(enriched_vcf_path).exists()
        assert Path(enriched_vcf_path).stat().st_size > 0

    def test_enriched_vcf_has_new_info_headers(self, enriched_vcf_path):
        reader = vcfpy.Reader.from_path(enriched_vcf_path)

        info_ids = {
            line.id for line in reader.header.lines if isinstance(line, vcfpy.header.InfoHeaderLine)
        }

        assert "SUPP_CALLERS" in info_ids
        assert "PRIMARY_CALLER" in info_ids
        assert "NUM_CALLERS" in info_ids

    def test_enriched_vcf_header_descriptions(self, enriched_vcf_path):
        reader = vcfpy.Reader.from_path(enriched_vcf_path)

        info_headers = {
            line.id: line
            for line in reader.header.lines
            if isinstance(line, vcfpy.header.InfoHeaderLine)
        }

        assert "(computed)" in info_headers["SUPP_CALLERS"].description.lower()
        assert "(computed)" in info_headers["PRIMARY_CALLER"].description.lower()
        assert "(computed)" in info_headers["NUM_CALLERS"].description.lower()

    def test_enriched_vcf_preserves_original_records(self, sample_vcf_path, enriched_vcf_path):
        original_reader = vcfpy.Reader.from_path(str(sample_vcf_path))
        enriched_reader = vcfpy.Reader.from_path(enriched_vcf_path)

        original_count = sum(1 for _ in original_reader)
        enriched_count = sum(1 for _ in enriched_reader)

        assert original_count == enriched_count

    def test_single_caller_has_num_callers_one(self, enriched_vcf_path):
        reader = vcfpy.Reader.from_path(enriched_vcf_path)

        single_caller_variants = []
        for record in reader:
            assert record is not None
            if "SUPP_CALLERS" in record.INFO:
                callers = record.INFO["SUPP_CALLERS"]
                if isinstance(callers, list) and len(callers) == 1:
                    single_caller_variants.append(record)

        assert len(single_caller_variants) > 0

        for record in single_caller_variants:
            assert "NUM_CALLERS" in record.INFO
            assert record.INFO["NUM_CALLERS"] == 1

    def test_multi_caller_has_correct_num_callers(self, enriched_vcf_path):
        reader = vcfpy.Reader.from_path(enriched_vcf_path)

        multi_caller_variants = []
        for record in reader:
            assert record is not None
            if "SUPP_CALLERS" in record.INFO:
                callers = record.INFO["SUPP_CALLERS"]
                if isinstance(callers, list) and len(callers) > 1:
                    multi_caller_variants.append(record)

        assert len(multi_caller_variants) > 0

        for record in multi_caller_variants:
            assert "NUM_CALLERS" in record.INFO
            expected = len(record.INFO["SUPP_CALLERS"])
            actual = record.INFO["NUM_CALLERS"]
            assert actual == expected

    def test_supp_callers_is_list_not_string(self, enriched_vcf_path):
        reader = vcfpy.Reader.from_path(enriched_vcf_path)

        for record in reader:
            assert record is not None
            if "SUPP_CALLERS" in record.INFO:
                assert isinstance(record.INFO["SUPP_CALLERS"], list)
                for caller in record.INFO["SUPP_CALLERS"]:
                    assert isinstance(caller, str)

    def test_primary_caller_is_string(self, enriched_vcf_path):
        reader = vcfpy.Reader.from_path(enriched_vcf_path)

        for record in reader:
            assert record is not None
            if "PRIMARY_CALLER" in record.INFO:
                assert isinstance(record.INFO["PRIMARY_CALLER"], str)

    def test_num_callers_is_integer(self, enriched_vcf_path):
        reader = vcfpy.Reader.from_path(enriched_vcf_path)

        for record in reader:
            assert record is not None
            if "NUM_CALLERS" in record.INFO:
                assert isinstance(record.INFO["NUM_CALLERS"], int)
                assert record.INFO["NUM_CALLERS"] > 0

    def test_enriched_vcf_preserves_original_info_fields(self, sample_vcf_path, enriched_vcf_path):
        original_reader = vcfpy.Reader.from_path(str(sample_vcf_path))
        enriched_reader = vcfpy.Reader.from_path(enriched_vcf_path)

        original_records = list(original_reader)
        enriched_records = list(enriched_reader)

        for orig, enr in zip(original_records, enriched_records):
            assert orig is not None and enr is not None
            assert orig.CHROM == enr.CHROM
            assert orig.POS == enr.POS
            assert orig.REF == enr.REF
            assert orig.ALT == enr.ALT
            assert orig.QUAL == enr.QUAL
            assert orig.FILTER == enr.FILTER

            for key in orig.INFO:
                if key not in ["SUPP_CALLERS", "PRIMARY_CALLER", "NUM_CALLERS", "SVLEN"]:
                    assert key in enr.INFO
                    assert orig.INFO[key] == enr.INFO[key]

    def test_enriched_vcf_contains_modified_parsed_fields(self, negative_svlen_vcf_path):
        df, _ = parse_vcf(str(negative_svlen_vcf_path), VcfType.BCF)

        with tempfile.NamedTemporaryFile(mode="w", suffix="_enriched.vcf", delete=False) as f:
            output_vcf = f.name

        try:
            assert df.loc[0, "SVLEN"] == 500
            write_enriched_vcf(str(negative_svlen_vcf_path), df, output_vcf)

            reader = vcfpy.Reader.from_path(output_vcf)
            record = next(reader)
            assert record is not None

            assert "SVLEN" in record.INFO
            assert record.INFO["SVLEN"] == 500
        finally:
            Path(output_vcf).unlink(missing_ok=True)

    def test_enriched_vcf_specific_variant_chr1_10000(self, enriched_vcf_path):
        reader = vcfpy.Reader.from_path(enriched_vcf_path)

        target_record = None
        for record in reader:
            assert record is not None
            if record.CHROM == "chr1" and record.POS == 10000:
                target_record = record
                break

        assert target_record is not None
        assert "SUPP_CALLERS" in target_record.INFO
        callers = target_record.INFO["SUPP_CALLERS"]
        assert len(callers) == 2
        assert "sniffles" in callers or "cuteSV" in callers
        assert "NUM_CALLERS" in target_record.INFO
        assert target_record.INFO["NUM_CALLERS"] == 2
        assert "PRIMARY_CALLER" in target_record.INFO

    def test_enriched_vcf_handles_missing_supp_callers(self, minimal_vcf_path):
        df = pd.DataFrame(
            {"CHROM": ["chr1"], "POSITION": [1000], "ID": ["."], "REF": ["N"], "ALT": ["<DEL>"]}
        )

        with tempfile.NamedTemporaryFile(mode="w", suffix="_enriched.vcf", delete=False) as f:
            output_vcf = f.name

        try:
            write_enriched_vcf(str(minimal_vcf_path), df, output_vcf)
            reader = vcfpy.Reader.from_path(output_vcf)
            record = next(reader)
            assert record is not None
            assert "NUM_CALLERS" not in record.INFO
        finally:
            Path(output_vcf).unlink(missing_ok=True)


class TestEnrichedVCFEdgeCases:

    def test_empty_dataframe(self, sample_vcf_path):
        df = pd.DataFrame()

        with tempfile.NamedTemporaryFile(mode="w", suffix="_enriched.vcf", delete=False) as f:
            output_path = f.name

        try:
            write_enriched_vcf(str(sample_vcf_path), df, output_path)
            reader = vcfpy.Reader.from_path(output_path)
            records = list(reader)
            assert len(records) > 0

            for record in records:
                assert record is not None
                assert "NUM_CALLERS" not in record.INFO
        finally:
            Path(output_path).unlink(missing_ok=True)

    def test_single_variant_vcf(self, minimal_vcf_path):
        df, _ = parse_vcf(str(minimal_vcf_path), VcfType.BCF)

        with tempfile.NamedTemporaryFile(mode="w", suffix="_enriched.vcf", delete=False) as f:
            output_vcf = f.name

        try:
            write_enriched_vcf(str(minimal_vcf_path), df, output_vcf)
            reader = vcfpy.Reader.from_path(output_vcf)
            records = list(reader)
            assert len(records) == 1
        finally:
            Path(output_vcf).unlink(missing_ok=True)

    def test_caller_names_with_mixed_case(self, minimal_vcf_path):
        df = pd.DataFrame(
            {
                "CHROM": ["chr1"],
                "POSITION": [1000],
                "SUPP_CALLERS": ["CuteSV,Sniffles"],
                "PRIMARY_CALLER": ["CuteSV"],
            }
        )

        with tempfile.NamedTemporaryFile(mode="w", suffix="_enriched.vcf", delete=False) as f:
            output_vcf = f.name

        try:
            write_enriched_vcf(str(minimal_vcf_path), df, output_vcf)
            reader = vcfpy.Reader.from_path(output_vcf)
            record = next(reader)
            assert record is not None

            assert "CuteSV" in record.INFO["SUPP_CALLERS"]
            assert "Sniffles" in record.INFO["SUPP_CALLERS"]
            assert record.INFO["NUM_CALLERS"] == 2
        finally:
            Path(output_vcf).unlink(missing_ok=True)


class TestEnrichedVCFIntegration:

    def test_bcf_vcf_enrichment(self, sample_vcf_path):
        df, _ = parse_vcf(str(sample_vcf_path), VcfType.BCF)

        with tempfile.NamedTemporaryFile(mode="w", suffix="_enriched.vcf", delete=False) as f:
            output_path = f.name

        try:
            write_enriched_vcf(str(sample_vcf_path), df, output_path)
            assert Path(output_path).exists()

            reader = vcfpy.Reader.from_path(output_path)
            records = list(reader)

            has_supp_callers = any("SUPP_CALLERS" in r.INFO for r in records if r is not None)
            assert has_supp_callers
        finally:
            Path(output_path).unlink(missing_ok=True)

    def test_survivor_vcf_enrichment(self, sample_vcf_path):
        df, _ = parse_vcf(str(sample_vcf_path), VcfType.SURVIVOR)

        with tempfile.NamedTemporaryFile(mode="w", suffix="_enriched.vcf", delete=False) as f:
            output_path = f.name

        try:
            write_enriched_vcf(str(sample_vcf_path), df, output_path)
            assert Path(output_path).exists()

            reader = vcfpy.Reader.from_path(output_path)
            records = list(reader)
            assert len(records) > 0
        finally:
            Path(output_path).unlink(missing_ok=True)

    def test_caller_specific_processing(self, sample_vcf_path):
        df, _ = parse_vcf(str(sample_vcf_path), VcfType.BCF)

        callers = df["PRIMARY_CALLER"].unique()
        assert "sniffles" in callers
        assert "cuteSV" in callers
        assert "TIDDIT" in callers
        assert "Dysgu" in callers

        assert len(df[df["PRIMARY_CALLER"] == "sniffles"]) == 7
        assert len(df[df["PRIMARY_CALLER"] == "cuteSV"]) == 5
        assert len(df[df["PRIMARY_CALLER"] == "TIDDIT"]) == 3
        assert len(df[df["PRIMARY_CALLER"] == "Dysgu"]) == 2
