"""
Test doubles (fakes, stubs, spies) for Varify tests.

Usage:
    from tests.doubles import FakeVcfReader, StubVariantCaller

    reader = FakeVcfReader(records=[...])
    caller = StubVariantCaller(caller_name="test_caller")
"""

from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from pathlib import Path


class FakeVcfReader:
    """Fake VCF reader for testing without file I/O.

    This replaces vcfpy.Reader in tests where you want to control
    the exact records returned without reading a real file.

    Example:
        records = [FakeVcfRecord(...), FakeVcfRecord(...)]
        reader = FakeVcfReader(records)

        for record in reader:
            process(record)
    """

    def __init__(self, records: Optional[List] = None, header: Optional[Dict] = None):
        """Initialize fake reader.

        Args:
            records: List of records to yield
            header: Fake header information
        """
        self.records = records or []
        self.header = header or self._default_header()
        self._closed = False
        self._index = 0

    def _default_header(self) -> Dict:
        """Return default header structure."""
        return {
            "version": "VCFv4.2",
            "samples": ["sample1", "sample2"],
            "contigs": ["NC_001133.9", "NC_001134.8"],
        }

    def __iter__(self):
        self._index = 0
        return self

    def __next__(self):
        if self._index >= len(self.records):
            raise StopIteration
        record = self.records[self._index]
        self._index += 1
        return record

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False

    def close(self):
        self._closed = True

    @property
    def is_closed(self):
        return self._closed


class FakeVcfRecord:
    """Fake VCF record for testing.

    Mimics vcfpy.Record structure with minimal required fields.

    Example:
        record = FakeVcfRecord(
            chrom="NC_001133.9",
            pos=27784,
            svtype="DEL",
            svlen=-500,
            info={"END": 28284}
        )
    """

    def __init__(
        self,
        chrom: str = "NC_001133.9",
        pos: int = 1000,
        id_: Optional[str] = None,
        ref: str = "N",
        alt: Optional[List[str]] = None,
        qual: Optional[float] = None,
        filter_: Optional[List[str]] = None,
        info: Optional[Dict] = None,
        format_: Optional[List[str]] = None,
        calls: Optional[List] = None,
    ):
        """Initialize fake record.

        Args:
            chrom: Chromosome name
            pos: Position (1-indexed)
            id_: Variant ID
            ref: Reference allele
            alt: List of alternate alleles
            qual: Quality score
            filter_: List of filters
            info: INFO field dictionary
            format_: FORMAT field list
            calls: List of sample calls
        """
        self.CHROM = chrom
        self.POS = pos
        self.ID = [id_] if id_ is not None else []
        self.REF = ref
        self.ALT = alt or ["<DEL>"]
        self.QUAL = qual
        self.FILTER = filter_ or []
        self.INFO = info or {}
        self.FORMAT = format_ or []
        self.calls = calls or []

    def __repr__(self):
        return f"FakeVcfRecord({self.CHROM}:{self.POS} {self.INFO.get('SVTYPE', 'UNK')})"


class StubVariantCaller:
    """Stub variant caller for testing caller-specific logic.

    This replaces real caller implementations (e.g., DellyVariantCaller)
    in tests where you want to control the exact behavior.

    Example:
        caller = StubVariantCaller(
            caller_name="delly",
            parse_info_return={"QUALITY": 100}
        )

        result = caller.parse_info_fields({"SOME_FIELD": "value"})
        assert result == {"QUALITY": 100}
    """

    def __init__(
        self,
        caller_name: str = "test_caller",
        parse_info_return: Optional[Dict] = None,
        cipos: Tuple[int, int] = (0, 0),
        ciend: Tuple[int, int] = (0, 0),
        primary_caller: Optional[str] = None,
        normalize_svlen_return: Optional[int] = None,
    ):
        """Initialize stub caller.

        Args:
            caller_name: Name of the caller
            parse_info_return: Dict to return from parse_info_fields()
            cipos: Confidence interval for POS
            ciend: Confidence interval for END
            primary_caller: Primary caller name to return
            normalize_svlen_return: Normalized SVLEN value
        """
        self.caller_name = caller_name
        self._parse_info_return = parse_info_return or {}
        self._cipos = cipos
        self._ciend = ciend
        self._primary_caller = primary_caller
        self._normalize_svlen_return = normalize_svlen_return

        self.parse_info_fields_calls = []
        self.calculate_confidence_intervals_calls = []
        self.normalize_svlen_calls = []
        self.extract_primary_caller_calls = []

    def parse_info_fields(self, info: Dict[str, Any]) -> Dict[str, Any]:
        self.parse_info_fields_calls.append(info)
        return self._parse_info_return.copy()

    def calculate_confidence_intervals(
        self, info: Dict[str, Any], record: Any
    ) -> Tuple[Tuple[int, int], Tuple[int, int]]:
        self.calculate_confidence_intervals_calls.append((info, record))
        return self._cipos, self._ciend

    def normalize_svlen(self, svlen: Any) -> Optional[int]:
        self.normalize_svlen_calls.append(svlen)
        return self._normalize_svlen_return

    def extract_primary_caller(
        self, info: Dict[str, Any], variant_id: Optional[str]
    ) -> Optional[str]:
        self.extract_primary_caller_calls.append((info, variant_id))
        return self._primary_caller or self.caller_name

    def was_called(self, method_name: str) -> bool:
        calls_attr = f"{method_name}_calls"
        return len(getattr(self, calls_attr, [])) > 0

    def call_count(self, method_name: str) -> int:
        calls_attr = f"{method_name}_calls"
        return len(getattr(self, calls_attr, []))


class FakeDataFrame:
    """Fake DataFrame for testing without pandas.

    Minimal implementation for testing code that expects a DataFrame.
    For real tests, prefer using real DataFrames with real data.
    """

    def __init__(self, data: Optional[List[Dict]] = None, columns: Optional[List[str]] = None):
        """Initialize fake DataFrame.

        Args:
            data: List of row dictionaries
            columns: Column names
        """
        self.data = data or []
        self.columns = columns or []
        if self.data and not self.columns:
            self.columns = list(self.data[0].keys())

    def __len__(self):
        return len(self.data)

    def __getitem__(self, key):
        if isinstance(key, str):
            return [row.get(key) for row in self.data]
        elif isinstance(key, int):
            return self.data[key]
        return None

    @property
    def empty(self):
        return len(self.data) == 0

    def copy(self):
        return FakeDataFrame(data=self.data.copy(), columns=self.columns.copy())


class InMemoryFileSystem:
    """In-memory file system for testing file operations.

    Example:
        fs = InMemoryFileSystem()
        fs.write_file("/path/to/file.txt", "content")
        content = fs.read_file("/path/to/file.txt")
        assert content == "content"
    """

    def __init__(self):
        """Initialize in-memory file system."""
        self._files: Dict[str, bytes] = {}
        self._directories: set = set()

    def write_file(self, path: str, content: str | bytes):
        if isinstance(content, str):
            content = content.encode("utf-8")
        self._files[str(path)] = content
        parent = str(Path(path).parent)
        if parent != ".":
            self._directories.add(parent)

    def read_file(self, path: str) -> bytes:
        if str(path) not in self._files:
            raise FileNotFoundError(f"File not found: {path}")
        return self._files[str(path)]

    def exists(self, path: str) -> bool:
        return str(path) in self._files or str(path) in self._directories

    def delete(self, path: str):
        if str(path) in self._files:
            del self._files[str(path)]

    def list_files(self) -> List[str]:
        return list(self._files.keys())


class StubStatsParser:
    """Stub stats parser for testing stats processing.

    Example:
        parser = StubStatsParser(return_value={"total_variants": 100})
        stats = parser.parse("/path/to/stats.txt")
        assert stats["total_variants"] == 100
    """

    def __init__(self, return_value: Optional[Dict] = None):
        """Initialize stub parser.

        Args:
            return_value: Dict to return from parse()
        """
        self._return_value = return_value or {}
        self.parse_calls = []

    def parse(self, stats_path: str) -> Dict[str, Any]:
        self.parse_calls.append(stats_path)
        return self._return_value.copy()

    def was_called(self) -> bool:
        return len(self.parse_calls) > 0


class SpyProcessor:
    """Spy processor that tracks method calls while delegating to real implementation.

    Example:
        real_processor = RealProcessor()
        spy = SpyProcessor(real_processor)

        result = spy.process(data)
        assert spy.was_called("process")
        assert spy.call_count("process") == 1
    """

    def __init__(self, real_processor):
        """Initialize spy processor.

        Args:
            real_processor: Real processor to delegate to
        """
        self._real = real_processor
        self._calls: Dict[str, List] = {}

    def __getattr__(self, name):
        real_attr = getattr(self._real, name)

        if callable(real_attr):

            def wrapper(*args, **kwargs):
                if name not in self._calls:
                    self._calls[name] = []
                self._calls[name].append((args, kwargs))
                return real_attr(*args, **kwargs)

            return wrapper
        return real_attr

    def was_called(self, method_name: str) -> bool:
        return method_name in self._calls and len(self._calls[method_name]) > 0

    def call_count(self, method_name: str) -> int:
        return len(self._calls.get(method_name, []))

    def get_call_args(self, method_name: str, call_index: int = 0) -> Tuple:
        if method_name not in self._calls or call_index >= len(self._calls[method_name]):
            return ()
        return self._calls[method_name][call_index][0]


def create_fake_vcf_records(count: int = 10, svtype: str = "DEL") -> List[FakeVcfRecord]:
    """Create a list of fake VCF records for testing.

    Args:
        count: Number of records to create
        svtype: SV type for all records

    Returns:
        List of FakeVcfRecord objects
    """
    records = []
    for i in range(count):
        record = FakeVcfRecord(
            chrom="NC_001133.9",
            pos=1000 + (i * 1000),
            id_=f"{svtype}.{i}",
            info={
                "SVTYPE": svtype,
                "SVLEN": -500 - (i * 10),
                "END": 1500 + (i * 1000),
            },
        )
        records.append(record)
    return records


def create_sample_dataframe(num_rows: int = 10) -> pd.DataFrame:
    """Create a sample DataFrame with typical variant data.

    Args:
        num_rows: Number of rows to create

    Returns:
        Real pandas DataFrame with sample variant data
    """
    data = []
    for i in range(num_rows):
        row = {
            "CHROM": f"NC_{i % 3:06d}.9",
            "POSITION": 1000 + (i * 1000),
            "ID": f"variant.{i}",
            "REF": "N",
            "ALT": "<DEL>",
            "QUAL": 100.0 + i,
            "FILTER": "PASS",
            "SVTYPE": ["DEL", "DUP", "INV"][i % 3],
            "SVLEN": -500 - (i * 10),
            "END": 1500 + (i * 1000),
            "PRIMARY_CALLER": ["delly", "dysgu", "cutesv"][i % 3],
        }
        data.append(row)

    return pd.DataFrame(data)
