"""
Aggregator

Computes aggregate fields based on grouped variants:
- SUPP_CALLERS: List of callers supporting each variant
- NUM_CALLERS: Number of supporting callers

This is where cross-record aggregation happens.
"""

import pandas as pd


class Aggregator:
    """Aggregates variant information across records."""

    @staticmethod
    def compute_supp_callers(df: pd.DataFrame) -> pd.DataFrame:
        """Compute SUPP_CALLERS field by aggregating PRIMARY_CALLER across variants.

        Groups variants by (CHROM, POSITION, SVTYPE) and aggregates the
        PRIMARY_CALLER values into a comma-separated list.

        Args:
            df: DataFrame with parsed VCF data

        Returns:
            DataFrame with SUPP_CALLERS column added
        """
        if df is None or df.empty:
            return df

        grouped = df.groupby(["CHROM", "POSITION", "SVTYPE"])

        callers_per_variant = grouped["PRIMARY_CALLER"].agg(
            lambda x: ",".join(sorted(set(str(val) for val in x if val is not None)))
        )

        result = df.merge(
            callers_per_variant.rename("SUPP_CALLERS"),
            on=["CHROM", "POSITION", "SVTYPE"],
            how="left",
        )

        return result

    @staticmethod
    def compute_num_callers(df: pd.DataFrame) -> pd.DataFrame:
        """Compute NUM_CALLERS from SUPP_CALLERS.

        Args:
            df: DataFrame with SUPP_CALLERS column

        Returns:
            DataFrame with NUM_CALLERS column added
        """
        if df is None or df.empty or "SUPP_CALLERS" not in df.columns:
            return df

        df["NUM_CALLERS"] = df["SUPP_CALLERS"].apply(
            lambda x: len(set(str(x).split(","))) if pd.notna(x) and x else 0
        )

        return df

    @staticmethod
    def validate_and_filter(df: pd.DataFrame) -> tuple[pd.DataFrame, int, int]:
        """Validate and filter records, returning counts of excluded/invalid records.

        Args:
            df: DataFrame with parsed VCF data

        Returns:
            Tuple of (filtered_df, excluded_records, invalid_records)
        """
        if df is None or df.empty:
            return df, 0, 0

        initial_count = len(df)
        df = df[df["SVTYPE"].notna()].copy()
        excluded_records = initial_count - len(df)

        invalid_count = len(df)
        df = df[df["SVLEN"].notna()].copy()
        invalid_records = invalid_count - len(df)

        return df, excluded_records, invalid_records

    @staticmethod
    def aggregate(df: pd.DataFrame) -> pd.DataFrame:
        """Run all aggregation steps.

        Args:
            df: DataFrame with parsed VCF data

        Returns:
            DataFrame with all aggregate fields computed
        """
        df = Aggregator.compute_supp_callers(df)
        df = Aggregator.compute_num_callers(df)
        return df

    @staticmethod
    def print_statistics(
        df: pd.DataFrame, total_records: int, excluded_records: int, invalid_records: int
    ) -> None:
        """Print processing statistics.

        Args:
            df: Processed DataFrame
            total_records: Total number of records in VCF
            excluded_records: Number of records excluded (no SVLEN/SVTYPE)
            invalid_records: Number of records with invalid SVLEN
        """
        print("\nProcessing Statistics:")
        print(f"Total records in VCF: {total_records}")
        print(f"Records excluded (missing SVLEN/SVTYPE): {excluded_records}")
        print(f"Records excluded (invalid SVLEN): {invalid_records}")
        print(f"Records kept: {len(df)}")

        if not df.empty and "SUPP_CALLERS" in df.columns:
            multi_caller_count = (
                df["SUPP_CALLERS"]
                .apply(lambda x: len(set(str(x).split(","))) >= 2 if pd.notna(x) else False)
                .sum()
            )
            print(f"Variants supported by ≥2 callers: {multi_caller_count}")
