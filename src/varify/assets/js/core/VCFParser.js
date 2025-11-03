/**
 * VCF Parser
 *
 * Main entry point for VCF parsing operations.
 * Coordinates specialized parsing modules for headers and variants.
 */

import { HeaderParser } from "./parsers/HeaderParser.js";
import { VariantParser } from "./parsers/VariantParser.js";
import { LoggerService } from "../utils/LoggerService.js";

const logger = new LoggerService("VCFParser");

class VCFParser {
  constructor() {
    this.variants = [];
    this.header = {
      meta: [], // All ## header lines for VCF export
      columns: "", // #CHROM header line
    };
  }

  /**
   * Parse VCF file from ArrayBuffer
   * @param {ArrayBuffer} arrayBuffer - VCF file data
   * @param {number} maxVariants - Maximum variants to parse (optional)
   * @returns {Promise<Array>} - Array of variant objects
   */
  async parseVCF(arrayBuffer, maxVariants = 10000) {
    const decoder = new TextDecoder("utf-8");
    const text = decoder.decode(arrayBuffer);

    const lines = text.split("\n");
    const variants = [];
    const headers = { info: {}, format: {}, samples: [] };

    this.header = { meta: [], columns: "" };

    for (let i = 0; i < lines.length && variants.length < maxVariants; i++) {
      const line = lines[i].trim();

      if (!line) continue;

      if (line.startsWith("##")) {
        this.header.meta.push(line);
        HeaderParser.parseHeaderLine(line, headers);
      } else if (line.startsWith("#CHROM")) {
        this.header.columns = line;
        headers.samples = HeaderParser.parseColumnHeader(line);
      } else {
        const variant = VariantParser.parseVariantLine(line, headers);
        if (variant) {
          variants.push(variant);
        }
      }
    }

    this.variants = variants;
    return variants;
  }

  /**
   * Parse compressed VCF (.vcf.gz) file
   * Requires pako library for gzip decompression
   * Handles both regular gzip and BGZF (Blocked GNU Zip Format)
   * @param {ArrayBuffer} arrayBuffer - Compressed VCF data
   * @param {number} maxVariants - Maximum variants to parse
   * @returns {Promise<Array>} - Array of variant objects
   */
  async parseCompressedVCF(arrayBuffer, maxVariants = 10000) {
    if (typeof pako === "undefined") {
      throw new Error(
        "Pako library required for compressed VCF files. Include: https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"
      );
    }

    try {
      const uint8Array = new Uint8Array(arrayBuffer);
      const isBGZF = uint8Array[0] === 0x1f && uint8Array[1] === 0x8b;

      let decompressed;

      if (isBGZF) {
        // BGZF: decompress with concatenation support
        try {
          decompressed = pako.inflate(uint8Array);
        } catch (e) {
          logger.debug("pako.inflate failed, trying pako.ungzip for BGZF...");
          decompressed = pako.ungzip(uint8Array);
        }
      } else {
        decompressed = pako.inflate(uint8Array);
      }

      const decompressedBuffer = decompressed.buffer.slice(
        decompressed.byteOffset,
        decompressed.byteOffset + decompressed.byteLength
      );

      return await this.parseVCF(decompressedBuffer, maxVariants);
    } catch (error) {
      logger.error("Error decompressing VCF:", error.message);
      logger.error("Error details:", error);
      throw new Error(`Failed to decompress VCF file: ${error.message}`);
    }
  }
}

export { VCFParser };
