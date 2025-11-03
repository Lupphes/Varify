/**
 * Variant Flattener
 *
 * Converts nested VCF variant structure to flat structure for IndexedDB storage.
 * Uses handler pattern to support different variant types (BCF, SURVIVOR).
 */

import { variantHandlerRegistry } from "../variant-handlers/VariantHandlerRegistry.js";

export class VariantFlattener {
  /**
   * Flatten variant into a single row for IndexedDB storage
   * REFACTORED VERSION - Uses handler pattern instead of if (isSurvivor)
   *
   * @param {Object} variant - Parsed VCF variant object
   * @returns {Object} Flattened variant ready for IndexedDB storage
   */
  static flattenVariantForStorage(variant) {
    const handler = variantHandlerRegistry.getHandler(variant);

    const flattened = {
      _variant: variant,

      CHROM: variant.chr,
      POS: variant.pos,
      ID: variant.id,
      REF: variant.ref,
      ALT: variant.alt,
      QUAL: variant.qual,
      FILTER: variant.filter,

      ...variant.info,
      ...variant._computed,

      locus: variant.locus,
    };

    if (flattened.SUPP_VEC !== undefined) {
      flattened.SUPP_VEC = String(flattened.SUPP_VEC);
    }

    if (variant.genotypes) {
      // Use handler to select primary sample
      const primarySample = handler.selectPrimarySample(variant);

      if (primarySample) {
        for (const [key, value] of Object.entries(primarySample)) {
          if (key === "ID") continue;

          if (typeof value === "string" && value !== "." && value !== "") {
            if (value.includes(",")) {
              const firstValue = value.split(",")[0].trim();
              const num = parseFloat(firstValue);
              flattened[key] = isNaN(num) || firstValue !== String(num) ? firstValue : num;
            } else {
              const num = parseFloat(value);
              flattened[key] = isNaN(num) || value !== String(num) ? value : num;
            }
          } else {
            flattened[key] = value;
          }
        }
      }
    }

    const allCallers = handler.extractAllCallers(variant);

    if (allCallers && allCallers.length > 0) {
      flattened._allCallers = allCallers.map((callerData, index) => {
        const formatted = {
          sampleIndex: index,
          caller: callerData.caller,
        };

        for (const [key, value] of Object.entries(callerData)) {
          if (key === "caller") continue;

          if (typeof value === "string" && value !== "." && value !== "") {
            if (!value.includes(",")) {
              const num = parseFloat(value);
              formatted[key] = isNaN(num) ? value : num;
            } else {
              formatted[key] = value;
            }
          } else {
            formatted[key] = value;
          }
        }

        return formatted;
      });

      const primaryCaller = handler.extractPrimaryCaller(variant);
      if (primaryCaller) {
        flattened._primaryCallerName = primaryCaller;
      }

      if (flattened._primaryCallerName) {
        const primaryIndex = flattened._allCallers.findIndex(
          (c) => c.caller === flattened._primaryCallerName
        );
        if (primaryIndex !== -1) {
          flattened._primaryCallerIndex = primaryIndex;
        }
      }
    }

    return flattened;
  }
}
