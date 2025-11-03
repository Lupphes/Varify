"""
Tests for Aggregator

"""

import pandas as pd
import pytest

from src.varify.core.pipeline.aggregator import Aggregator
from tests.doubles import create_sample_dataframe


@pytest.mark.integration
class TestAggregatorWithRealData:
    """Integration tests using real VCF data from data/ directory."""

    def test_compute_supp_callers_on_bcf_df(self, real_bcf_df):
        """Test SUPP_CALLERS computation on real BCF DataFrame.

        BCF files have already been aggregated by parse_vcf(), so they
        should already have SUPP_CALLERS.
        """
        df, samples = real_bcf_df

        assert "SUPP_CALLERS" in df.columns or any("SUPP_CALLERS" in str(col) for col in df.columns)

        supp_callers_col = [col for col in df.columns if "SUPP_CALLERS" in str(col)][-1]
        assert df[supp_callers_col].notna().any()

    def test_survivor_has_supp_callers_from_extraction(self, real_survivor_df):
        """Test that SURVIVOR DataFrame already has SUPP_CALLERS from extraction.

        SURVIVOR files extract SUPP_CALLERS from sample ID fields during parsing.
        They should NOT be aggregated (should_aggregate()=False).
        """
        df, samples = real_survivor_df

        assert "SUPP_CALLERS" in df.columns
        assert df["SUPP_CALLERS"].notna().any()

        assert not any(
            "SUPP_CALLERS_x" in str(col) or "SUPP_CALLERS_y" in str(col) for col in df.columns
        )

    def test_compute_num_callers_on_bcf_df(self, real_bcf_df):
        """Test NUM_CALLERS computation on real BCF DataFrame."""
        df, samples = real_bcf_df

        assert "NUM_CALLERS" in df.columns

        assert pd.api.types.is_numeric_dtype(df["NUM_CALLERS"])

        assert (df["NUM_CALLERS"] >= 1).all()

    def test_bcf_aggregation_already_done(self, real_bcf_df):
        """Test that BCF aggregation is already complete from parse_vcf().

        BCF files have should_aggregate()=True, so parse_vcf() already
        ran the full aggregation pipeline.
        """
        df, samples = real_bcf_df

        assert "NUM_CALLERS" in df.columns

        supp_callers_cols = [col for col in df.columns if "SUPP_CALLERS" in str(col)]
        assert len(supp_callers_cols) > 0

        assert df["NUM_CALLERS"].notna().all()
        assert (df["NUM_CALLERS"] >= 1).all()

    def test_survivor_no_aggregation_needed(self, real_survivor_df):
        """Test that SURVIVOR data doesn't need aggregation.

        SURVIVOR files have should_aggregate()=False, so they already
        have SUPP_CALLERS from extract_type_specific_fields().
        """
        df, samples = real_survivor_df

        assert "SUPP_CALLERS" in df.columns

        assert not any("SUPP_CALLERS_x" in str(col) for col in df.columns)

        multi_caller_variants = df[df["SUPP_CALLERS"].str.contains(",", na=False)]
        assert len(multi_caller_variants) > 0, "Expected multi-caller variants in SURVIVOR data"

    def test_validate_and_filter_on_real_data(self, real_bcf_df):
        """Test validation and filtering on real data."""
        df, samples = real_bcf_df

        result, excluded, invalid = Aggregator.validate_and_filter(df)

        assert isinstance(result, pd.DataFrame)

        assert excluded >= 0
        assert invalid >= 0

        assert "SVTYPE" in result.columns
        assert "SVLEN" in result.columns

        assert result["SVTYPE"].notna().all()
        assert result["SVLEN"].notna().all()


class TestComputeSuppCallers:
    """Unit tests for compute_supp_callers method."""

    def test_compute_supp_callers_basic(self):
        """Test basic SUPP_CALLERS computation."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "PRIMARY_CALLER": "delly"},
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "PRIMARY_CALLER": "dysgu"},
            {"CHROM": "chr1", "POSITION": 2000, "SVTYPE": "DUP", "PRIMARY_CALLER": "cutesv"},
        ]
        df = pd.DataFrame(data)

        result = Aggregator.compute_supp_callers(df)

        assert "SUPP_CALLERS" in result.columns

        first_row = result.iloc[0]
        assert "delly" in first_row["SUPP_CALLERS"]
        assert "dysgu" in first_row["SUPP_CALLERS"]

        third_row = result.iloc[2]
        assert third_row["SUPP_CALLERS"] == "cutesv"

    def test_compute_supp_callers_sorted_unique(self):
        """Test that SUPP_CALLERS are sorted and unique."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "PRIMARY_CALLER": "zebra"},
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "PRIMARY_CALLER": "apple"},
            {
                "CHROM": "chr1",
                "POSITION": 1000,
                "SVTYPE": "DEL",
                "PRIMARY_CALLER": "zebra",
            },
        ]
        df = pd.DataFrame(data)

        result = Aggregator.compute_supp_callers(df)

        supp_callers = result.iloc[0]["SUPP_CALLERS"]
        callers = supp_callers.split(",")

        assert callers == ["apple", "zebra"], f"Expected ['apple', 'zebra'], got {callers}"

    def test_compute_supp_callers_handles_none(self):
        """Test handling of None PRIMARY_CALLER values."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "PRIMARY_CALLER": "delly"},
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "PRIMARY_CALLER": None},
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "PRIMARY_CALLER": "dysgu"},
        ]
        df = pd.DataFrame(data)

        result = Aggregator.compute_supp_callers(df)

        supp_callers = result.iloc[0]["SUPP_CALLERS"]
        assert "None" not in supp_callers
        assert "delly" in supp_callers
        assert "dysgu" in supp_callers

    def test_compute_supp_callers_empty_df(self):
        """Test with empty DataFrame."""
        df = pd.DataFrame()
        result = Aggregator.compute_supp_callers(df)

        assert result.empty

    def test_compute_supp_callers_none_df(self):
        """Test with None DataFrame."""
        result = Aggregator.compute_supp_callers(None)  # type: ignore[arg-type]

        assert result is None

    def test_compute_supp_callers_different_chroms(self):
        """Test that variants on different chromosomes don't get merged."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "PRIMARY_CALLER": "delly"},
            {"CHROM": "chr2", "POSITION": 1000, "SVTYPE": "DEL", "PRIMARY_CALLER": "dysgu"},
        ]
        df = pd.DataFrame(data)

        result = Aggregator.compute_supp_callers(df)

        assert result.iloc[0]["SUPP_CALLERS"] == "delly"
        assert result.iloc[1]["SUPP_CALLERS"] == "dysgu"

    def test_compute_supp_callers_different_positions(self):
        """Test that variants at different positions don't get merged."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "PRIMARY_CALLER": "delly"},
            {"CHROM": "chr1", "POSITION": 2000, "SVTYPE": "DEL", "PRIMARY_CALLER": "dysgu"},
        ]
        df = pd.DataFrame(data)

        result = Aggregator.compute_supp_callers(df)

        assert result.iloc[0]["SUPP_CALLERS"] == "delly"
        assert result.iloc[1]["SUPP_CALLERS"] == "dysgu"

    def test_compute_supp_callers_different_svtypes(self):
        """Test that variants with different SVTYPE don't get merged."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "PRIMARY_CALLER": "delly"},
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DUP", "PRIMARY_CALLER": "dysgu"},
        ]
        df = pd.DataFrame(data)

        result = Aggregator.compute_supp_callers(df)

        assert result.iloc[0]["SUPP_CALLERS"] == "delly"
        assert result.iloc[1]["SUPP_CALLERS"] == "dysgu"


class TestComputeNumCallers:
    """Unit tests for compute_num_callers method."""

    def test_compute_num_callers_basic(self):
        """Test basic NUM_CALLERS computation."""
        data = [
            {"SUPP_CALLERS": "delly,dysgu"},
            {"SUPP_CALLERS": "cutesv"},
            {"SUPP_CALLERS": "delly,dysgu,cutesv"},
        ]
        df = pd.DataFrame(data)

        result = Aggregator.compute_num_callers(df)

        assert "NUM_CALLERS" in result.columns
        assert result.iloc[0]["NUM_CALLERS"] == 2
        assert result.iloc[1]["NUM_CALLERS"] == 1
        assert result.iloc[2]["NUM_CALLERS"] == 3

    def test_compute_num_callers_handles_empty_string(self):
        """Test handling of empty SUPP_CALLERS string."""
        data = [
            {"SUPP_CALLERS": ""},
            {"SUPP_CALLERS": "delly"},
        ]
        df = pd.DataFrame(data)

        result = Aggregator.compute_num_callers(df)

        assert result.iloc[0]["NUM_CALLERS"] == 0
        assert result.iloc[1]["NUM_CALLERS"] == 1

    def test_compute_num_callers_handles_none(self):
        """Test handling of None SUPP_CALLERS."""
        data = [
            {"SUPP_CALLERS": None},
            {"SUPP_CALLERS": "delly"},
        ]
        df = pd.DataFrame(data)

        result = Aggregator.compute_num_callers(df)

        assert result.iloc[0]["NUM_CALLERS"] == 0
        assert result.iloc[1]["NUM_CALLERS"] == 1

    def test_compute_num_callers_empty_df(self):
        """Test with empty DataFrame."""
        df = pd.DataFrame()
        result = Aggregator.compute_num_callers(df)

        assert result.empty

    def test_compute_num_callers_missing_column(self):
        """Test with DataFrame missing SUPP_CALLERS column."""
        df = pd.DataFrame({"OTHER_COL": [1, 2, 3]})
        result = Aggregator.compute_num_callers(df)

        assert "NUM_CALLERS" not in result.columns

    def test_compute_num_callers_deduplicates(self):
        """Test that NUM_CALLERS counts unique callers."""
        data = [
            {"SUPP_CALLERS": "delly,delly,dysgu"},
        ]
        df = pd.DataFrame(data)

        result = Aggregator.compute_num_callers(df)

        assert result.iloc[0]["NUM_CALLERS"] == 2


class TestValidateAndFilter:
    """Unit tests for validate_and_filter method."""

    def test_validate_and_filter_removes_missing_svtype(self):
        """Test that records with missing SVTYPE are excluded."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "SVLEN": -500},
            {"CHROM": "chr1", "POSITION": 2000, "SVTYPE": None, "SVLEN": -300},
            {"CHROM": "chr1", "POSITION": 3000, "SVTYPE": "DUP", "SVLEN": 200},
        ]
        df = pd.DataFrame(data)

        result, excluded, invalid = Aggregator.validate_and_filter(df)

        assert len(result) == 2
        assert excluded == 1
        assert invalid == 0

        assert result["SVTYPE"].notna().all()

    def test_validate_and_filter_removes_missing_svlen(self):
        """Test that records with missing SVLEN are excluded."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "SVLEN": -500},
            {"CHROM": "chr1", "POSITION": 2000, "SVTYPE": "DUP", "SVLEN": None},
            {"CHROM": "chr1", "POSITION": 3000, "SVTYPE": "INV", "SVLEN": 200},
        ]
        df = pd.DataFrame(data)

        result, excluded, invalid = Aggregator.validate_and_filter(df)

        assert len(result) == 2
        assert excluded == 0
        assert invalid == 1
        assert result["SVLEN"].notna().all()

    def test_validate_and_filter_both_missing(self):
        """Test with both SVTYPE and SVLEN missing."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "SVLEN": -500},
            {"CHROM": "chr1", "POSITION": 2000, "SVTYPE": None, "SVLEN": -300},
            {"CHROM": "chr1", "POSITION": 3000, "SVTYPE": "DUP", "SVLEN": None},
        ]
        df = pd.DataFrame(data)

        result, excluded, invalid = Aggregator.validate_and_filter(df)

        assert len(result) == 1
        assert excluded == 1
        assert invalid == 1

    def test_validate_and_filter_empty_df(self):
        """Test with empty DataFrame."""
        df = pd.DataFrame()
        result, excluded, invalid = Aggregator.validate_and_filter(df)

        assert result.empty
        assert excluded == 0
        assert invalid == 0

    def test_validate_and_filter_none_df(self):
        """Test with None DataFrame."""
        result, excluded, invalid = Aggregator.validate_and_filter(None)  # type: ignore[arg-type]

        assert result is None
        assert excluded == 0
        assert invalid == 0

    def test_validate_and_filter_all_valid(self):
        """Test with all valid records."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "SVLEN": -500},
            {"CHROM": "chr1", "POSITION": 2000, "SVTYPE": "DUP", "SVLEN": 300},
            {"CHROM": "chr1", "POSITION": 3000, "SVTYPE": "INV", "SVLEN": 200},
        ]
        df = pd.DataFrame(data)

        result, excluded, invalid = Aggregator.validate_and_filter(df)

        assert len(result) == 3
        assert excluded == 0
        assert invalid == 0


class TestAggregate:
    """Unit tests for aggregate method (full pipeline)."""

    def test_aggregate_runs_all_steps(self):
        """Test that aggregate runs all aggregation steps."""
        df = create_sample_dataframe(10)

        result = Aggregator.aggregate(df)

        assert "SUPP_CALLERS" in result.columns
        assert "NUM_CALLERS" in result.columns

        assert result["SUPP_CALLERS"].notna().all()
        assert result["NUM_CALLERS"].notna().all()


class TestPrintStatistics:
    """Unit tests for print_statistics method."""

    def test_print_statistics_basic(self, capsys):
        """Test basic statistics printing."""
        df = create_sample_dataframe(10)
        df = Aggregator.aggregate(df)

        Aggregator.print_statistics(df, total_records=15, excluded_records=3, invalid_records=2)

        captured = capsys.readouterr()
        output = captured.out

        assert "Total records in VCF: 15" in output
        assert "Records excluded (missing SVLEN/SVTYPE): 3" in output
        assert "Records excluded (invalid SVLEN): 2" in output
        assert "Records kept: 10" in output

    def test_print_statistics_with_multi_caller_variants(self, capsys):
        """Test statistics with multi-caller variants."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL", "SUPP_CALLERS": "delly,dysgu"},
            {"CHROM": "chr1", "POSITION": 2000, "SVTYPE": "DUP", "SUPP_CALLERS": "cutesv"},
            {
                "CHROM": "chr1",
                "POSITION": 3000,
                "SVTYPE": "INV",
                "SUPP_CALLERS": "delly,dysgu,cutesv",
            },
        ]
        df = pd.DataFrame(data)

        Aggregator.print_statistics(df, total_records=3, excluded_records=0, invalid_records=0)

        captured = capsys.readouterr()
        output = captured.out

        assert "Variants supported by ≥2 callers: 2" in output
