/**
 * VCF Configuration
 *
 * Centralized constants for VCF field handling, validation, and parsing.
 * Consolidates VCF column definitions and field type specifications.
 *
 * References:
 * - VCF 4.2 Specification: https://samtools.github.io/hts-specs/VCFv4.2.pdf
 * - SURVIVOR: https://github.com/fritzsedlazeck/SURVIVOR
 * - bcftools: http://samtools.github.io/bcftools/
 */

// ============================================================================
// VCF COLUMNS
// ============================================================================

/**
 * VCF Fixed Columns (Standard VCF spec columns 1-8)
 */
export const VCF_COLUMNS = {
  CHROM: "CHROM",
  POS: "POS",
  ID: "ID",
  REF: "REF",
  ALT: "ALT",
  QUAL: "QUAL",
  FILTER: "FILTER",
  INFO: "INFO",
  FORMAT: "FORMAT",
};

// ============================================================================
// VCF INFO FIELDS (Detailed Field Definitions)
// ============================================================================

/**
 * SURVIVOR-specific INFO fields
 * Used by SURVIVOR tool for merged variant calling
 */
export const SURVIVOR_INFO_FIELDS = {
  /**
   * Support vector - binary string indicating which callers detected this variant
   * Example: "101" means callers 1 and 3 detected it, but not caller 2
   */
  SUPP_VEC: "SUPP_VEC",

  /**
   * Comma-separated list of supporting caller names
   * Example: "delly,dysgu,manta"
   */
  SUPP_CALLERS: "SUPP_CALLERS",

  /**
   * Number of callers that detected this variant
   */
  NUM_CALLERS: "NUM_CALLERS",

  /**
   * Primary caller selected for display (custom Varify field)
   */
  PRIMARY_CALLER: "PRIMARY_CALLER",

  /**
   * Total number of supporting samples/callers
   */
  SUPP: "SUPP",
};

/**
 * BCF (bcftools merge) specific INFO fields
 */
export const BCF_INFO_FIELDS = {
  /**
   * Caller name from bcftools merge
   * Modern bcftools uses EUK_CALLER
   */
  EUK_CALLER: "EUK_CALLER",

  /**
   * Legacy caller field name
   */
  CALLER: "CALLER",
};

// ============================================================================
// FIELD TYPE SPECIFICATIONS
// ============================================================================

/**
 * Fields that should always be kept as strings (not converted to numbers)
 * Even if they contain numeric characters, these fields have semantic meaning as strings
 */
export const STRING_ONLY_FIELDS = new Set([
  "SUPP_VEC", // Support vector (binary string like "11010")
  "SUPP_CALLERS", // Comma-separated caller names
  "MATEID", // Mate pair ID for breakends
  "EVENT", // Event identifier
]);
