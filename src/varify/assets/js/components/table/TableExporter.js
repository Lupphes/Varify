/**
 * Table Exporter
 *
 * Handles exporting AG-Grid data to CSV and VCF formats.
 * Supports selected rows, column filtering, and proper data formatting.
 */

import { reconstructINFO } from "../../utils/InfoField.js";

export class TableExporter {
  constructor(gridApi) {
    this.gridApi = gridApi;
  }

  /**
   * Export selected rows to CSV
   * @param {string} prefix - File prefix (e.g., 'bcf', 'survivor')
   */
  exportToCSV(prefix) {
    const selectedRows = this.gridApi.getSelectedRows();

    if (selectedRows.length === 0) {
      alert("No rows selected. Please select at least one row by checking the checkbox.");
      return;
    }

    const columns = this.gridApi
      .getColumns()
      .filter((col) => col.getColId() !== "" && !col.getColId().startsWith("_"))
      .map((col) => col.getColId());

    const csvRows = [columns.join(",")];

    selectedRows.forEach((row) => {
      const values = columns.map((col) => {
        let value = row[col];
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? "";
      });
      csvRows.push(values.join(","));
    });

    const csvContent = csvRows.join("\n");
    this.downloadFile(csvContent, `${prefix}_variants.csv`, "text/csv");
    console.log(`Exported ${selectedRows.length} variants to CSV`);
  }

  /**
   * Export selected rows to VCF format
   * @param {string} prefix - File prefix (e.g., 'bcf', 'survivor')
   * @param {Object} header - VCF header with meta and columns
   */
  exportToVCF(prefix, header) {
    const selectedRows = this.gridApi.getSelectedRows();

    if (selectedRows.length === 0) {
      alert("No rows selected. Please select at least one row by checking the checkbox.");
      return;
    }

    if (!header) {
      alert("VCF header not available. Cannot export to VCF format.");
      console.error(`Header for ${prefix} is null`);
      return;
    }

    const metaLines = header.meta.join("\n");
    const columnLine = header.columns;

    const dataLines = selectedRows.map((row) => {
      const variant = row._variant;

      if (!variant) {
        console.warn("Original variant not found in row, reconstructing");
        const infoFields = [];
        for (const [key, value] of Object.entries(row)) {
          if (
            !["CHROM", "POS", "ID", "REF", "ALT", "QUAL", "FILTER", "_variant", "locus"].includes(
              key
            ) &&
            !key.startsWith("_")
          ) {
            if (typeof value === "boolean" && value) {
              infoFields.push(key);
            } else if (value !== null && value !== undefined) {
              infoFields.push(`${key}=${value}`);
            }
          }
        }
        const info = infoFields.length > 0 ? infoFields.join(";") : ".";

        return [
          row.CHROM,
          row.POS,
          row.ID,
          row.REF,
          row.ALT,
          row.QUAL ?? ".",
          row.FILTER,
          info,
        ].join("\t");
      }

      const info = variant.rawInfo || this.reconstructINFO(variant.info);

      return [
        variant.chr,
        variant.pos,
        variant.id,
        variant.ref,
        variant.alt,
        variant.qual !== null ? variant.qual : ".",
        variant.filter,
        info,
      ].join("\t");
    });

    const vcfContent = [metaLines, columnLine, ...dataLines].join("\n");
    this.downloadFile(vcfContent, `${prefix}_variants.vcf`, "text/vcf");
    console.log(`Exported ${selectedRows.length} variants to VCF`);
  }

  /**
   * Reconstruct INFO field from parsed object
   * @param {Object} infoObj - Parsed INFO field
   * @returns {string} INFO field string
   * @deprecated Use reconstructINFO from utils/InfoField.js instead
   */
  reconstructINFO(infoObj) {
    return reconstructINFO(infoObj);
  }

  /**
   * Download file helper
   * @param {string} content - File content
   * @param {string} filename - Download filename
   * @param {string} mimeType - MIME type
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
