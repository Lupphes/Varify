/**
 * Tests for HeaderParser
 */

import { describe, it, expect, beforeEach } from "vitest";
import { HeaderParser } from "../../../../src/varify/assets/js/core/parsers/HeaderParser.js";

describe("HeaderParser - INFO Header Parsing", () => {
  let headers;

  beforeEach(() => {
    headers = { info: {}, format: {} };
  });

  it("parses INFO header line", () => {
    const line = '##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type of structural variant">';

    HeaderParser.parseHeaderLine(line, headers);

    expect(headers.info.SVTYPE).toBe(true);
  });

  it("parses multiple INFO fields", () => {
    const lines = [
      "##INFO=<ID=SVTYPE,Number=1,Type=String>",
      "##INFO=<ID=SVLEN,Number=1,Type=Integer>",
      "##INFO=<ID=END,Number=1,Type=Integer>",
    ];

    lines.forEach((line) => HeaderParser.parseHeaderLine(line, headers));

    expect(headers.info.SVTYPE).toBe(true);
    expect(headers.info.SVLEN).toBe(true);
    expect(headers.info.END).toBe(true);
  });

  it("extracts INFO ID from complex descriptions", () => {
    const line =
      '##INFO=<ID=AF,Number=A,Type=Float,Description="Allele Frequency, for each ALT allele">';

    HeaderParser.parseHeaderLine(line, headers);

    expect(headers.info.AF).toBe(true);
  });

  it("handles INFO with no description", () => {
    const line = "##INFO=<ID=IMPRECISE,Number=0,Type=Flag>";

    HeaderParser.parseHeaderLine(line, headers);

    expect(headers.info.IMPRECISE).toBe(true);
  });

  it("ignores malformed INFO lines", () => {
    const line = "##INFO=<Number=1,Type=String>"; // Missing ID

    HeaderParser.parseHeaderLine(line, headers);

    expect(Object.keys(headers.info)).toHaveLength(0);
  });
});

describe("HeaderParser - FORMAT Header Parsing", () => {
  let headers;

  beforeEach(() => {
    headers = { info: {}, format: {} };
  });

  it("parses FORMAT header line", () => {
    const line = '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">';

    HeaderParser.parseHeaderLine(line, headers);

    expect(headers.format.GT).toBe(true);
  });

  it("parses multiple FORMAT fields", () => {
    const lines = [
      "##FORMAT=<ID=GT,Number=1,Type=String>",
      "##FORMAT=<ID=GQ,Number=1,Type=Integer>",
      "##FORMAT=<ID=DP,Number=1,Type=Integer>",
      "##FORMAT=<ID=AD,Number=R,Type=Integer>",
    ];

    lines.forEach((line) => HeaderParser.parseHeaderLine(line, headers));

    expect(headers.format.GT).toBe(true);
    expect(headers.format.GQ).toBe(true);
    expect(headers.format.DP).toBe(true);
    expect(headers.format.AD).toBe(true);
  });

  it("handles FORMAT with variable number", () => {
    const line =
      '##FORMAT=<ID=AD,Number=R,Type=Integer,Description="Allelic depths for REF and ALT alleles">';

    HeaderParser.parseHeaderLine(line, headers);

    expect(headers.format.AD).toBe(true);
  });

  it("ignores malformed FORMAT lines", () => {
    const line = "##FORMAT=<Number=1,Type=String>"; // Missing ID

    HeaderParser.parseHeaderLine(line, headers);

    expect(Object.keys(headers.format)).toHaveLength(0);
  });
});

describe("HeaderParser - Non-INFO/FORMAT Headers", () => {
  let headers;

  beforeEach(() => {
    headers = { info: {}, format: {} };
  });

  it("ignores fileformat line", () => {
    const line = "##fileformat=VCFv4.2";

    HeaderParser.parseHeaderLine(line, headers);

    expect(Object.keys(headers.info)).toHaveLength(0);
    expect(Object.keys(headers.format)).toHaveLength(0);
  });

  it("ignores contig line", () => {
    const line = "##contig=<ID=chr1,length=248956422>";

    HeaderParser.parseHeaderLine(line, headers);

    expect(Object.keys(headers.info)).toHaveLength(0);
    expect(Object.keys(headers.format)).toHaveLength(0);
  });

  it("ignores reference line", () => {
    const line = "##reference=file:///path/to/reference.fasta";

    HeaderParser.parseHeaderLine(line, headers);

    expect(Object.keys(headers.info)).toHaveLength(0);
    expect(Object.keys(headers.format)).toHaveLength(0);
  });

  it("ignores ALT line", () => {
    const line = '##ALT=<ID=DEL,Description="Deletion">';

    HeaderParser.parseHeaderLine(line, headers);

    expect(Object.keys(headers.info)).toHaveLength(0);
    expect(Object.keys(headers.format)).toHaveLength(0);
  });
});

describe("HeaderParser - Column Header Parsing", () => {
  it("parses column header with no samples", () => {
    const line = "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO";

    const samples = HeaderParser.parseColumnHeader(line);

    expect(samples).toEqual([]);
  });

  it("parses column header with one sample", () => {
    const line = "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSample1";

    const samples = HeaderParser.parseColumnHeader(line);

    expect(samples).toEqual(["Sample1"]);
  });

  it("parses column header with multiple samples", () => {
    const line = "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSample1\tSample2\tSample3";

    const samples = HeaderParser.parseColumnHeader(line);

    expect(samples).toEqual(["Sample1", "Sample2", "Sample3"]);
  });

  it("handles sample names with spaces", () => {
    const line = "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSample 1\tSample 2";

    const samples = HeaderParser.parseColumnHeader(line);

    expect(samples).toEqual(["Sample 1", "Sample 2"]);
  });

  it("handles sample names with special characters", () => {
    const line =
      "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSample-1\tSample_2\tSample.3";

    const samples = HeaderParser.parseColumnHeader(line);

    expect(samples).toEqual(["Sample-1", "Sample_2", "Sample.3"]);
  });
});

describe("HeaderParser - Header Initialization", () => {
  it("initializes empty header structure", () => {
    const headers = HeaderParser.initializeHeaders();

    expect(headers).toEqual({
      meta: [],
      columns: "",
      info: {},
      format: {},
      samples: [],
    });
  });

  it("initializes with correct types", () => {
    const headers = HeaderParser.initializeHeaders();

    expect(Array.isArray(headers.meta)).toBe(true);
    expect(typeof headers.columns).toBe("string");
    expect(typeof headers.info).toBe("object");
    expect(typeof headers.format).toBe("object");
    expect(Array.isArray(headers.samples)).toBe(true);
  });

  it("creates independent header objects", () => {
    const headers1 = HeaderParser.initializeHeaders();
    const headers2 = HeaderParser.initializeHeaders();

    headers1.info.SVTYPE = true;

    expect(headers2.info.SVTYPE).toBeUndefined();
  });
});

describe("HeaderParser - Integration Tests", () => {
  it("parses complete VCF header", () => {
    const headerLines = [
      "##fileformat=VCFv4.2",
      "##contig=<ID=chr1,length=248956422>",
      "##INFO=<ID=SVTYPE,Number=1,Type=String>",
      "##INFO=<ID=SVLEN,Number=1,Type=Integer>",
      "##INFO=<ID=END,Number=1,Type=Integer>",
      "##FORMAT=<ID=GT,Number=1,Type=String>",
      "##FORMAT=<ID=GQ,Number=1,Type=Integer>",
    ];

    const headers = HeaderParser.initializeHeaders();

    headerLines.forEach((line) => HeaderParser.parseHeaderLine(line, headers));

    expect(headers.info.SVTYPE).toBe(true);
    expect(headers.info.SVLEN).toBe(true);
    expect(headers.info.END).toBe(true);
    expect(headers.format.GT).toBe(true);
    expect(headers.format.GQ).toBe(true);
  });

  it("parses header with samples", () => {
    const headerLines = [
      "##INFO=<ID=SVTYPE,Number=1,Type=String>",
      "##FORMAT=<ID=GT,Number=1,Type=String>",
    ];
    const columnLine = "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSample1\tSample2";

    const headers = HeaderParser.initializeHeaders();

    headerLines.forEach((line) => HeaderParser.parseHeaderLine(line, headers));
    headers.samples = HeaderParser.parseColumnHeader(columnLine);

    expect(headers.info.SVTYPE).toBe(true);
    expect(headers.format.GT).toBe(true);
    expect(headers.samples).toEqual(["Sample1", "Sample2"]);
  });

  it("handles empty header", () => {
    const headers = HeaderParser.initializeHeaders();

    expect(Object.keys(headers.info)).toHaveLength(0);
    expect(Object.keys(headers.format)).toHaveLength(0);
    expect(headers.samples).toHaveLength(0);
  });

  it("handles duplicate INFO definitions", () => {
    const lines = [
      "##INFO=<ID=SVTYPE,Number=1,Type=String>",
      "##INFO=<ID=SVTYPE,Number=1,Type=String>", // Duplicate
    ];

    const headers = HeaderParser.initializeHeaders();

    lines.forEach((line) => HeaderParser.parseHeaderLine(line, headers));

    expect(headers.info.SVTYPE).toBe(true);
    expect(Object.keys(headers.info)).toHaveLength(1);
  });
});
