/**
 * Genotype Parser
 *
 * Parses FORMAT and genotype fields from VCF variant lines.
 * Handles sample-specific genotype data.
 */

import { LoggerService } from "../../utils/LoggerService.js";

const logger = new LoggerService("GenotypeParser");

export class GenotypeParser {
  /**
   * Parse genotype fields for a variant
   * @param {Array<string>} fields - Variant line split by tab
   * @param {Array<string>} samples - Sample names
   * @returns {Object|null} Genotypes object or null
   */
  static parseGenotypes(fields, samples) {
    if (fields.length <= 9 || samples.length === 0) {
      return null;
    }

    const format = fields[8].split(":");
    const genotypes = {};

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const values = fields[9 + i].split(":");
      genotypes[sample] = {};

      format.forEach((key, idx) => {
        let value = values[idx] || ".";

        // Decode URL-encoded values (vcfpy encodes commas in scalar string fields)
        // Example: "DEL%2CDEL" -> "DEL,DEL", "0%2C0" -> "0,0"
        if (typeof value === "string" && value.includes("%")) {
          try {
            value = decodeURIComponent(value);
          } catch (e) {
            logger.warn(`Failed to decode FORMAT value for ${key}: ${value}`);
          }
        }

        genotypes[sample][key] = value;
      });
    }

    return genotypes;
  }

  /**
   * Parse FORMAT field
   * @param {string} formatStr - FORMAT field string (e.g., "GT:GQ:DP:AD")
   * @returns {Array<string>} FORMAT field names
   */
  static parseFORMAT(formatStr) {
    return formatStr.split(":");
  }

  /**
   * Parse single sample genotype
   * @param {string} sampleStr - Sample string (e.g., "0/1:20:30:10,20")
   * @param {Array<string>} format - FORMAT field names
   * @returns {Object} Parsed genotype object
   */
  static parseSampleGenotype(sampleStr, format) {
    const values = sampleStr.split(":");
    const genotype = {};

    format.forEach((key, idx) => {
      let value = values[idx] || ".";

      if (typeof value === "string" && value.includes("%")) {
        try {
          value = decodeURIComponent(value);
        } catch (e) {
          logger.warn(`Failed to decode FORMAT value for ${key}: ${value}`);
        }
      }

      genotype[key] = value;
    });

    return genotype;
  }
}
