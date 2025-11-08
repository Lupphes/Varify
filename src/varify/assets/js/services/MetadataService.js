/**
 * MetadataService - Field statistics and metadata analysis
 *
 * Extracts field analysis logic from VCFParser to create a reusable,
 * testable service for analyzing variant field metadata.
 *
 * Responsibilities:
 * - Analyze field values to determine type (numeric, categorical, boolean)
 * - Calculate statistics (min, max, unique values)
 * - Build field metadata from variant collections
 * - Use variant handlers to correctly extract genotype data
 *
 */

import { variantHandlerRegistry } from "../core/variant-handlers/VariantHandlerRegistry.js";
import { VCF_COLUMNS } from "../config/vcf.js";
import { isMissing, parseNumericValue } from "../utils/DataValidation.js";
import { LoggerService } from "../utils/LoggerService.js";

const logger = new LoggerService("MetadataService");

export class MetadataService {
  /**
   * Analyze a single field's values to determine type and statistics
   *
   * @param {string} fieldName - Name of the field
   * @param {Array} values - Array of field values from all variants
   * @returns {Object} Statistics object with type, uniqueValues, min, max, etc.
   */
  analyzeField(fieldName, values) {
    const stats = {
      type: "string",
      uniqueValues: new Set(),
      hasNull: false,
      hasMultiple: false,
      min: null,
      max: null,
    };

    let hasNumeric = false;
    let hasNonNumeric = false;

    const numericValues = [];

    for (const value of values) {
      if (isMissing(value)) {
        stats.hasNull = true;
        continue;
      }

      // Special handling for SUPP_CALLERS: extract individual callers from comma-separated string
      if (fieldName === "SUPP_CALLERS" && typeof value === "string") {
        if (value.includes(",")) {
          stats.hasMultiple = true;
          const callers = value.split(",").map((c) => c.trim());
          callers.forEach((caller) => {
            if (caller) stats.uniqueValues.add(caller);
          });
        } else {
          // Single caller
          stats.uniqueValues.add(value);
        }
        hasNonNumeric = true;
        continue;
      }

      if (typeof value === "string" && value.includes(",")) {
        stats.hasMultiple = true;
        const parts = value.split(",");
        const allPartsNumeric = parts.every((part) => parseNumericValue(part.trim()) !== null);
        if (allPartsNumeric) {
          hasNumeric = true;
        } else {
          hasNonNumeric = true;
        }
      } else {
        const num = parseNumericValue(value);
        if (num !== null) {
          hasNumeric = true;
          numericValues.push(num);
        } else {
          hasNonNumeric = true;
        }
      }

      // For SUPP_CALLERS, we already added individual callers above
      if (fieldName !== "SUPP_CALLERS") {
        stats.uniqueValues.add(value);
      }
    }

    if (hasNumeric && !hasNonNumeric) {
      stats.type = "numeric";
      if (numericValues.length > 0) {
        // Use iterative approach to avoid stack overflow with large arrays
        stats.min = numericValues[0];
        stats.max = numericValues[0];
        for (let i = 1; i < numericValues.length; i++) {
          if (numericValues[i] < stats.min) stats.min = numericValues[i];
          if (numericValues[i] > stats.max) stats.max = numericValues[i];
        }
      }
    } else if (stats.uniqueValues.size <= 2 && !stats.hasMultiple) {
      stats.type = "boolean";
    } else if (stats.uniqueValues.size <= 50 && !stats.hasMultiple) {
      stats.type = "categorical";
    } else {
      stats.type = "string";
    }

    if (stats.hasMultiple && hasNumeric) {
      const allNumbers = [];
      values.forEach((v) => {
        if (v && typeof v === "string" && v.includes(",")) {
          v.split(",").forEach((part) => {
            const num = parseNumericValue(part.trim());
            if (num !== null) allNumbers.push(num);
          });
        }
      });
      if (allNumbers.length > 0) {
        // Use iterative approach to avoid stack overflow with large arrays
        stats.min = allNumbers[0];
        stats.max = allNumbers[0];
        for (let i = 1; i < allNumbers.length; i++) {
          if (allNumbers[i] < stats.min) stats.min = allNumbers[i];
          if (allNumbers[i] > stats.max) stats.max = allNumbers[i];
        }
      }
    }

    return stats;
  }

  /**
   * Build complete field metadata from a collection of variants
   *
   * Uses variant handlers to correctly extract genotype data based on variant type.
   *
   * @param {Array} variants - Array of parsed variant objects
   * @param {Object} header - VCF header information
   * @returns {Object} Field metadata keyed by field name
   */
  buildFieldMetadata(variants, header = {}) {
    if (!variants || variants.length === 0) {
      return {};
    }

    const fieldStats = {};

    const allInfoKeys = new Set();
    const allFormatKeys = new Set();

    for (const variant of variants) {
      if (variant.info) {
        Object.keys(variant.info).forEach((key) => allInfoKeys.add(key));
      }
      if (variant.genotypes) {
        const sampleNames = Object.keys(variant.genotypes);
        if (sampleNames.length > 0) {
          Object.keys(variant.genotypes[sampleNames[0]] || {}).forEach((key) =>
            allFormatKeys.add(key)
          );
        }
      }
    }

    fieldStats[VCF_COLUMNS.CHROM] = this.analyzeField(
      VCF_COLUMNS.CHROM,
      variants.map((v) => v.chr)
    );
    fieldStats[VCF_COLUMNS.POS] = this.analyzeField(
      VCF_COLUMNS.POS,
      variants.map((v) => v.pos)
    );
    fieldStats[VCF_COLUMNS.ID] = this.analyzeField(
      VCF_COLUMNS.ID,
      variants.map((v) => v.id)
    );
    fieldStats[VCF_COLUMNS.REF] = this.analyzeField(
      VCF_COLUMNS.REF,
      variants.map((v) => v.ref)
    );
    fieldStats[VCF_COLUMNS.ALT] = this.analyzeField(
      VCF_COLUMNS.ALT,
      variants.map((v) => v.alt)
    );
    fieldStats[VCF_COLUMNS.QUAL] = this.analyzeField(
      VCF_COLUMNS.QUAL,
      variants.map((v) => v.qual)
    );
    fieldStats[VCF_COLUMNS.FILTER] = this.analyzeField(
      VCF_COLUMNS.FILTER,
      variants.map((v) => v.filter)
    );

    for (const key of allInfoKeys) {
      const values = variants.map((v) => (v.info ? v.info[key] : null));
      fieldStats[key] = this.analyzeField(key, values);
    }

    for (const key of allFormatKeys) {
      const values = this.extractFormatFieldValues(variants, key);
      fieldStats[key] = this.analyzeField(key, values);
    }

    return fieldStats;
  }

  /**
   * Extract FORMAT field values from all variants using handler pattern
   *
   * This replaces the if (isSurvivor) conditional from the original code.
   * Uses handlers to select the correct sample based on variant type.
   *
   * @param {Array} variants - Array of variants
   * @param {string} fieldKey - FORMAT field key (e.g., 'GQ', 'DR', 'SR')
   * @returns {Array} Array of field values (one per variant)
   * @private
   */
  extractFormatFieldValues(variants, fieldKey) {
    const values = [];

    for (const variant of variants) {
      if (!variant.genotypes) {
        values.push(null);
        continue;
      }

      let handler;
      try {
        handler = variantHandlerRegistry.getHandler(variant);
      } catch (error) {
        logger.warn(`Could not get handler for variant: ${error.message}`);
        values.push(null);
        continue;
      }

      const primarySample = handler.selectPrimarySample(variant);

      if (!primarySample) {
        values.push(null);
        continue;
      }

      const value = primarySample[fieldKey];

      if (
        value !== null &&
        value !== undefined &&
        value !== "." &&
        value !== "" &&
        !(typeof value === "string" && value.toUpperCase() === "NAN")
      ) {
        values.push(value);
      } else {
        values.push(null);
      }
    }

    return values;
  }

  /**
   * Get field type (numeric, categorical, boolean, string)
   *
   * Convenience method for checking field type from metadata
   *
   * @param {Object} fieldMetadata - Field metadata object
   * @returns {string} Field type
   */
  getFieldType(fieldMetadata) {
    return fieldMetadata ? fieldMetadata.type : "string";
  }

  /**
   * Check if field is numeric
   *
   * @param {Object} fieldMetadata - Field metadata object
   * @returns {boolean} True if numeric
   */
  isNumericField(fieldMetadata) {
    return this.getFieldType(fieldMetadata) === "numeric";
  }

  /**
   * Check if field is categorical
   *
   * @param {Object} fieldMetadata - Field metadata object
   * @returns {boolean} True if categorical
   */
  isCategoricalField(fieldMetadata) {
    return this.getFieldType(fieldMetadata) === "categorical";
  }

  /**
   * Check if field is boolean
   *
   * @param {Object} fieldMetadata - Field metadata object
   * @returns {boolean} True if boolean
   */
  isBooleanField(fieldMetadata) {
    return this.getFieldType(fieldMetadata) === "boolean";
  }

  /**
   * Get unique values for a categorical/boolean field
   *
   * @param {Object} fieldMetadata - Field metadata object
   * @returns {Array} Array of unique values
   */
  getUniqueValues(fieldMetadata) {
    if (!fieldMetadata || !fieldMetadata.uniqueValues) {
      return [];
    }
    return Array.from(fieldMetadata.uniqueValues);
  }

  /**
   * Get numeric range for a field
   *
   * @param {Object} fieldMetadata - Field metadata object
   * @returns {Object} {min, max} or null if not numeric
   */
  getNumericRange(fieldMetadata) {
    if (!this.isNumericField(fieldMetadata)) {
      return null;
    }
    return {
      min: fieldMetadata.min,
      max: fieldMetadata.max,
    };
  }
}
