"""
Pytest configuration and shared fixtures for Varify tests.
"""

import shutil
import tempfile
from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def project_root():
    """Path to project root directory."""
    return Path(__file__).parent.parent


@pytest.fixture(scope="session")
def data_dir(project_root):
    """Path to data/ directory with real VCF files."""
    return project_root / "data"


@pytest.fixture(scope="session")
def test_fixtures_dir(project_root):
    """Path to tests/fixtures/ directory."""
    return project_root / "tests" / "fixtures"


@pytest.fixture(scope="session")
def bcf_vcf_path(test_fixtures_dir):
    """Real BCF merged VCF file (bcftools_concat.vcf).

    This is a real BCF merge output with multiple samples.
    Use for testing BCF-specific processing.
    """
    path = test_fixtures_dir / "bcftools_concat.vcf"
    assert path.exists(), f"BCF VCF file not found: {path}"
    return path


@pytest.fixture(scope="session")
def bcf_vcf_gz_path(data_dir):
    """Real BCF merged VCF file, compressed (bcftools_concat.vcf.gz).

    Use for testing compressed file handling.
    """
    path = data_dir / "bcftools_concat.vcf.gz"
    assert path.exists(), f"Compressed BCF VCF file not found: {path}"
    return path


@pytest.fixture(scope="session")
def survivor_vcf_path(test_fixtures_dir):
    """Real SURVIVOR merged VCF file (survivor_merge_survivor_merge_filtered.vcf).

    This is a real SURVIVOR merge output with SUPP_VEC and multi-caller variants.
    Use for testing SURVIVOR-specific processing and multi-caller features.
    """
    path = test_fixtures_dir / "survivor_merge_survivor_merge_filtered.vcf"
    assert path.exists(), f"SURVIVOR VCF file not found: {path}"
    return path


@pytest.fixture(scope="session")
def delly_vcf_path(data_dir):
    """Real Delly caller VCF file (re-yeast_sample-illumina-false-delly.vcf).

    Use for testing caller-specific processing (Delly).
    """
    path = data_dir / "re-yeast_sample-illumina-false-delly.vcf"
    assert path.exists(), f"Delly VCF file not found: {path}"
    return path


@pytest.fixture(scope="session")
def reference_fasta_path(data_dir):
    """Real reference genome FASTA file (GCF_000146045.fna).

    Use for integration tests requiring reference genome.
    """
    path = data_dir / "GCF_000146045.fna"
    assert path.exists(), f"Reference FASTA not found: {path}"
    return path


@pytest.fixture(scope="session")
def reference_fai_path(data_dir):
    """Real reference genome index file (GCF_000146045.fna.fai).

    Use for tests requiring indexed reference.
    """
    path = data_dir / "GCF_000146045.fna.fai"
    assert path.exists(), f"Reference FAI not found: {path}"
    return path


@pytest.fixture(scope="session")
def bcftools_stats_path(test_fixtures_dir):
    """Real BCFtools stats file (bcftools_concat.bcftools_stats.txt)."""
    path = test_fixtures_dir / "bcftools_concat.bcftools_stats.txt"
    assert path.exists(), f"BCFtools stats file not found: {path}"
    return path


@pytest.fixture(scope="session")
def survivor_stats_path(test_fixtures_dir):
    """Real SURVIVOR stats file (survivor_merge.stats)."""
    path = test_fixtures_dir / "survivor_merge.stats"
    assert path.exists(), f"SURVIVOR stats file not found: {path}"
    return path


@pytest.fixture(scope="session")
def test_bcftools_stats_path(test_fixtures_dir):
    """Test BCFtools stats file from tests/fixtures/."""
    path = test_fixtures_dir / "bcftools.stats"
    assert path.exists(), f"Test BCFtools stats file not found: {path}"
    return path


@pytest.fixture(scope="session")
def test_survivor_stats_path(test_fixtures_dir):
    """Test SURVIVOR stats file from tests/fixtures/."""
    path = test_fixtures_dir / "survivor.stats"
    assert path.exists(), f"Test SURVIVOR stats file not found: {path}"
    return path


@pytest.fixture(scope="session")
def real_bcf_df(bcf_vcf_path):
    """Real DataFrame parsed from BCF VCF file.

    Returns:
        Tuple[pd.DataFrame, List[str]]: (dataframe, sample_names)
    """
    from src.varify.core.vcf_parser import VcfType, parse_vcf

    df, samples = parse_vcf(str(bcf_vcf_path), VcfType.BCF)
    assert df is not None and not df.empty, "Failed to parse BCF VCF"
    return df, samples


@pytest.fixture(scope="session")
def real_survivor_df(survivor_vcf_path):
    """Real DataFrame parsed from SURVIVOR VCF file.

    Returns:
        Tuple[pd.DataFrame, List[str]]: (dataframe, sample_names)
    """
    from src.varify.core.vcf_parser import VcfType, parse_vcf

    df, samples = parse_vcf(str(survivor_vcf_path), VcfType.SURVIVOR)
    assert df is not None and not df.empty, "Failed to parse SURVIVOR VCF"
    return df, samples


@pytest.fixture(scope="session")
def real_delly_df(delly_vcf_path):
    """Real DataFrame parsed from Delly VCF file.

    Returns:
        Tuple[pd.DataFrame, List[str]]: (dataframe, sample_names)
    """
    from src.varify.core.vcf_parser import VcfType, parse_vcf

    df, samples = parse_vcf(str(delly_vcf_path), VcfType.BCF)
    assert df is not None and not df.empty, "Failed to parse Delly VCF"
    return df, samples


@pytest.fixture
def temp_output_dir():
    """Temporary directory for test outputs.

    Automatically cleaned up after test completes.
    """
    temp_dir = tempfile.mkdtemp(prefix="varify_test_")
    yield Path(temp_dir)
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def temp_vcf_output(temp_output_dir):
    """Temporary VCF output file path."""
    return temp_output_dir / "test_output.vcf"


@pytest.fixture
def sample_vcf_record_dict():
    """Sample VCF record as a dictionary (for unit tests).

    This represents a typical parsed VCF record.
    """
    return {
        "CHROM": "NC_001133.9",
        "POSITION": 27784,
        "ID": "delly.DEL.2",
        "REF": "N",
        "ALT": "<DEL>",
        "QUAL": 162.0,
        "FILTER": "PASS",
        "SVTYPE": "DEL",
        "SVLEN": -500,
        "END": 28284,
        "PRIMARY_CALLER": "delly",
        "SUPP_CALLERS": "delly,dysgu",
        "NUM_CALLERS": 2,
    }


@pytest.fixture
def sample_survivor_multi_caller_record():
    """Sample SURVIVOR multi-caller variant (for unit tests).

    This represents a variant with multiple supporting callers.
    """
    return {
        "CHROM": "NC_001133.9",
        "POSITION": 27784,
        "ID": "survivor.DEL.1",
        "REF": "N",
        "ALT": "<DEL>",
        "QUAL": 162.0,
        "FILTER": "PASS",
        "SVTYPE": "DEL",
        "SVLEN": -500,
        "END": 28284,
        "PRIMARY_CALLER": "delly",
        "SUPP_CALLERS": "delly,dysgu",
        "NUM_CALLERS": 2,
        "SUPP_VEC": "01100000000000",  # delly=sample1, dysgu=sample2
    }


@pytest.fixture
def real_vcfpy_reader_bcf(bcf_vcf_path):
    """Real vcfpy.Reader for BCF VCF file.

    Use with context manager:
        with real_vcfpy_reader_bcf as reader:
            for record in reader:
                ...
    """
    import vcfpy

    return vcfpy.Reader.from_path(str(bcf_vcf_path))


@pytest.fixture
def real_vcfpy_reader_survivor(survivor_vcf_path):
    """Real vcfpy.Reader for SURVIVOR VCF file.

    Use with context manager:
        with real_vcfpy_reader_survivor as reader:
            for record in reader:
                ...
    """
    import vcfpy

    return vcfpy.Reader.from_path(str(survivor_vcf_path))


@pytest.fixture(scope="session")
def fixture_minimal_deletion_vcf(test_fixtures_dir):
    """Minimal VCF with a single deletion variant."""
    path = test_fixtures_dir / "minimal_deletion.vcf"
    assert path.exists(), f"Fixture file not found: {path}"
    return path


@pytest.fixture(scope="session")
def fixture_confidence_intervals_vcf(test_fixtures_dir):
    """VCF with confidence interval fields (CIPOS, CIEND)."""
    path = test_fixtures_dir / "confidence_intervals.vcf"
    assert path.exists(), f"Fixture file not found: {path}"
    return path


@pytest.fixture(scope="session")
def fixture_all_writable_fields_vcf(test_fixtures_dir):
    """VCF with all writable INFO field definitions."""
    path = test_fixtures_dir / "all_writable_fields.vcf"
    assert path.exists(), f"Fixture file not found: {path}"
    return path


@pytest.fixture(scope="session")
def fixture_none_values_vcf(test_fixtures_dir):
    """VCF for testing None value handling."""
    path = test_fixtures_dir / "none_values.vcf"
    assert path.exists(), f"Fixture file not found: {path}"
    return path


@pytest.fixture(scope="session")
def fixture_format_fields_vcf(test_fixtures_dir):
    """VCF with FORMAT sample fields (GT, DP, GQ)."""
    path = test_fixtures_dir / "format_fields.vcf"
    assert path.exists(), f"Fixture file not found: {path}"
    return path


@pytest.fixture(scope="session")
def fixture_multi_chrom_vcf(test_fixtures_dir):
    """VCF with multiple chromosomes for testing record order."""
    path = test_fixtures_dir / "multi_chrom.vcf"
    assert path.exists(), f"Fixture file not found: {path}"
    return path


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test (uses real files)"
    )
    config.addinivalue_line("markers", "slow: mark test as slow running")
    config.addinivalue_line("markers", "unit: mark test as unit test (fast, isolated)")
