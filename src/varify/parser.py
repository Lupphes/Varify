import vcfpy
import pandas as pd
import re


def clean_sample_name(sample):
    match = re.match(r"\[([^\]]*?_sas_)([^\]]+)\](.*?)_sas", sample)
    if match:
        new_name = f"[{match.group(2)}]{match.group(3)}"
        return new_name
    return sample


def get_caller_stats(df):
    # Filter out rows where CALLER is None or missing
    caller_stats = df["CALLER"].value_counts().reset_index()
    caller_stats.columns = ["CALLER", "Count"]

    # Get the number of unique SV types per caller
    unique_sv_types = df.groupby("CALLER")["SVTYPE"].nunique().reset_index()
    unique_sv_types.columns = ["CALLER", "Unique_SV_Types"]

    # Merge both counts into one DataFrame
    stats = caller_stats.merge(unique_sv_types, on="CALLER")

    return stats


def parse_vcf(file_path):
    reader = vcfpy.Reader.from_path(file_path)

    # Extract INFO and FORMAT fields from header correctly
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

    # Clean sample names by extracting metadata and base sample name
    samples = [(sample) for sample in reader.header.samples.names]

    records = []
    for record in reader:
        info = record.INFO
        svtype = info.get("SVTYPE", [None])[0]
        caller = info.get("CALLER", [None])[0]
        end = info.get("END")
        if isinstance(end, list):
            end = end[0]
        qual = record.QUAL

        # Store the basic fields
        record_data = {
            "CHROM": record.CHROM,
            "POS": record.POS,
            "ID": record.ID,
            "REF": record.REF,
            "ALT": ",".join(str(alt) for alt in record.ALT) if record.ALT else None,
            "QUAL": qual,
            "FILTER": ";".join(record.FILTER) if record.FILTER else None,
            "SVTYPE": svtype,
            "CALLER": caller,
            "END": end,
        }

        # Add INFO fields dynamically
        for key in info_columns:
            value = info.get(key, None)
            if isinstance(value, list):
                value = ",".join(map(str, value))
            record_data[key] = value

        # Add sample fields dynamically
        for raw_sample in reader.header.samples.names:
            cleaned_sample = clean_sample_name(raw_sample)
            if raw_sample in record.calls:
                call = record.calls[raw_sample]
                for key in sample_columns:
                    value = call.data.get(key, None)
                    record_data[f"{cleaned_sample}_{key}"] = value

        records.append(record_data)

    df = pd.DataFrame(records)

    return df, info_columns, sample_columns, samples


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
