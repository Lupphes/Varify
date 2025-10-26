"""
VCF Variant Data Extractor

Extracts variant information from VCF files for embedding in HTML reports.
Creates lightweight JSON data for variant tables with IGV navigation.
"""

import json
from typing import List, Dict, Optional
import pysam


def extract_variants_from_vcf(
    vcf_path: str,
    max_variants: int = 10000,
    info_fields: Optional[List[str]] = None,
    format_fields: Optional[List[str]] = None
) -> List[Dict]:
    """
    Extract variant data from VCF file for embedding in HTML.

    Args:
        vcf_path: Path to VCF file (.vcf or .vcf.gz)
        max_variants: Maximum number of variants to extract
        info_fields: INFO fields to include (e.g., ['SVTYPE', 'SVLEN', 'END'])
        format_fields: FORMAT fields to include (e.g., ['GT', 'DP', 'GQ'])

    Returns:
        List of variant dictionaries with chr, pos, ref, alt, etc.
    """
    variants = []

    # Default fields for structural variants
    if info_fields is None:
        info_fields = ['SVTYPE', 'SVLEN', 'END', 'SVMETHOD', 'CHR2', 'SUPP', 'SUPP_VEC']

    if format_fields is None:
        format_fields = ['GT', 'DP', 'GQ']

    try:
        with pysam.VariantFile(vcf_path) as vcf:
            # Get sample names
            samples = list(vcf.header.samples)

            for i, record in enumerate(vcf):
                if i >= max_variants:
                    break

                # Basic variant info
                variant = {
                    'index': i,
                    'chr': record.chrom,
                    'pos': record.pos,
                    'id': record.id or f"var_{i}",
                    'ref': record.ref,
                    'alt': ','.join([str(a) for a in (record.alts or [])]),
                    'qual': round(record.qual, 2) if record.qual is not None else None,
                    'filter': ','.join(record.filter.keys()) if record.filter else 'PASS',
                }

                # Extract requested INFO fields
                info_data = {}
                for field in info_fields:
                    if field in record.info:
                        value = record.info[field]
                        # Convert to JSON-serializable types
                        if isinstance(value, tuple):
                            value = list(value)
                        elif hasattr(value, '__iter__') and not isinstance(value, str):
                            value = list(value)
                        info_data[field] = value

                variant['info'] = info_data

                # Extract FORMAT fields for each sample
                genotypes = {}
                for sample in samples:
                    sample_data = {}
                    for field in format_fields:
                        try:
                            value = record.samples[sample][field]
                            # Convert to JSON-serializable types
                            if isinstance(value, tuple):
                                value = list(value)
                            elif hasattr(value, '__iter__') and not isinstance(value, str):
                                value = list(value)
                            sample_data[field] = value
                        except (KeyError, AttributeError):
                            sample_data[field] = None

                    genotypes[sample] = sample_data

                variant['genotypes'] = genotypes

                # Create locus string for IGV navigation
                # For SVs, use END if available, otherwise +/- 1000bp
                if 'END' in info_data:
                    end = info_data['END']
                    variant['locus'] = f"{record.chrom}:{record.pos}-{end}"
                else:
                    start = max(1, record.pos - 1000)
                    end = record.pos + 1000
                    variant['locus'] = f"{record.chrom}:{start}-{end}"

                variants.append(variant)

        print(f"Extracted {len(variants)} variants from {vcf_path}")

    except Exception as e:
        print(f"Warning: Failed to extract variants from {vcf_path}: {e}")
        return []

    return variants


def variants_to_json(variants: List[Dict]) -> str:
    """
    Convert variant list to JSON string for embedding in HTML.

    Args:
        variants: List of variant dictionaries

    Returns:
        JSON string
    """
    return json.dumps(variants, indent=None, separators=(',', ':'))


def get_vcf_summary(vcf_path: str) -> Dict:
    """
    Get summary statistics from VCF file.

    Args:
        vcf_path: Path to VCF file

    Returns:
        Dictionary with variant counts, sample names, etc.
    """
    summary = {
        'total_variants': 0,
        'samples': [],
        'chromosomes': set(),
        'variant_types': {}
    }

    try:
        with pysam.VariantFile(vcf_path) as vcf:
            summary['samples'] = list(vcf.header.samples)

            for record in vcf:
                summary['total_variants'] += 1
                summary['chromosomes'].add(record.chrom)

                # Count variant types
                if 'SVTYPE' in record.info:
                    svtype = record.info['SVTYPE']
                    summary['variant_types'][svtype] = summary['variant_types'].get(svtype, 0) + 1

        summary['chromosomes'] = sorted(list(summary['chromosomes']))

    except Exception as e:
        print(f"Warning: Failed to get VCF summary from {vcf_path}: {e}")

    return summary
