import vcfpy
import pandas as pd
import re
from enum import Enum


class VcfType(Enum):
    BCF = "bcf"
    SURVIVOR = "survivor"


def clean_sample_name(sample):
    # Match the pattern inside square brackets and capture the part before '_sas_' and the algorithm after it
    match = re.match(r"\[([^\]]*?_sas_)([^]]+)\]", sample)
    if match:
        # Remove duplicate algorithm name and add an underscore between the name and the algorithm
        base_name = match.group(1).replace("_sas_", "")  # Remove '_sas_'
        algorithm = match.group(2).split("_")[
            0
        ]  # Take the first part of the algorithm to remove duplication
        new_name = f"[{base_name}_{algorithm}]{sample[match.end():]}"
        return new_name
    return sample


def decode_supp_vec(supp_vec, sample_names):
    if not supp_vec or not sample_names:
        return "", {}, []

    supp_vec = str(supp_vec).strip()
    support = {}
    callers_list = []

    for bit, sample in zip(supp_vec, sample_names):
        match = re.search(r"_([^_\]]+)\]", sample)
        caller = match.group(1) if match else sample
        is_supported = bit == "1"
        support[caller] = support.get(caller, False) or is_supported
        if is_supported:
            callers_list.append(caller)

    return ",".join(sorted(set(callers_list))), support, callers_list


def parse_vcf(file_path, label=VcfType.BCF):
    """Parse a VCF file and extract structural variant information.

    Args:
        file_path (str): Path to the VCF file
        label (VcfType): Type of VCF file (BCF or SURVIVOR)

    Returns:
        tuple: (DataFrame, list, list, list) containing:
            - DataFrame with parsed VCF records
            - List of INFO column names
            - List of FORMAT column names
            - List of cleaned sample names
    """
    reader = vcfpy.Reader.from_path(file_path)

    # Extract all INFO field IDs from header
    info_ids = {
        line.id
        for line in reader.header.lines
        if isinstance(line, vcfpy.header.InfoHeaderLine)
    }

    # Find required fields explicitly
    svtype_field = next(
        (field for field in info_ids if "SVTYPE" in field.upper()), None
    )
    end_field = next((field for field in info_ids if "END" in field.upper()), None)
    caller_field = next(
        (field for field in info_ids if "CALLER" in field.upper()), None
    )

    if not svtype_field:
        raise ValueError("Required field SVTYPE not found in VCF header.")

    # Extract header columns
    info_columns = [
        line.id
        for line in reader.header.lines
        if isinstance(line, vcfpy.header.InfoHeaderLine)
    ]
    sample_columns = [
        line.id
        for line in reader.header.lines
        if isinstance(line, vcfpy.header.FormatHeaderLine)
    ]

    raw_samples = reader.header.samples.names
    cleaned_samples = [clean_sample_name(s) for s in raw_samples]

    # Flag INFO fields
    flag_fields = [
        line.id
        for line in reader.header.lines
        if isinstance(line, vcfpy.header.InfoHeaderLine)
        and line.number == 0
        and line.type == "Flag"
    ]

    records = []
    total_records = 0
    excluded_records = 0
    invalid_svlen_records = 0

    for idx, record in enumerate(reader, start=1):
        total_records += 1
        info = record.INFO

        # Extract core SV information
        svtype = info.get(svtype_field)
        end = info.get(end_field)

        # Extract caller information
        caller = None
        if "SUPP_VEC" in info and label == VcfType.SURVIVOR:
            supp_vec = info.get("SUPP_VEC")
            if isinstance(supp_vec, list):
                supp_vec = supp_vec[0]
            caller, support, caller_list_raw = decode_supp_vec(
                supp_vec, cleaned_samples
            )
        else:
            caller = info.get(caller_field)
            if isinstance(caller, list):
                caller = caller[0]
            support = {}
            caller_list_raw = []

        # Get SV length directly from INFO
        svlen = info.get("SVLEN")
        if svlen is None:
            excluded_records += 1
            continue  # Skip records without SVLEN in INFO

        # Convert SV length to absolute value
        try:
            if isinstance(svlen, list):
                svlen = svlen[0]
            svlen = abs(int(svlen))
        except (ValueError, TypeError):
            invalid_svlen_records += 1
            continue  # Skip records with invalid SVLEN values

        # Handle different confidence interval formats
        cipos = None
        ciend = None

        # Check for direct CIPOS/CIEND in info
        if "CIPOS" in info:
            cipos = info.get("CIPOS")
            if isinstance(cipos, list):
                cipos = [int(cipos[0]), int(cipos[1])]

        if "CIEND" in info:
            ciend = info.get("CIEND")
            if isinstance(ciend, list):
                ciend = [int(ciend[0]), int(ciend[1])]

        # Sniffles format (standard deviation)
        if "CIPOS_STD" in info:
            std = info.get("CIPOS_STD")
            if isinstance(std, list):
                std = std[0]
            try:
                cipos = [
                    int(record.POS - 2 * float(std)),
                    int(record.POS + 2 * float(std)),
                ]  # 95% CI
            except (ValueError, TypeError):
                pass

        if "CIEND_STD" in info:
            std = info.get("CIEND_STD")
            if isinstance(std, list):
                std = std[0]
            try:
                ciend = [
                    int(float(end) - 2 * float(std)),
                    int(float(end) + 2 * float(std)),
                ]  # 95% CI
            except (ValueError, TypeError):
                pass

        # TIDDIT format (direct interval)
        if "CIPOS_REG" in info:
            reg = info.get("CIPOS_REG")
            if isinstance(reg, str):
                try:
                    start, end = map(int, reg.split(","))
                    cipos = [start, end]
                except (ValueError, TypeError):
                    pass
            elif isinstance(reg, list):
                try:
                    cipos = [int(reg[0]), int(reg[1])]
                except (ValueError, TypeError):
                    pass

        if "CIEND_REG" in info:
            reg = info.get("CIEND_REG")
            if isinstance(reg, str):
                try:
                    start, end = map(int, reg.split(","))
                    ciend = [start, end]
                except (ValueError, TypeError):
                    pass
            elif isinstance(reg, list):
                try:
                    ciend = [int(reg[0]), int(reg[1])]
                except (ValueError, TypeError):
                    pass

        # Dysgu format (95% CI size)
        if "CIPOS95" in info:
            size = info.get("CIPOS95")
            if isinstance(size, list):
                size = size[0]
            try:
                half_size = int(size) // 2
                cipos = [record.POS - half_size, record.POS + half_size]
            except (ValueError, TypeError):
                pass

        if "CIEND95" in info:
            size = info.get("CIEND95")
            if isinstance(size, list):
                size = size[0]
            try:
                half_size = int(size) // 2
                ciend = [int(end) - half_size, int(end) + half_size]
            except (ValueError, TypeError):
                pass

        # Base record data
        record_data = {
            "unique_id": idx,
            "CHROM": record.CHROM,
            "POSITION": record.POS,
            "ID": record.ID,
            "REF": record.REF,
            "ALT": ",".join(str(alt) for alt in record.ALT) if record.ALT else None,
            "QUAL": record.QUAL,
            "FILTER": ";".join(record.FILTER) if record.FILTER else None,
            "SVTYPE": svtype,
            "CALLER": caller,
            "END": end,
            "SVLEN": svlen,
            "IMPRECISE": "IMPRECISE" in info and info["IMPRECISE"] is not None,
            "PRECISE": "PRECISE" in info and info["PRECISE"] is not None,
            "CHROM2": info.get("CHR2") if "CHR2" in info else None,
            "MATE_ID": info.get("MATEID") if "MATEID" in info else None,
            "CIPOS": cipos,
            "CIEND": ciend,
            "HOMLEN": info.get("HOMLEN"),
            "HOMSEQ": info.get("HOMSEQ"),
            "caller_list_raw": caller_list_raw,
        }

        # Add specific format fields to record_data
        format_fields = record.FORMAT  # Use the full FORMAT list

        # Initialize lists for each format field
        for field in format_fields:
            field_values = []
            # Get values from each sample
            for sample_idx, sample in enumerate(raw_samples):
                if sample_idx >= len(record.calls):
                    break
                sample_data = record.calls[sample_idx].data
                # Get the value directly from the dictionary using the field name
                value = sample_data.get(field)
                # If the value is a list, take the first element
                if isinstance(value, list):
                    value = value[0] if value else None
                # Convert None, NaN, or "NULL" to '.' and add to values
                if (
                    value is None
                    or (isinstance(value, float) and pd.isna(value))
                    or (isinstance(value, str) and value.upper() == "NULL")
                ):
                    field_values.append(".")
                else:
                    field_values.append(str(value))

            # If all values are '.', just store a single '.'
            if all(v == "." for v in field_values):
                record_data[field] = "."
            else:
                # Join values with semicolons and store in record_data
                record_data[field] = " | ".join(field_values)

        # Set any missing format fields to '.'
        required_format_fields = {"GT", "PR", "SR", "GQ"}
        for field in required_format_fields:
            if field not in format_fields:
                record_data[field] = "-"

        records.append(record_data)

    print("\nSVLEN Statistics:")
    print(f"Total records processed: {total_records}")
    print(f"Records excluded (no SVLEN): {excluded_records}")
    print(f"Records excluded (invalid SVLEN): {invalid_svlen_records}")
    print(f"Records kept: {len(records)}")

    haha = pd.DataFrame(records)
    return haha, info_columns, sample_columns, cleaned_samples


def parse_survivor_stats(file_path):
    return pd.read_csv(file_path, sep="\t", index_col=0)


def parse_bcftools_stats(file_path):
    # Initialize empty containers for each section
    sections = {
        "SN": [],
        "TSTV": [],
        "SiS": [],
        "AF": [],
        "QUAL": [],
        "IDD": [],
        "ST": [],
        "DP": [],
    }

    with open(file_path, "r") as f:
        for line in f:
            # Skip comments
            if line.startswith("#"):
                continue

            # Split into fields
            parts = line.strip().split("\t")
            if len(parts) < 2:
                continue

            # First column defines the section (e.g., SN, TSTV)
            section = parts[0]

            if section in sections:
                # Add row to the corresponding section
                sections[section].append(parts[1:])

    # Convert each section into a DataFrame with appropriate headers
    dataframes = {}

    if sections["SN"]:
        dataframes["SN"] = pd.DataFrame(sections["SN"], columns=["id", "key", "value"])

    if sections["TSTV"]:
        dataframes["TSTV"] = pd.DataFrame(
            sections["TSTV"],
            columns=[
                "id",
                "ts",
                "tv",
                "ts/tv",
                "ts (1st ALT)",
                "tv (1st ALT)",
                "ts/tv (1st ALT)",
            ],
        )

    if sections["SiS"]:
        dataframes["SiS"] = pd.DataFrame(
            sections["SiS"],
            columns=[
                "id",
                "allele count",
                "number of SNPs",
                "number of transitions",
                "number of transversions",
                "number of indels",
                "repeat-consistent",
                "repeat-inconsistent",
                "not applicable",
            ],
        )

    if sections["AF"]:
        dataframes["AF"] = pd.DataFrame(
            sections["AF"],
            columns=[
                "id",
                "allele frequency",
                "number of SNPs",
                "number of transitions",
                "number of transversions",
                "number of indels",
                "repeat-consistent",
                "repeat-inconsistent",
                "not applicable",
            ],
        )

    if sections["QUAL"]:
        dataframes["QUAL"] = pd.DataFrame(
            sections["QUAL"],
            columns=[
                "id",
                "Quality",
                "number of SNPs",
                "number of transitions (1st ALT)",
                "number of transversions (1st ALT)",
                "number of indels",
            ],
        )

    if sections["IDD"]:
        dataframes["IDD"] = pd.DataFrame(
            sections["IDD"],
            columns=[
                "id",
                "length (deletions negative)",
                "number of sites",
                "number of genotypes",
                "mean VAF",
            ],
        )

    if sections["ST"]:
        dataframes["ST"] = pd.DataFrame(sections["ST"], columns=["id", "type", "count"])

    if sections["DP"]:
        dataframes["DP"] = pd.DataFrame(
            sections["DP"],
            columns=[
                "id",
                "bin",
                "number of genotypes",
                "fraction of genotypes (%)",
                "number of sites",
                "fraction of sites (%)",
            ],
        )

    return dataframes
