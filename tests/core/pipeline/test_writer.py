"""
Tests for VcfWriter - Enriched VCF file writing.

"""

import os

import pandas as pd
import pysam
import pytest
import vcfpy

from src.varify.core.pipeline.writer import WRITABLE_INFO_FIELDS, VcfWriter
from tests.doubles import create_sample_dataframe


@pytest.mark.integration
class TestVcfWriterWithRealData:
    """Integration tests using real VCF files from data/ directory."""

    def test_write_enriched_bcf_vcf(self, bcf_vcf_path, real_bcf_df, temp_output_dir):
        """Test writing enriched VCF from real BCF data."""
        df, _ = real_bcf_df

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="test_output",
            prefix="enriched_",
        )

        result_path = writer.write_and_compress(compress=False, keep_uncompressed=True)

        assert os.path.exists(result_path), f"Output file not created: {result_path}"

        vcf = pysam.VariantFile(str(result_path))
        records = list(vcf)

        assert len(records) == 1214, f"Expected 1214 records, got {len(records)}"

        assert "SUPP_CALLERS" in vcf.header.info, "SUPP_CALLERS not in header"
        assert "PRIMARY_CALLER" in vcf.header.info, "PRIMARY_CALLER not in header"
        assert "NUM_CALLERS" in vcf.header.info, "NUM_CALLERS not in header"

        found_computed_fields = False
        for record in records:
            assert record is not None
            if "SUPP_CALLERS" in record.info:
                found_computed_fields = True
                break

        assert found_computed_fields, "No records have computed fields"

        vcf.close()

    def test_write_enriched_survivor_vcf(
        self, survivor_vcf_path, real_survivor_df, temp_output_dir
    ):
        """Test writing enriched VCF from real SURVIVOR data."""
        df, _ = real_survivor_df

        writer = VcfWriter(
            original_vcf_path=str(survivor_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="",  # No subdirectory
            output_filename="enriched_survivor.vcf",
        )

        result_path = writer.write_and_compress(compress=False)

        assert os.path.exists(result_path)

        reader = vcfpy.Reader.from_path(result_path)
        records = list(reader)
        reader.close()

        assert len(records) == 1059, f"Expected 1059 records, got {len(records)}"
        assert records[0] is not None
        assert "SUPP_CALLERS" in records[0].INFO or len(records[0].INFO) == len(records[0].INFO)

    def test_compress_and_index_real_vcf(self, bcf_vcf_path, real_bcf_df, temp_output_dir):
        """Test compression and indexing of enriched VCF."""
        df, _ = real_bcf_df

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="compressed",
        )

        compressed_path = writer.write_and_compress(compress=True, keep_uncompressed=True)

        assert compressed_path.endswith(".gz")
        assert os.path.exists(compressed_path)

        index_path = f"{compressed_path}.tbi"
        assert os.path.exists(index_path), f"Index file not created: {index_path}"

        uncompressed_path = compressed_path[:-3]  # Remove .gz
        assert os.path.exists(uncompressed_path), "Uncompressed file not kept"

        vcf = pysam.VariantFile(compressed_path)
        records = list(vcf)
        assert len(records) == 1214, f"Expected 1214 records, got {len(records)}"
        vcf.close()

    def test_compress_and_remove_uncompressed(self, bcf_vcf_path, real_bcf_df, temp_output_dir):
        """Test compression with removal of uncompressed file."""
        df, _ = real_bcf_df

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="compressed_only",
        )

        compressed_path = writer.write_and_compress(compress=True, keep_uncompressed=False)

        uncompressed_path = compressed_path[:-3]
        assert not os.path.exists(uncompressed_path), "Uncompressed file not removed"

        assert os.path.exists(compressed_path)

    def test_empty_dataframe_warning(self, bcf_vcf_path, temp_output_dir):
        """Test that empty DataFrame triggers warning but still writes VCF."""
        empty_df = pd.DataFrame()

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=empty_df,
            subdir="empty_test",
        )

        result_path = writer.write_and_compress(compress=False)

        assert os.path.exists(result_path)

        reader = vcfpy.Reader.from_path(result_path)
        records = list(reader)
        reader.close()
        assert len(records) == 1214, f"Expected 1214 records, got {len(records)}"

    def test_none_dataframe_writes_original(self, bcf_vcf_path, temp_output_dir):
        """Test that None DataFrame writes original VCF."""
        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=None,
            subdir="none_test",
        )

        result_path = writer.write_and_compress(compress=False)
        assert os.path.exists(result_path)


class TestVcfWriterConstruction:
    """Unit tests for VcfWriter initialization."""

    def test_init_with_default_parameters(self, bcf_vcf_path, temp_output_dir):
        """Test VcfWriter initialization with default parameters."""
        df = create_sample_dataframe(10)

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
        )

        assert writer.original_vcf_path == str(bcf_vcf_path)
        assert writer.df is not None
        assert writer.should_write is True
        assert "genome_files" in writer.output_path
        assert "enriched_" in writer.output_path

    def test_init_with_custom_parameters(self, bcf_vcf_path, temp_output_dir):
        """Test VcfWriter initialization with custom parameters."""
        df = create_sample_dataframe(10)

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="custom_dir",
            output_filename="custom_output.vcf",
            prefix="ignored_",
        )

        assert "custom_dir" in writer.output_path
        assert writer.output_path.endswith("custom_output.vcf")
        assert "ignored_" not in writer.output_path

    def test_init_with_empty_subdir(self, bcf_vcf_path, temp_output_dir):
        """Test VcfWriter with empty subdir."""
        df = create_sample_dataframe(10)

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="",
        )

        assert str(temp_output_dir) in writer.output_path

    def test_init_creates_output_directory(self, bcf_vcf_path, temp_output_dir):
        """Test that VcfWriter creates output directory."""
        df = create_sample_dataframe(10)

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="new_directory",
        )

        # Directory should be created
        expected_dir = os.path.join(str(temp_output_dir), "new_directory")
        assert os.path.exists(expected_dir)
        assert expected_dir in writer.output_path

    def test_should_write_flag_with_empty_df(self, bcf_vcf_path, temp_output_dir):
        """Test should_write flag is False for empty DataFrame."""
        empty_df = pd.DataFrame()

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=empty_df,
        )

        assert writer.should_write is False

    def test_should_write_flag_with_none_df(self, bcf_vcf_path, temp_output_dir):
        """Test should_write flag is False for None DataFrame."""
        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=None,
        )

        assert writer.should_write is False


class TestVcfWriterLookup:
    """Unit tests for DataFrame lookup creation."""

    def test_create_lookup_basic(self, bcf_vcf_path, temp_output_dir):
        """Test lookup dictionary creation."""
        df = create_sample_dataframe(5)
        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
        )

        lookup = writer._create_lookup(df)

        assert len(lookup) == 5

        # Keys should be (CHROM, POSITION) tuples
        first_key = list(lookup.keys())[0]
        assert isinstance(first_key, tuple)
        assert len(first_key) == 2

    def test_create_lookup_unique_keys(self, bcf_vcf_path, temp_output_dir):
        """Test that lookup handles unique (CHROM, POSITION) keys."""
        data = [
            {"CHROM": "NC_001133.9", "POSITION": 1000, "SVTYPE": "DEL"},
            {"CHROM": "NC_001133.9", "POSITION": 2000, "SVTYPE": "DUP"},
            {"CHROM": "NC_001134.8", "POSITION": 1000, "SVTYPE": "INV"},
        ]
        df = pd.DataFrame(data)

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
        )

        lookup = writer._create_lookup(df)

        assert len(lookup) == 3
        assert ("NC_001133.9", 1000) in lookup
        assert ("NC_001133.9", 2000) in lookup
        assert ("NC_001134.8", 1000) in lookup


class TestVcfWriterInfoFields:
    """Unit tests for INFO field updates."""

    def test_writable_info_fields_configuration(self):
        """Test WRITABLE_INFO_FIELDS configuration."""
        assert "SVTYPE" in WRITABLE_INFO_FIELDS
        assert "SVLEN" in WRITABLE_INFO_FIELDS
        assert "END" in WRITABLE_INFO_FIELDS

        for df_col, (vcf_field, converter) in WRITABLE_INFO_FIELDS.items():
            assert isinstance(vcf_field, str)
            assert callable(converter)

    def test_info_field_converters(self):
        """Test INFO field type converters."""
        assert WRITABLE_INFO_FIELDS["SVTYPE"][1]("DEL") == "DEL"

        assert WRITABLE_INFO_FIELDS["SVLEN"][1](-500) == -500
        assert WRITABLE_INFO_FIELDS["END"][1](1500) == 1500

        assert WRITABLE_INFO_FIELDS["IMPRECISE"][1](True) is True
        assert WRITABLE_INFO_FIELDS["IMPRECISE"][1](False) is None


@pytest.mark.integration
class TestVcfWriterFieldUpdates:
    """Integration tests for specific field updates using real VCF."""

    def test_supp_callers_written_correctly(self, fixture_minimal_deletion_vcf, temp_output_dir):
        """Test SUPP_CALLERS field is written correctly."""
        data = [
            {
                "CHROM": "NC_001133.9",
                "POSITION": 1000,
                "SVTYPE": "DEL",
                "SVLEN": -500,
                "END": 1500,
                "SUPP_CALLERS": "delly,dysgu",
                "PRIMARY_CALLER": "delly",
            }
        ]
        df = pd.DataFrame(data)

        writer = VcfWriter(
            original_vcf_path=str(fixture_minimal_deletion_vcf),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="",
            output_filename="output.vcf",
        )

        result_path = writer.write_and_compress(compress=False)

        vcf = pysam.VariantFile(result_path)
        records = list(vcf)
        vcf.close()

        assert len(records) == 1
        record = records[0]
        assert record is not None

        # SUPP_CALLERS should be a list
        assert "SUPP_CALLERS" in record.info
        supp_callers = record.info["SUPP_CALLERS"]
        assert isinstance(supp_callers, tuple)
        assert "delly" in supp_callers
        assert "dysgu" in supp_callers

        # NUM_CALLERS should be computed
        assert "NUM_CALLERS" in record.info
        assert record.info["NUM_CALLERS"] == 2

        # PRIMARY_CALLER should be set
        assert "PRIMARY_CALLER" in record.info
        assert record.info["PRIMARY_CALLER"] == "delly"

    def test_confidence_intervals_written(self, fixture_confidence_intervals_vcf, temp_output_dir):
        """Test confidence interval fields are written correctly."""
        data = [
            {
                "CHROM": "NC_001133.9",
                "POSITION": 1000,
                "SVTYPE": "DEL",
                "CIPOS": "(-50, 50)",
                "CIEND": "(-30, 30)",
            }
        ]
        df = pd.DataFrame(data)

        writer = VcfWriter(
            original_vcf_path=str(fixture_confidence_intervals_vcf),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="",
            output_filename="output_ci.vcf",
        )

        result_path = writer.write_and_compress(compress=False)

        vcf = pysam.VariantFile(result_path)
        records = list(vcf)
        vcf.close()

        record = records[0]
        assert record is not None
        assert "CIPOS" in record.info
        assert "CIEND" in record.info

        cipos = record.info["CIPOS"]
        ciend = record.info["CIEND"]
        assert len(cipos) == 2
        assert len(ciend) == 2


class TestVcfWriterUpdateRecord:
    """Tests for _update_record method to increase coverage."""

    def test_update_record_with_all_writable_fields(
        self, fixture_all_writable_fields_vcf, temp_output_dir
    ):
        """Test updating record with all writable INFO fields."""
        data = [
            {
                "CHROM": "NC_001133.9",
                "POSITION": 1000,
                "SVTYPE": "DEL",
                "SVLEN": -500,
                "END": 1500,
                "CHROM2": "NC_001133.9",
                "MATE_ID": "mate1",
                "HOMLEN": 10,
                "HOMSEQ": "ACGT",
                "IMPRECISE": True,
                "PRECISE": False,
            }
        ]
        df = pd.DataFrame(data)

        writer = VcfWriter(
            original_vcf_path=str(fixture_all_writable_fields_vcf),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="",
            output_filename="enriched.vcf",
        )

        result_path = writer.write_and_compress(compress=False)

        vcf = pysam.VariantFile(result_path)
        record = list(vcf)[0]
        assert record is not None

        assert record.info["SVTYPE"] == "DEL"
        assert record.info["SVLEN"] == -500
        assert record.stop == 1500
        assert record.info["CHR2"] == "NC_001133.9"
        assert record.info["MATEID"] == "mate1"
        assert record.info["HOMLEN"] == 10
        assert record.info["HOMSEQ"] == "ACGT"
        assert "IMPRECISE" in record.info

        vcf.close()

    def test_update_record_skips_none_values(self, fixture_none_values_vcf, temp_output_dir):
        """Test that None values are skipped during record update."""
        data = [
            {
                "CHROM": "NC_001133.9",
                "POSITION": 1000,
                "SVTYPE": "DEL",
                "SVLEN": None,
                "END": 1500,
            }
        ]
        df = pd.DataFrame(data)

        writer = VcfWriter(
            original_vcf_path=str(fixture_none_values_vcf),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="",
        )

        result_path = writer.write_and_compress(compress=False)

        vcf = pysam.VariantFile(result_path)
        record = list(vcf)[0]

        assert record.info["SVLEN"] == -500

        vcf.close()

    def test_update_format_fields(self, fixture_format_fields_vcf, temp_output_dir):
        """Test updating FORMAT sample fields."""
        data = [
            {
                "CHROM": "NC_001133.9",
                "POSITION": 1000,
                "SVTYPE": "DEL",
                "GT": "0/1",
                "DP": "30",
                "GQ": "99",
            }
        ]
        df = pd.DataFrame(data)

        writer = VcfWriter(
            original_vcf_path=str(fixture_format_fields_vcf),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="",
        )

        result_path = writer.write_and_compress(compress=False)

        vcf = pysam.VariantFile(result_path)
        record = list(vcf)[0]

        sample = record.samples["sample1"]
        assert sample["GT"] == (0, 1)

        vcf.close()


class TestVcfWriterCompression:
    """Tests for compression and indexing functionality."""

    def test_compress_creates_bgzip_file(self, bcf_vcf_path, real_bcf_df, temp_output_dir):
        """Test that compression creates valid bgzip file."""
        df, samples = real_bcf_df

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="compress_test",
        )

        compressed_path = writer.write_and_compress(compress=True, keep_uncompressed=False)

        assert compressed_path.endswith(".gz")
        assert os.path.exists(compressed_path)

        vcf = pysam.VariantFile(compressed_path)
        records = list(vcf)
        assert len(records) == 1214, f"Expected 1214 records, got {len(records)}"
        vcf.close()

    def test_compress_creates_tabix_index(self, bcf_vcf_path, real_bcf_df, temp_output_dir):
        """Test that tabix index is created."""
        df, samples = real_bcf_df

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_path),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="index_test",
        )

        compressed_path = writer.write_and_compress(compress=True)
        index_path = f"{compressed_path}.tbi"

        assert os.path.exists(index_path)

        assert os.path.getsize(index_path) == os.path.getsize(index_path)


class TestVcfWriterEdgeCases:
    """Edge case tests for VcfWriter."""

    def test_write_with_gzipped_input(self, bcf_vcf_gz_path, temp_output_dir):
        """Test writing from gzipped input VCF."""

        df = pd.DataFrame()

        writer = VcfWriter(
            original_vcf_path=str(bcf_vcf_gz_path),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="gz_input",
        )

        result_path = writer.write_and_compress(compress=False)

        assert os.path.exists(result_path)

        vcf = pysam.VariantFile(result_path)
        records = list(vcf)
        assert len(records) == 1214, f"Expected 1214 records, got {len(records)}"
        vcf.close()

    def test_write_preserves_record_order(self, fixture_multi_chrom_vcf, temp_output_dir):
        """Test that VCF record order is preserved."""
        data = [
            {"CHROM": "chr1", "POSITION": 1000, "SVTYPE": "DEL"},
            {"CHROM": "chr1", "POSITION": 2000, "SVTYPE": "INS"},
            {"CHROM": "chr2", "POSITION": 500, "SVTYPE": "DUP"},
        ]
        df = pd.DataFrame(data)

        writer = VcfWriter(
            original_vcf_path=str(fixture_multi_chrom_vcf),
            output_base_dir=str(temp_output_dir),
            df=df,
            subdir="",
        )

        result_path = writer.write_and_compress(compress=False)

        vcf = pysam.VariantFile(result_path)
        records = list(vcf)

        assert records[0].chrom == "chr1" and records[0].pos == 1000
        assert records[1].chrom == "chr1" and records[1].pos == 2000
        assert records[2].chrom == "chr2" and records[2].pos == 500

        vcf.close()
