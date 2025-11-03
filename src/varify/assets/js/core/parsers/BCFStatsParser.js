/**
 * BCFtools Stats Parser
 *
 * Parses bcftools stats output files into structured JavaScript objects.
 * Mirrors the Python logic from stats_parser.py::parse_bcftools_stats()
 */

/**
 * Parse bcftools stats text file
 * @param {string} fileContent - Raw text content of bcftools stats file
 * @returns {Object} Dictionary mapping section names (SN, TSTV, etc.) to arrays of objects
 */
export function parseBCFToolsStats(fileContent) {
  const sections = {
    SN: [],
    TSTV: [],
    SiS: [],
    AF: [],
    QUAL: [],
    IDD: [],
    ST: [],
    DP: [],
  };

  const lines = fileContent.split("\n");

  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") {
      continue;
    }

    const parts = line.split("\t");
    if (parts.length < 2) {
      continue;
    }

    const section = parts[0];

    if (section in sections) {
      sections[section].push(parts.slice(1));
    }
  }

  const dataframes = {};

  if (sections.SN.length > 0) {
    const data = sections.SN.map((row) => ({
      id: row[0],
      key: row[1],
      value: parseFloat(row[2]) || 0,
    }));

    const nonZero = data.filter((row) => row.value !== 0);
    if (nonZero.length > 0) {
      dataframes.SN = nonZero;
    }
  }

  if (sections.TSTV.length > 0) {
    const data = sections.TSTV.map((row) => ({
      id: row[0],
      ts: parseFloat(row[1]) || 0,
      tv: parseFloat(row[2]) || 0,
      "ts/tv": row[3],
      "ts (1st ALT)": parseFloat(row[4]) || 0,
      "tv (1st ALT)": parseFloat(row[5]) || 0,
      "ts/tv (1st ALT)": row[6],
    }));

    const nonZero = data.filter(
      (row) =>
        row.ts !== 0 || row.tv !== 0 || row["ts (1st ALT)"] !== 0 || row["tv (1st ALT)"] !== 0
    );
    if (nonZero.length > 0) {
      dataframes.TSTV = nonZero;
    }
  }

  if (sections.SiS.length > 0) {
    const data = sections.SiS.map((row) => ({
      id: row[0],
      "allele count": row[1],
      "number of SNPs": parseFloat(row[2]) || 0,
      "number of transitions": parseFloat(row[3]) || 0,
      "number of transversions": parseFloat(row[4]) || 0,
      "number of indels": parseFloat(row[5]) || 0,
      "repeat-consistent": parseFloat(row[6]) || 0,
      "repeat-inconsistent": parseFloat(row[7]) || 0,
      "not applicable": parseFloat(row[8]) || 0,
    }));

    const nonZero = data.filter(
      (row) =>
        row["number of SNPs"] !== 0 ||
        row["number of transitions"] !== 0 ||
        row["number of transversions"] !== 0 ||
        row["number of indels"] !== 0
    );
    if (nonZero.length > 0) {
      dataframes.SiS = nonZero;
    }
  }

  if (sections.AF.length > 0) {
    const data = sections.AF.map((row) => ({
      id: row[0],
      "allele frequency": row[1],
      "number of SNPs": parseFloat(row[2]) || 0,
      "number of transitions": parseFloat(row[3]) || 0,
      "number of transversions": parseFloat(row[4]) || 0,
      "number of indels": parseFloat(row[5]) || 0,
      "repeat-consistent": parseFloat(row[6]) || 0,
      "repeat-inconsistent": parseFloat(row[7]) || 0,
      "not applicable": parseFloat(row[8]) || 0,
    }));

    const nonZero = data.filter(
      (row) =>
        row["number of SNPs"] !== 0 ||
        row["number of transitions"] !== 0 ||
        row["number of transversions"] !== 0 ||
        row["number of indels"] !== 0
    );
    if (nonZero.length > 0) {
      dataframes.AF = nonZero;
    }
  }

  if (sections.QUAL.length > 0) {
    const data = sections.QUAL.map((row) => ({
      id: row[0],
      Quality: row[1],
      "number of SNPs": parseFloat(row[2]) || 0,
      "number of transitions (1st ALT)": parseFloat(row[3]) || 0,
      "number of transversions (1st ALT)": parseFloat(row[4]) || 0,
      "number of indels": parseFloat(row[5]) || 0,
    }));

    const nonZero = data.filter(
      (row) =>
        row["number of SNPs"] !== 0 ||
        row["number of transitions (1st ALT)"] !== 0 ||
        row["number of transversions (1st ALT)"] !== 0 ||
        row["number of indels"] !== 0
    );
    if (nonZero.length > 0) {
      dataframes.QUAL = nonZero;
    }
  }

  if (sections.IDD.length > 0) {
    const data = sections.IDD.map((row) => ({
      id: row[0],
      "length (deletions negative)": row[1],
      "number of sites": parseFloat(row[2]) || 0,
      "number of genotypes": parseFloat(row[3]) || 0,
      "mean VAF": parseFloat(row[4]) || 0,
    }));

    const nonZero = data.filter(
      (row) =>
        row["number of sites"] !== 0 || row["number of genotypes"] !== 0 || row["mean VAF"] !== 0
    );
    if (nonZero.length > 0) {
      dataframes.IDD = nonZero;
    }
  }

  if (sections.ST.length > 0) {
    const data = sections.ST.map((row) => ({
      id: row[0],
      type: row[1],
      count: parseFloat(row[2]) || 0,
    }));

    const nonZero = data.filter((row) => row.count !== 0);
    if (nonZero.length > 0) {
      dataframes.ST = nonZero;
    }
  }

  if (sections.DP.length > 0) {
    const data = sections.DP.map((row) => ({
      id: row[0],
      bin: row[1],
      "number of genotypes": parseFloat(row[2]) || 0,
      "fraction of genotypes (%)": parseFloat(row[3]) || 0,
      "number of sites": parseFloat(row[4]) || 0,
      "fraction of sites (%)": parseFloat(row[5]) || 0,
    }));

    const nonZero = data.filter(
      (row) =>
        row["number of genotypes"] !== 0 ||
        row["fraction of genotypes (%)"] !== 0 ||
        row["number of sites"] !== 0 ||
        row["fraction of sites (%)"] !== 0
    );
    if (nonZero.length > 0) {
      dataframes.DP = nonZero;
    }
  }

  return dataframes;
}
