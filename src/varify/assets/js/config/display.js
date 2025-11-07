/**
 * Display Configuration
 *
 * Defines column display priorities, widths, and ordering for variant tables.
 * Controls how fields are presented in the UI.
 */

/**
 * Column Priority Order
 * Determines the display order of columns in the variant table.
 * Columns appear left-to-right in this order.
 */
export const COLUMN_PRIORITY_ORDER = [
  // Core VCF columns
  "CHROM",
  "ID",
  "POS",
  "END",
  "SVTYPE",
  "SVLEN",
  "NUM_CALLERS",
  "PRIMARY_CALLER",
  "SUPP_CALLERS",
  "QUAL",
  "REF",
  "ALT",
  "FILTER", 
  "CHR2",

  // Common FORMAT fields
  "GT",
  "GQ",
  "DP",
  "DR",
  "SR",
  "SR_MIN",
  "SR_MAX",
  "PR",
  "AD",
  "VAF",
  "PE",
  "RE",

  // Additional INFO fields
  "STRANDS",
  "CIPOS",
  "CIEND",
  "IMPRECISE",
  "PRECISE",
];

/**
 * Column Width Specifications
 * Define fixed or minimum widths for specific columns.
 */
export const COLUMN_WIDTHS = {
  // VCF fixed columns
  CHROM: 100,
  POS: 120,
  ID: 150,
  REF: 100,
  ALT: 100,
  QUAL: 100,
  FILTER: 100,

  // SV fields
  SVTYPE: 100,
  SVLEN: 120,
  END: 120,
  CHR2: 100,

  // SURVIVOR fields
  NUM_CALLERS: 150,
  SUPP_CALLERS: 150,
  PRIMARY_CALLER: 150,

  // FORMAT fields
  GT: 80,
  GQ: 100,
  DP: 100,
  DR: 100,
  SR: 100,
  SR_MIN: 100,
  SR_MAX: 100,
  PR: 100,
  AD: 100,
  VAF: 100,
  PE: 100,
  RE: 100,
};

/**
 * Default column width for fields not specified in COLUMN_WIDTHS
 */
export const DEFAULT_COLUMN_WIDTH = 120;

/**
 * Column width for fields containing "CALLER" in their name
 */
export const CALLER_COLUMN_WIDTH = 150;

/**
 * FORMAT Field Priority
 * Determines the display order of FORMAT fields in the caller details modal.
 */
export const FORMAT_FIELD_PRIORITY = [
  "GT",
  "GQ",
  "DP",
  "AD",
  "VAF",
  "DR",
  "SR",
  "SR_MIN",
  "SR_MAX",
  "PR",
  "PE",
  "RE",
];

/**
 * BCFtools Stats Section Descriptions
 * Human-readable descriptions for each BCFtools stats section type.
 */
export const BCFTOOLS_SECTION_DESCRIPTIONS = {
  SN: `<strong>Summary Numbers</strong> - Provides a high-level overview of variant counts,
    including total variants, SNPs (single nucleotide polymorphisms), indels (insertions/deletions), and other types.`,
  TSTV: `<strong>Transition/Transversion Ratio</strong> - Displays the ratio of transitions
    (e.g. A↔G, C↔T) to transversions (e.g. A↔C, G↔T) for each chromosome. This is a common metric for assessing variant call quality.`,
  SiS: `<strong>Singleton Site Statistics</strong> - Shows statistics for variants that occur only once in the dataset,
    including breakdowns by variant type and whether they appear in repeat regions.`,
  AF: `<strong>Allele Frequency Bins</strong> - Groups variants by allele frequency,
    and summarizes the types of changes (SNPs, transitions, transversions, indels) for each frequency range.`,
  QUAL: `<strong>Quality Score Distribution</strong> - Summarizes how variant calls are distributed across quality score bins,
    including SNP and indel breakdowns, helping you identify low-confidence variants.`,
  IDD: `<strong>Indel Distribution Details</strong> - Provides detailed information on insertions and deletions,
    including lengths, variant counts, genotype counts, and mean variant allele frequency.`,
  ST: `<strong>Simple Variant Type Counts</strong> - Counts the number of variants by type
    (e.g. SNPs, indels) across the dataset.`,
  DP: `<strong>Depth of Coverage</strong> - Distribution of sequencing read depth across genotypes and variant sites,
    helping assess data completeness and reliability.`,
};
