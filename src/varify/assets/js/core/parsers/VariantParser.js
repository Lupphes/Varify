/**
 * Variant Parser
 *
 * Parses individual VCF variant lines including INFO fields,
 * computed numeric fields, and locus calculation for IGV.
 */

import { GenotypeParser } from "./GenotypeParser.js";
import { STRING_ONLY_FIELDS } from "../../config/vcf.js";
import { parseNumericValue } from "../../utils/DataValidation.js";

export class VariantParser {
  /**
   * Parse a single variant line
   * @param {string} line - Variant line from VCF
   * @param {Object} headers - Headers object with samples array
   * @returns {Object|null} Parsed variant or null
   */
  static parseVariantLine(line, headers) {
    const fields = line.split("\t");
    if (fields.length < 8) return null;

    const [chrom, pos, id, ref, alt, qual, filter, info] = fields;

    const infoParsed = this.parseINFO(info);

    const locus = this.calculateLocus(chrom, pos, infoParsed.parsed.END);

    const variant = {
      chr: chrom,
      pos: parseInt(pos),
      id: id !== "." ? id : `var_${pos}`,
      ref: ref,
      alt: alt,
      qual: qual !== "." ? parseFloat(qual) : null,
      filter: filter,
      info: infoParsed.parsed,
      rawInfo: infoParsed.raw,
      locus: locus,
    };

    if (fields.length > 9 && headers.samples.length > 0) {
      variant.genotypes = GenotypeParser.parseGenotypes(fields, headers.samples);
    }

    variant._computed = this.computeNumericFields(variant);

    return variant;
  }

  /**
   * Parse INFO field into object
   * Returns both parsed object and raw string for VCF export
   * @param {string} infoStr - INFO field string
   * @returns {Object} { parsed: {}, raw: string }
   */
  static parseINFO(infoStr) {
    const parsed = {};
    if (!infoStr || infoStr === ".") {
      return { parsed: {}, raw: infoStr || "." };
    }

    const pairs = infoStr.split(";");
    for (const pair of pairs) {
      const [key, value] = pair.split("=");
      if (value !== undefined) {
        if (value.includes(",")) {
          parsed[key] = value;
        } else if (STRING_ONLY_FIELDS.has(key)) {
          parsed[key] = value;
        } else {
          const num = parseNumericValue(value);
          parsed[key] = num !== null ? num : value;
        }
      } else {
        parsed[key] = true;
      }
    }

    return {
      parsed: parsed,
      raw: infoStr,
    };
  }

  /**
   * Calculate locus for IGV browser navigation
   * @param {string} chrom - Chromosome
   * @param {string} pos - Position
   * @param {number|undefined} end - END position from INFO
   * @returns {string} Locus string (e.g., "chr1:1000-2000")
   */
  static calculateLocus(chrom, pos, end) {
    if (end) {
      return `${chrom}:${pos}-${end}`;
    } else {
      const start = Math.max(1, parseInt(pos) - 1000);
      const endPos = parseInt(pos) + 1000;
      return `${chrom}:${start}-${endPos}`;
    }
  }

  /**
   * Compute numeric fields for efficient filtering
   * @param {Object} variant - Parsed variant
   * @returns {Object} Computed numeric fields
   */
  static computeNumericFields(variant) {
    const computed = {};

    const genotypes = variant.genotypes;
    const sampleNames = genotypes ? Object.keys(genotypes) : [];
    const sample = sampleNames.length > 0 ? genotypes[sampleNames[0]] : {};

    computed.GQ = this.parseNumeric(sample.GQ);
    computed.DR = this.parseNumeric(sample.DR);
    computed.PR = this.parseNumeric(sample.PR);
    computed.DP = this.parseNumeric(sample.DP);
    computed.AD = this.parseNumeric(sample.AD);
    computed.LO = this.parseNumeric(sample.LO);
    computed.LR = this.parseNumeric(sample.LR);

    computed.QUAL = this.parseNumeric(variant.qual);

    if (variant.info) {
      if (variant.info.SVLEN !== undefined) {
        computed.SVLEN_num = this.parseNumeric(variant.info.SVLEN);
        if (computed.SVLEN_num !== null) {
          computed.abs_SVLEN = Math.abs(computed.SVLEN_num);
        }
      }
    }

    if (sample.SR) {
      const srValues = this.parseNumericArray(sample.SR);
      computed.SR_MIN = srValues.length > 0 ? Math.min(...srValues) : null;
      computed.SR_MAX = srValues.length > 0 ? Math.max(...srValues) : null;
    }

    if (sample.PL) {
      const plValues = this.parseNumericArray(sample.PL);
      computed.PL_MIN = plValues.length > 0 ? Math.min(...plValues) : null;
      computed.PL_MAX = plValues.length > 0 ? Math.max(...plValues) : null;
    }

    return computed;
  }

  /**
   * Parse a value as numeric, return null for missing data
   * @param {any} value
   * @returns {number|null}
   */
  static parseNumeric(value) {
    if (value === null || value === undefined || value === "" || value === ".") {
      return null;
    }

    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse comma-separated numeric array, excluding missing data
   * @param {string} value - e.g., ".,0" or "19,10"
   * @returns {Array<number>}
   */
  static parseNumericArray(value) {
    if (!value || typeof value !== "string") {
      return [];
    }

    const parts = value.split(",");
    const numbers = [];

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed !== "." && trimmed !== "") {
        const num = parseFloat(trimmed);
        if (!isNaN(num)) {
          numbers.push(num);
        }
      }
    }

    return numbers;
  }
}
