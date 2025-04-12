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


def calculate_confidence_intervals(info, record):
    """Calculate confidence intervals for variant positions.

    Args:
        info (dict): INFO field dictionary from VCF record
        record (vcfpy.Record): VCF record object

    Returns:
        tuple: (cipos, ciend) containing confidence intervals for start and end positions
    """
    cipos = None
    ciend = None

    # Check for direct CIPOS/CIEND in info
    if "CIPOS" in info:
        cipos = info.get("CIPOS")
        if isinstance(cipos, list) and len(cipos) >= 2:
            cipos = [int(cipos[0]), int(cipos[1])]

    if "CIEND" in info:
        ciend = info.get("CIEND")
        if isinstance(ciend, list) and len(ciend) >= 2:
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
                int(float(info.get("END", 0)) - 2 * float(std)),
                int(float(info.get("END", 0)) + 2 * float(std)),
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
            ciend = [
                int(float(info.get("END", 0)) - half_size),
                int(float(info.get("END", 0)) + half_size),
            ]
        except (ValueError, TypeError):
            pass

    return cipos, ciend


def parse_vcf(file_path, label=VcfType.BCF):
    """Parse a VCF file and extract structural variant information.

    Args:
        file_path (str): Path to the VCF file
        label (VcfType): Type of VCF file (BCF or SURVIVOR)

    Returns:
        tuple: (DataFrame, list) containing:
            - DataFrame with parsed VCF records
            - List of INFO column names
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

    raw_samples = reader.header.samples.names
    cleaned_samples = [clean_sample_name(s) for s in raw_samples]

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
        id_value = None
        callers = None
        primary_caller = None
        caller_list_raw = None

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
        if label == VcfType.BCF:

            # Count unique values in ID field and extract algorithm names
            id_value = record.ID

            # For BCF files, count unique values in ID field
            callers = ", ".join(set([e.split("_")[0] for e in id_value]))
            primary_caller = callers.split(",")[0]
        elif label == VcfType.SURVIVOR:
            primary_caller = record.ID[0].split("_")[0]
            id_value = list(set(re.findall(r"[a-z]+_..._[0-9]+", str(record.calls))))

            # If id_value is empty, reconstruct it from PRIMARY_CALLER, SVTYPE, and SVLEN
            if not id_value:
                id_value = [f"{primary_caller}_{svtype}_{svlen}"]

            callers = ", ".join([e.split("_")[0] for e in id_value])

        # Calculate confidence intervals
        cipos, ciend = calculate_confidence_intervals(info, record)

        # Base record data
        record_data = {
            "unique_id": idx,
            "CHROM": record.CHROM,
            "POSITION": record.POS,
            "ID": ", ".join(id_value),
            "REF": record.REF,
            "ALT": ",".join(str(alt) for alt in record.ALT) if record.ALT else None,
            "QUAL": record.QUAL,
            "FILTER": ";".join(record.FILTER) if record.FILTER else None,
            "SVTYPE": svtype,
            "SUPP_CALLERS": callers,
            "PRIMARY_CALLER": primary_caller,
            "END": end,
            "SVLEN": svlen,
            "IMPRECISE": "IMPRECISE" in info and info["IMPRECISE"] is not None,
            "PRECISE": "PRECISE" in info and info["PRECISE"] is not None,
            "CHROM2": info.get("CHR2") if "CHR2" in info else None,
            "MATE_ID": info.get("MATEID") if "MATEID" in info else None,
            "CIPOS": cipos,
            "CIEND": ciend,
            "HOMLEN": info.get("HOMLEN") if "HOMLEN" in info else None,
            "HOMSEQ": info.get("HOMSEQ") if "HOMSEQ" in info else None,
        }

        # Number of callers in SURVIVOR files
        if label == VcfType.SURVIVOR:
            record_data["SUPP_VEC"] = info.get("SUPP_VEC")
            record_data["STRANDS"] = info.get("STRANDS")
            record_data["SVMETHOD"] = info.get("SVMETHOD")

        # Add specific format fields to record_data
        format_fields = record.FORMAT  # Use the full FORMAT list

        # Initialize lists for each format field
        for field in format_fields:
            if field == "ID":
                continue

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
                elif str(value) != "NaN":
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

    if len(records) > 0:
        return pd.DataFrame(records), info_columns
    else:
        return (
            pd.DataFrame(
                columns=[
                    "unique_id",
                    "CHROM",
                    "POSITION",
                    "ID",
                    "REF",
                    "ALT",
                    "QUAL",
                    "FILTER",
                    "SVTYPE",
                    "CALLER",
                    "END",
                    "SVLEN",
                    "IMPRECISE",
                    "PRECISE",
                    "CHROM2",
                    "MATE_ID",
                    "CIPOS",
                    "CIEND",
                    "HOMLEN",
                    "HOMSEQ",
                    "caller_list_raw",
                ]
            ),
            info_columns,
        )


# TODO: Veryfy parsing and remove if empty, maybe create chart out of this
def parse_survivor_stats(file_path):
    return pd.read_csv(file_path, sep="\t", index_col=0)

# TODO: Veryfy parsing and remove tables on empty
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
        df = pd.DataFrame(sections["SN"], columns=["id", "key", "value"])
        # Convert value column to numeric, replacing non-numeric with 0
        df["value"] = pd.to_numeric(df["value"], errors="coerce").fillna(0)
        # Only keep columns where at least one value is non-zero
        df = df.loc[:, df.any()]
        if not df.empty:
            dataframes["SN"] = df

    if sections["TSTV"]:
        df = pd.DataFrame(
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
        # Convert numeric columns, replacing non-numeric with 0
        numeric_cols = ["ts", "tv", "ts (1st ALT)", "tv (1st ALT)"]
        df[numeric_cols] = (
            df[numeric_cols].apply(pd.to_numeric, errors="coerce").fillna(0)
        )
        # Only keep columns where at least one value is non-zero
        df = df.loc[:, df.any()]
        if not df.empty:
            dataframes["TSTV"] = df

    if sections["SiS"]:
        df = pd.DataFrame(
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
        # Convert numeric columns, replacing non-numeric with 0
        numeric_cols = [
            "number of SNPs",
            "number of transitions",
            "number of transversions",
            "number of indels",
            "repeat-consistent",
            "repeat-inconsistent",
            "not applicable",
        ]
        df[numeric_cols] = (
            df[numeric_cols].apply(pd.to_numeric, errors="coerce").fillna(0)
        )
        # Only keep columns where at least one value is non-zero
        df = df.loc[:, df.any()]
        if not df.empty:
            dataframes["SiS"] = df

    if sections["AF"]:
        df = pd.DataFrame(
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
        # Convert numeric columns, replacing non-numeric with 0
        numeric_cols = [
            "number of SNPs",
            "number of transitions",
            "number of transversions",
            "number of indels",
            "repeat-consistent",
            "repeat-inconsistent",
            "not applicable",
        ]
        df[numeric_cols] = (
            df[numeric_cols].apply(pd.to_numeric, errors="coerce").fillna(0)
        )
        # Only keep columns where at least one value is non-zero
        df = df.loc[:, df.any()]
        if not df.empty:
            dataframes["AF"] = df

    if sections["QUAL"]:
        df = pd.DataFrame(
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
        # Convert numeric columns, replacing non-numeric with 0
        numeric_cols = [
            "number of SNPs",
            "number of transitions (1st ALT)",
            "number of transversions (1st ALT)",
            "number of indels",
        ]
        df[numeric_cols] = (
            df[numeric_cols].apply(pd.to_numeric, errors="coerce").fillna(0)
        )
        # Only keep columns where at least one value is non-zero
        df = df.loc[:, df.any()]
        if not df.empty:
            dataframes["QUAL"] = df

    if sections["IDD"]:
        df = pd.DataFrame(
            sections["IDD"],
            columns=[
                "id",
                "length (deletions negative)",
                "number of sites",
                "number of genotypes",
                "mean VAF",
            ],
        )
        # Convert numeric columns, replacing non-numeric with 0
        numeric_cols = ["number of sites", "number of genotypes", "mean VAF"]
        df[numeric_cols] = (
            df[numeric_cols].apply(pd.to_numeric, errors="coerce").fillna(0)
        )
        # Only keep columns where at least one value is non-zero
        df = df.loc[:, df.any()]
        if not df.empty:
            dataframes["IDD"] = df

    if sections["ST"]:
        df = pd.DataFrame(sections["ST"], columns=["id", "type", "count"])
        # Convert count column to numeric, replacing non-numeric with 0
        df["count"] = pd.to_numeric(df["count"], errors="coerce").fillna(0)
        # Only keep columns where at least one value is non-zero
        df = df.loc[:, df.any()]
        if not df.empty:
            dataframes["ST"] = df

    if sections["DP"]:
        df = pd.DataFrame(
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
        # Convert numeric columns, replacing non-numeric with 0
        numeric_cols = [
            "number of genotypes",
            "fraction of genotypes (%)",
            "number of sites",
            "fraction of sites (%)",
        ]
        df[numeric_cols] = (
            df[numeric_cols].apply(pd.to_numeric, errors="coerce").fillna(0)
        )
        # Only keep columns where at least one value is non-zero
        df = df.loc[:, df.any()]
        if not df.empty:
            dataframes["DP"] = df

    return dataframes
