import vcfpy
import pandas as pd
import re


def infer_vcf_config(reader):
    """Infers SVTYPE, END, and CALLER fields from the VCF header."""
    info_ids = {
        line.id
        for line in reader.header.lines
        if isinstance(line, vcfpy.header.InfoHeaderLine)
    }

    # Helper function to find field candidates based on keywords
    def find_field(candidates, keywords):
        for keyword in keywords:
            for field in candidates:
                if keyword in field.upper():
                    return field
        return None

    config = {
        "svtype_field": find_field(info_ids, ["SVTYPE"]),
        "end_field": find_field(info_ids, ["END"]),
        "caller_field": find_field(info_ids, ["CALLER", "MERGED", "TOOL", "ALGO"]),
    }

    if not config["svtype_field"] or not config["end_field"]:
        raise ValueError("Required fields SVTYPE or END not found in VCF header.")

    return config


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


def parse_vcf(file_path, label="bcf"):
    reader = vcfpy.Reader.from_path(file_path)
    config = infer_vcf_config(reader)
    if not config:
        raise ValueError(f"No VCF config defined for label '{label}'")

    reader = vcfpy.Reader.from_path(file_path)

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
    for idx, record in enumerate(reader, start=1):
        info = record.INFO

        svtype = info.get(config["svtype_field"])
        if isinstance(svtype, list):
            svtype = svtype[0]

        caller = None
        if "SUPP_VEC" in info and label == "survivor":
            supp_vec = info.get("SUPP_VEC")
            if isinstance(supp_vec, list):
                supp_vec = supp_vec[0]
            caller, support, caller_list_raw = decode_supp_vec(
                supp_vec, cleaned_samples
            )
        else:
            caller = info.get(config["caller_field"])
            if isinstance(caller, list):
                caller = caller[0]
            support = {}
            caller_list_raw = []

        end = info.get(config["end_field"])
        if isinstance(end, list):
            end = end[0]

        svlen = info.get("SVLEN")
        if isinstance(svlen, list):
            svlen = svlen[0]

        if not svlen and end:
            try:
                svlen = int(end) - record.POS
            except ValueError:
                svlen = None

        qual = record.QUAL

        # Base record data
        record_data = {
            "unique_id": idx,
            "CHROM": record.CHROM,
            "POSITION": record.POS,
            "ID": record.ID,
            "REF": record.REF,
            "ALT": ",".join(str(alt) for alt in record.ALT) if record.ALT else None,
            "QUAL": qual,
            "FILTER": ";".join(record.FILTER) if record.FILTER else None,
            "SVTYPE": svtype,
            "CALLER": caller,
            "END": end,
            "SVLEN": svlen,
            "IMPRECISE": "IMPRECISE" in info,
            "PRECISE": "PRECISE" in info,
            "CHROM2": info.get("CHR2"),
            "STRANDS": info.get("STRANDS"),
            "MATE_ID": info.get("MATEID"),
            "EVENT_ID": info.get("EVENT"),
            "caller_list_raw": caller_list_raw,
        }

        # Dynamically add INFO fields (excluding flags handled above)
        for key in info_columns:
            if key in flag_fields:
                continue
            value = info.get(key)
            if isinstance(value, list):
                value = ",".join(map(str, value))
            record_data[key] = value

        # Add boolean flags explicitly
        for flag in flag_fields:
            record_data[flag] = flag in info

        # Per-sample FORMAT data
        for raw_sample, cleaned_sample in zip(raw_samples, cleaned_samples):
            call = record.call_for_sample.get(raw_sample)
            if call:
                for fmt_key in sample_columns:
                    val = call.data.get(fmt_key)
                    record_data[f"{cleaned_sample}_{fmt_key}"] = val
            else:
                for fmt_key in sample_columns:
                    record_data[f"{cleaned_sample}_{fmt_key}"] = None

        # Per-caller support (if SURVIVOR)
        if label == "survivor" and "SUPP_VEC" in info:
            for sample in cleaned_samples:
                record_data[f"supported_by_{sample}"] = support.get(sample, 0)

        records.append(record_data)

    df = pd.DataFrame(records)

    return df, info_columns, sample_columns, cleaned_samples


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
