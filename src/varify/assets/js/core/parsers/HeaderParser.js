/**
 * Header Parser
 *
 * Parses VCF header lines (## and #CHROM) to extract metadata,
 * INFO definitions, FORMAT definitions, and sample names.
 */

export class HeaderParser {
  /**
   * Parse header line (##INFO, ##FORMAT, etc.)
   * @param {string} line - Header line starting with ##
   * @param {Object} headers - Headers object to populate
   */
  static parseHeaderLine(line, headers) {
    if (line.startsWith("##INFO=")) {
      const match = line.match(/ID=([^,]+)/);
      if (match) {
        headers.info[match[1]] = true;
      }
    } else if (line.startsWith("##FORMAT=")) {
      const match = line.match(/ID=([^,]+)/);
      if (match) {
        headers.format[match[1]] = true;
      }
    }
  }

  /**
   * Parse column header line (#CHROM...)
   * @param {string} line - Column header line
   * @returns {Array<string>} Sample names
   */
  static parseColumnHeader(line) {
    return line.split("\t").slice(9);
  }

  /**
   * Initialize header storage structure
   * @returns {Object} Header storage object
   */
  static initializeHeaders() {
    return {
      meta: [],
      columns: "",
      info: {},
      format: {},
      samples: [],
    };
  }
}
