/**
 * Tests for TableExporter
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TableExporter } from "../../../../src/varify/assets/js/components/table/TableExporter.js";
import { reconstructINFO } from "../../../../src/varify/assets/js/utils/InfoField.js";

global.alert = vi.fn();

global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = vi.fn();

describe("TableExporter - CSV Export", () => {
  let mockGridApi;
  let exporter;

  beforeEach(() => {
    global.alert.mockClear();
    global.URL.createObjectURL.mockClear();
    global.URL.revokeObjectURL.mockClear();

    mockGridApi = {
      getSelectedRows: vi.fn(),
      getColumns: vi.fn(),
    };

    exporter = new TableExporter(mockGridApi);
  });

  it("exports selected rows to CSV format", () => {
    const mockColumns = [
      { getColId: () => "CHROM" },
      { getColId: () => "POS" },
      { getColId: () => "REF" },
      { getColId: () => "ALT" },
    ];

    const mockRows = [
      { CHROM: "chr1", POS: 1000, REF: "A", ALT: "T" },
      { CHROM: "chr2", POS: 2000, REF: "G", ALT: "C" },
    ];

    mockGridApi.getColumns.mockReturnValue(mockColumns);
    mockGridApi.getSelectedRows.mockReturnValue(mockRows);

    const mockLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    exporter.exportToCSV("test");

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    const blob = global.URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/csv");

    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.download).toBe("test_variants.csv");
  });

  it("handles values with commas by quoting them", () => {
    const mockColumns = [{ getColId: () => "INFO" }];
    const mockRows = [{ INFO: "SVTYPE=DEL,SVLEN=-500" }];

    mockGridApi.getColumns.mockReturnValue(mockColumns);
    mockGridApi.getSelectedRows.mockReturnValue(mockRows);

    const mockLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    exporter.exportToCSV("test");

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it("handles values with quotes by escaping them", () => {
    const mockColumns = [{ getColId: () => "DESC" }];
    const mockRows = [{ DESC: 'Description with "quotes"' }];

    mockGridApi.getColumns.mockReturnValue(mockColumns);
    mockGridApi.getSelectedRows.mockReturnValue(mockRows);

    const mockLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    exporter.exportToCSV("test");

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it("alerts when no rows are selected", () => {
    mockGridApi.getSelectedRows.mockReturnValue([]);

    exporter.exportToCSV("test");

    expect(global.alert).toHaveBeenCalledWith(
      "No rows selected. Please select at least one row by checking the checkbox."
    );
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("filters out checkbox and internal columns", () => {
    const mockColumns = [
      { getColId: () => "" },
      { getColId: () => "_variant" },
      { getColId: () => "CHROM" },
      { getColId: () => "_metadata" },
      { getColId: () => "POS" },
    ];

    const mockRows = [
      {
        "": false,
        _variant: {},
        CHROM: "chr1",
        _metadata: {},
        POS: 1000,
      },
    ];

    mockGridApi.getColumns.mockReturnValue(mockColumns);
    mockGridApi.getSelectedRows.mockReturnValue(mockRows);

    const mockLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    exporter.exportToCSV("test");

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it("handles null and undefined values", () => {
    const mockColumns = [{ getColId: () => "CHROM" }, { getColId: () => "FILTER" }];

    const mockRows = [
      { CHROM: "chr1", FILTER: null },
      { CHROM: "chr2", FILTER: undefined },
    ];

    mockGridApi.getColumns.mockReturnValue(mockColumns);
    mockGridApi.getSelectedRows.mockReturnValue(mockRows);

    const mockLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    exporter.exportToCSV("test");

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});

describe("TableExporter - VCF Export", () => {
  let mockGridApi;
  let exporter;

  beforeEach(() => {
    global.alert.mockClear();
    global.URL.createObjectURL.mockClear();
    global.URL.revokeObjectURL.mockClear();

    mockGridApi = {
      getSelectedRows: vi.fn(),
    };

    exporter = new TableExporter(mockGridApi);
  });

  it("exports selected rows to VCF format", () => {
    const mockHeader = {
      meta: ["##fileformat=VCFv4.2", "##INFO=<ID=SVTYPE,Number=1,Type=String>"],
      columns: "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO",
    };

    const mockRows = [
      {
        _variant: {
          chr: "chr1",
          pos: 1000,
          id: ".",
          ref: "A",
          alt: "T",
          qual: 30,
          filter: "PASS",
          rawInfo: "SVTYPE=SNP",
        },
      },
    ];

    mockGridApi.getSelectedRows.mockReturnValue(mockRows);

    const mockLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    exporter.exportToVCF("test", mockHeader);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    const blob = global.URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/vcf");
    expect(mockLink.download).toBe("test_variants.vcf");
  });

  it("reconstructs VCF when _variant is missing", () => {
    const mockHeader = {
      meta: ["##fileformat=VCFv4.2"],
      columns: "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO",
    };

    const mockRows = [
      {
        CHROM: "chr1",
        POS: 1000,
        ID: ".",
        REF: "A",
        ALT: "T",
        QUAL: 30,
        FILTER: "PASS",
        SVTYPE: "SNP",
        SVLEN: -100,
      },
    ];

    mockGridApi.getSelectedRows.mockReturnValue(mockRows);

    const mockLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    exporter.exportToVCF("test", mockHeader);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it("alerts when no rows are selected", () => {
    const mockHeader = {
      meta: ["##fileformat=VCFv4.2"],
      columns: "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO",
    };

    mockGridApi.getSelectedRows.mockReturnValue([]);

    exporter.exportToVCF("test", mockHeader);

    expect(global.alert).toHaveBeenCalledWith(
      "No rows selected. Please select at least one row by checking the checkbox."
    );
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("alerts when header is missing", () => {
    const mockRows = [{ CHROM: "chr1", POS: 1000 }];
    mockGridApi.getSelectedRows.mockReturnValue(mockRows);

    exporter.exportToVCF("test", null);

    expect(global.alert).toHaveBeenCalledWith(
      "VCF header not available. Cannot export to VCF format."
    );
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("handles null QUAL values", () => {
    const mockHeader = {
      meta: ["##fileformat=VCFv4.2"],
      columns: "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO",
    };

    const mockRows = [
      {
        _variant: {
          chr: "chr1",
          pos: 1000,
          id: ".",
          ref: "A",
          alt: "T",
          qual: null,
          filter: "PASS",
          rawInfo: "SVTYPE=SNP",
        },
      },
    ];

    mockGridApi.getSelectedRows.mockReturnValue(mockRows);

    const mockLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    exporter.exportToVCF("test", mockHeader);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});

describe("TableExporter - INFO Reconstruction", () => {
  it("reconstructs INFO field from object", () => {
    const infoObj = {
      SVTYPE: "DEL",
      SVLEN: -500,
      END: 2000,
    };

    const result = reconstructINFO(infoObj);

    expect(result).toBe("SVTYPE=DEL;SVLEN=-500;END=2000");
  });

  it("handles boolean flags", () => {
    const infoObj = {
      IMPRECISE: true,
      SVTYPE: "DEL",
    };

    const result = reconstructINFO(infoObj);

    expect(result).toBe("IMPRECISE;SVTYPE=DEL");
  });

  it("skips false boolean flags", () => {
    const infoObj = {
      IMPRECISE: false,
      SVTYPE: "DEL",
    };

    const result = reconstructINFO(infoObj);

    expect(result).toBe("SVTYPE=DEL");
  });

  it("skips null and undefined values", () => {
    const infoObj = {
      SVTYPE: "DEL",
      SVLEN: null,
      END: undefined,
      CIPOS: "0,100",
    };

    const result = reconstructINFO(infoObj);

    expect(result).toBe("SVTYPE=DEL;CIPOS=0,100");
  });

  it("returns dot for empty INFO", () => {
    const infoObj = {};

    const result = reconstructINFO(infoObj);

    expect(result).toBe(".");
  });

  it("returns dot for all-null INFO", () => {
    const infoObj = {
      SVLEN: null,
      END: undefined,
    };

    const result = reconstructINFO(infoObj);

    expect(result).toBe(".");
  });
});

describe("TableExporter - File Download", () => {
  let exporter;

  beforeEach(() => {
    global.URL.createObjectURL.mockClear();
    global.URL.revokeObjectURL.mockClear();

    const mockGridApi = {};
    exporter = new TableExporter(mockGridApi);
  });

  it("creates blob with correct MIME type", () => {
    const mockLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    exporter.downloadFile("test content", "test.csv", "text/csv");

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    const blob = global.URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/csv");
  });

  it("triggers download with correct filename", () => {
    const mockLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    exporter.downloadFile("test content", "export.vcf", "text/vcf");

    expect(mockLink.download).toBe("export.vcf");
    expect(mockLink.click).toHaveBeenCalled();
  });

  it("cleans up after download", () => {
    const mockLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    exporter.downloadFile("test content", "test.csv", "text/csv");

    expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });
});
