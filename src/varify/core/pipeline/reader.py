"""
VCF Reader

Responsible for reading VCF files and extracting raw records.
Single responsibility: Read and parse VCF format.
"""

from typing import Iterator, List, Tuple
import vcfpy


class VcfReader:
    """Reads VCF files and yields records with header information."""

    def __init__(self, file_path: str):
        """Initialize VCF reader.

        Args:
            file_path: Path to VCF file
        """
        self.file_path = file_path
        self._reader = vcfpy.Reader.from_path(file_path)

    @property
    def header(self) -> vcfpy.Header:
        """Get VCF header."""
        return self._reader.header

    @property
    def samples(self) -> List[str]:
        """Get sample names from VCF header."""
        return self._reader.header.samples.names

    def get_info_columns(self) -> List[str]:
        """Get list of INFO field IDs from header.

        Returns:
            List of INFO field names
        """
        return [
            line.id
            for line in self._reader.header.lines
            if isinstance(line, vcfpy.header.InfoHeaderLine)
        ]

    def read_records(self) -> Iterator[Tuple[int, vcfpy.Record]]:
        """Read VCF records as iterator.

        Yields:
            Tuple of (index, record) where index is 0-based record number
        """
        for idx, record in enumerate(self._reader):
            yield idx, record

    def close(self) -> None:
        """Close the VCF reader."""
        if self._reader:
            self._reader.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
