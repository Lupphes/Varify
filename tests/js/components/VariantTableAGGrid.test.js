/**
 * Tests for VariantTableAGGrid
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createTestDB,
  cleanupTestDB,
  createMockVariant,
  createSurvivorVariant,
  loadRealVcf,
  getRealVcfFiles,
} from "../setup.js";

import { VariantTableAGGrid } from "../../../src/varify/assets/js/components/VariantTableAGGrid.js";
import { VCFParser } from "../../../src/varify/assets/js/core/VCFParser.js";

/**
 * Create mock field metadata for testing column definitions
 */
function createMockFieldMetadata(fields = {}) {
  const defaultFields = {
    CHROM: {
      type: "categorical",
      count: 100,
      uniqueValues: ["NC_001133.9", "NC_001134.8"],
    },
    POS: { type: "numeric", count: 100, min: 1000, max: 900000 },
    SVTYPE: {
      type: "categorical",
      count: 100,
      uniqueValues: ["DEL", "DUP", "INV"],
    },
    SVLEN: { type: "numeric", count: 100, min: -50000, max: 50000 },
    GQ: { type: "numeric", count: 95, min: 0, max: 99 },
    DR: { type: "numeric", count: 90, min: 0, max: 100 },
    FILTER: {
      type: "categorical",
      count: 100,
      uniqueValues: ["PASS", "LowQual"],
    },
  };
  return { ...defaultFields, ...fields };
}

/**
 * Create mock AG-Grid filter model
 */
function createMockFilterModel(filters = {}) {
  return filters;
}

/**
 * Create mock AG-Grid cell renderer params
 */
function createMockCellParams(value, data = {}, field = "TEST") {
  return {
    value: value,
    data: data,
    colDef: { field: field },
  };
}

describe("VariantTableAGGrid - Column Definition Building", () => {
  let table;
  let mockVcfParser;
  let mockDB;

  beforeEach(async () => {
    mockDB = await createTestDB();
    mockVcfParser = new VCFParser();
    table = new VariantTableAGGrid(mockVcfParser, mockDB);
  });

  afterEach(async () => {
    await cleanupTestDB(mockDB);
  });

  it("builds column definitions with priority ordering", () => {
    const metadata = createMockFieldMetadata();
    table.prefix = "survivor";
    const columnDefs = table.buildColumnDefinitions(metadata);

    expect(columnDefs.length).toBeGreaterThan(2);

    expect(columnDefs[0].checkboxSelection).toBe(true);
    expect(columnDefs[0].width).toBe(50);

    expect(columnDefs[1].field).toBe("_expand");
    expect(columnDefs[1].width).toBe(40);

    const fieldNames = columnDefs.slice(2).map((c) => c.field);

    const chromIndex = fieldNames.indexOf("CHROM");
    const svtypeIndex = fieldNames.indexOf("SVTYPE");
    const posIndex = fieldNames.indexOf("POS");

    if (chromIndex >= 0 && svtypeIndex >= 0) {
      expect(chromIndex).toBeLessThan(svtypeIndex);
    }
    if (chromIndex >= 0 && posIndex >= 0) {
      expect(chromIndex).toBeLessThan(posIndex);
    }
  });

  it("configures numeric filters for numeric fields", () => {
    const metadata = createMockFieldMetadata({
      SVLEN: { type: "numeric", count: 100, min: -50000, max: 50000 },
    });
    const columnDefs = table.buildColumnDefinitions(metadata);

    const svlenCol = columnDefs.find((c) => c.field === "SVLEN");
    expect(svlenCol).toBeDefined();
    expect(svlenCol.filter).toBe("agNumberColumnFilter");
    expect(svlenCol.filterParams).toBeDefined();
    expect(svlenCol.filterParams.filterOptions).toContain("greaterThan");
    expect(svlenCol.filterParams.filterOptions).toContain("lessThan");
    expect(svlenCol.filterParams.filterOptions).toContain("inRange");
  });

  it("configures categorical filters for categorical fields with few values", () => {
    const metadata = createMockFieldMetadata({
      SVTYPE: {
        type: "categorical",
        count: 100,
        uniqueValues: ["DEL", "DUP", "INV"],
      },
    });
    const columnDefs = table.buildColumnDefinitions(metadata);

    const svtypeCol = columnDefs.find((c) => c.field === "SVTYPE");
    expect(svtypeCol).toBeDefined();
    expect(svtypeCol.filter).toBe("categoricalFilter");
    expect(svtypeCol.floatingFilter).toBe(true);
    expect(svtypeCol.floatingFilterComponent).toBe("categoricalFloatingFilter");
    expect(svtypeCol.filterParams.uniqueValues).toEqual(["DEL", "DUP", "INV"]);
  });

  it("configures text filters for categorical fields with many values", () => {
    const manyValues = Array.from({ length: 25 }, (_, i) => `value_${i}`);
    const metadata = createMockFieldMetadata({
      ID: { type: "categorical", count: 100, uniqueValues: manyValues },
    });
    const columnDefs = table.buildColumnDefinitions(metadata);

    const idCol = columnDefs.find((c) => c.field === "ID");
    expect(idCol).toBeDefined();
    expect(idCol.filter).toBe("agTextColumnFilter");
  });

  it("excludes columns with no data", () => {
    const metadata = createMockFieldMetadata({
      EMPTY_FIELD: { type: "numeric", count: 0, min: null, max: null },
      CHROM: { type: "categorical", count: 100, uniqueValues: ["NC_001133.9"] },
    });
    const columnDefs = table.buildColumnDefinitions(metadata);

    const fieldNames = columnDefs.map((c) => c.field);
    expect(fieldNames).not.toContain("EMPTY_FIELD");
    expect(fieldNames).toContain("CHROM");
  });

  it("includes both checkbox and expand columns", () => {
    const metadata = createMockFieldMetadata();
    table.prefix = "survivor";
    const columnDefs = table.buildColumnDefinitions(metadata);

    const checkboxCol = columnDefs[0];
    expect(checkboxCol.checkboxSelection).toBe(true);
    expect(checkboxCol.pinned).toBe("left");
    expect(checkboxCol.lockPosition).toBe(true);
    expect(checkboxCol.filter).toBe(false);
    expect(checkboxCol.sortable).toBe(false);

    const expandCol = columnDefs[1];
    expect(expandCol.field).toBe("_expand");
    expect(expandCol.pinned).toBe("left");
    expect(expandCol.lockPosition).toBe(true);
    expect(expandCol.filter).toBe(false);
    expect(expandCol.sortable).toBe(false);
    expect(expandCol.cellRenderer).toBeDefined();
  });

  it("adds tooltip to categorical columns showing unique values", () => {
    const metadata = createMockFieldMetadata({
      SVTYPE: { type: "categorical", count: 100, uniqueValues: ["DEL", "DUP"] },
    });
    const columnDefs = table.buildColumnDefinitions(metadata);

    const svtypeCol = columnDefs.find((c) => c.field === "SVTYPE");
    expect(svtypeCol.headerTooltip).toContain("DEL");
    expect(svtypeCol.headerTooltip).toContain("DUP");
  });

  it("sets minimum width for categorical columns", () => {
    const metadata = createMockFieldMetadata({
      FILTER: {
        type: "categorical",
        count: 100,
        uniqueValues: ["PASS", "LowQual"],
      },
    });
    const columnDefs = table.buildColumnDefinitions(metadata);

    const filterCol = columnDefs.find((c) => c.field === "FILTER");
    expect(filterCol.minWidth).toBe(150);
    expect(filterCol.width).toBe(100);
  });
});

describe("VariantTableAGGrid - Data Flattening", () => {
  let table;
  let mockVcfParser;
  let mockDB;

  beforeEach(async () => {
    mockDB = await createTestDB();
    mockVcfParser = new VCFParser();
    table = new VariantTableAGGrid(mockVcfParser, mockDB);
  });

  afterEach(async () => {
    await cleanupTestDB(mockDB);
  });

  it("returns variant as-is (data already flattened in IndexedDB)", () => {
    const variant = createMockVariant({
      chr: "NC_001133.9",
      pos: 5000,
      info: {
        SVTYPE: "DEL",
        SVLEN: -1000,
        END: 6000,
      },
    });

    const result = table.flattenVariant(variant);

    expect(result).toBe(variant);
    expect(result.chr).toBe("NC_001133.9");
    expect(result.pos).toBe(5000);
    expect(result.info.SVTYPE).toBe("DEL");
  });

  it("preserves _computed fields in variant structure", () => {
    const variant = createMockVariant({
      _computed: {
        GQ: 40,
        DR: 25,
        SVLEN_num: -1000,
      },
    });

    const result = table.flattenVariant(variant);

    expect(result).toBe(variant);
    expect(result._computed.GQ).toBe(40);
    expect(result._computed.DR).toBe(25);
    expect(result._computed.SVLEN_num).toBe(-1000);
  });

  it("preserves _allCallers array for SURVIVOR variants", () => {
    const variant = createSurvivorVariant({
      info: {
        SUPP_VEC: "1100000000000",
        SUPP_CALLERS: "delly,dysgu",
      },
      _allCallers: [
        { caller: "delly", GQ: 30, DR: 15 },
        { caller: "dysgu", GQ: 40, DR: 20 },
      ],
    });

    const result = table.flattenVariant(variant);

    expect(result).toBe(variant);
    expect(result._allCallers).toBeDefined();
    expect(result._allCallers.length).toBe(2);
    expect(result._allCallers[0].caller).toBe("delly");
    expect(result._allCallers[1].caller).toBe("dysgu");
  });

  it("preserves missing/null values in variant structure", () => {
    const variant = createMockVariant({
      chr: "NC_001133.9",
      pos: 5000,
      info: {
        SVTYPE: "DEL",
        SVLEN: null,
        FILTER: undefined,
      },
      _computed: {
        GQ: null,
      },
    });

    const result = table.flattenVariant(variant);

    expect(result).toBe(variant);
    expect(result.chr).toBe("NC_001133.9");
    expect(result.info.SVTYPE).toBe("DEL");
    expect(result.info.SVLEN).toBeNull();
    expect(result._computed.GQ).toBeNull();
  });

  it("preserves SUPP_VEC as string in info object", () => {
    const variant = createSurvivorVariant({
      info: {
        SUPP_VEC: "01100000000000",
      },
    });

    const result = table.flattenVariant(variant);

    expect(result).toBe(variant);
    expect(result.info.SUPP_VEC).toBe("01100000000000");
    expect(typeof result.info.SUPP_VEC).toBe("string");
  });

  it("preserves chr field in variant", () => {
    const variant = createMockVariant({
      chr: "NC_001133.9",
    });

    const result = table.flattenVariant(variant);

    expect(result).toBe(variant);
    expect(result.chr).toBe("NC_001133.9");
  });

  it("preserves pos field in variant", () => {
    const variant = createMockVariant({
      pos: 123456,
    });

    const result = table.flattenVariant(variant);

    expect(result).toBe(variant);
    expect(result.pos).toBe(123456);
  });

  it("preserves all INFO fields in info object", () => {
    const variant = createMockVariant({
      info: {
        SVTYPE: "DUP",
        SVLEN: 2000,
        END: 5000,
        MATEID: "mate1",
        CIPOS: "-10,10",
        CIEND: "-5,5",
      },
    });

    const result = table.flattenVariant(variant);

    expect(result).toBe(variant);
    expect(result.info.SVTYPE).toBe("DUP");
    expect(result.info.SVLEN).toBe(2000);
    expect(result.info.END).toBe(5000);
    expect(result.info.MATEID).toBe("mate1");
    expect(result.info.CIPOS).toBe("-10,10");
    expect(result.info.CIEND).toBe("-5,5");
  });
});

describe("VariantTableAGGrid - Filter Extraction", () => {
  let table;
  let mockVcfParser;
  let mockDB;

  beforeEach(async () => {
    mockDB = await createTestDB();
    mockVcfParser = new VCFParser();
    table = new VariantTableAGGrid(mockVcfParser, mockDB);
  });

  afterEach(async () => {
    await cleanupTestDB(mockDB);
  });

  it("extracts numeric range filter with min only", () => {
    const filterModel = {
      GQ: {
        filterType: "number",
        type: "greaterThan",
        filter: 30,
      },
    };

    const filters = table.extractFilters(filterModel);

    expect(filters.GQ).toBeDefined();
    expect(filters.GQ.min).toBe(30);
    expect(filters.GQ.max).toBeUndefined();
  });

  it("extracts numeric range filter with max only", () => {
    const filterModel = {
      SVLEN: {
        filterType: "number",
        type: "lessThan",
        filter: -1000,
      },
    };

    const filters = table.extractFilters(filterModel);

    expect(filters.SVLEN).toBeDefined();
    expect(filters.SVLEN.max).toBe(-1000);
    expect(filters.SVLEN.min).toBeUndefined();
  });

  it("extracts numeric range filter with both min and max", () => {
    const filterModel = {
      POS: {
        filterType: "number",
        type: "inRange",
        filter: 1000,
        filterTo: 50000,
      },
    };

    const filters = table.extractFilters(filterModel);

    expect(filters.POS).toBeDefined();
    expect(filters.POS.min).toBe(1000);
    expect(filters.POS.max).toBe(50000);
  });

  it("extracts categorical multi-select filter", () => {
    const filterModel = {
      SVTYPE: {
        filterType: "set",
        values: ["DEL", "DUP"],
      },
    };

    const filters = table.extractFilters(filterModel);

    expect(filters.SVTYPE).toBeDefined();
    expect(filters.SVTYPE.values).toEqual(["DEL", "DUP"]);
  });

  it("extracts text search filter", () => {
    const filterModel = {
      ID: {
        filterType: "text",
        type: "contains",
        filter: "delly",
      },
    };

    const filters = table.extractFilters(filterModel);

    expect(filters.ID).toBeDefined();
    expect(filters.ID).toBe("delly");
  });

  it("extracts multiple filters simultaneously", () => {
    const filterModel = {
      GQ: {
        filterType: "number",
        type: "greaterThan",
        filter: 30,
      },
      SVTYPE: {
        filterType: "set",
        values: ["DEL"],
      },
      CHROM: {
        filterType: "text",
        type: "equals",
        filter: "NC_001133.9",
      },
    };

    const filters = table.extractFilters(filterModel);

    expect(filters.GQ).toBeDefined();
    expect(filters.GQ.min).toBe(30);
    expect(filters.SVTYPE).toBeDefined();
    expect(filters.SVTYPE.values).toEqual(["DEL"]);
    expect(filters.CHROM).toBeDefined();
    expect(filters.CHROM).toBe("NC_001133.9");
  });

  it("returns empty object for empty filter model", () => {
    const filterModel = {};
    const filters = table.extractFilters(filterModel);

    expect(filters).toEqual({});
  });

  it("handles null/undefined filter model", () => {
    const filters1 = table.extractFilters(null);
    const filters2 = table.extractFilters(undefined);

    expect(filters1).toEqual({});
    expect(filters2).toEqual({});
  });

  it("extracts equals filter for numeric fields", () => {
    const filterModel = {
      SVLEN: {
        filterType: "number",
        type: "equals",
        filter: -1000,
      },
    };

    const filters = table.extractFilters(filterModel);

    expect(filters.SVLEN).toBeDefined();
    // Equals should be treated as both min and max with same value
    expect(filters.SVLEN.min).toBe(-1000);
    expect(filters.SVLEN.max).toBe(-1000);
  });

  it("handles custom categorical filter format", () => {
    const filterModel = {
      FILTER: {
        filterType: "categorical",
        selectedValues: ["PASS", "LowQual"],
      },
    };

    const filters = table.extractFilters(filterModel);

    expect(filters.FILTER).toBeDefined();
    expect(filters.FILTER.values).toEqual(["PASS", "LowQual"]);
  });
});

describe("VariantTableAGGrid - Cell Rendering", () => {
  let table;
  let mockVcfParser;
  let mockDB;

  beforeEach(async () => {
    mockDB = await createTestDB();
    mockVcfParser = new VCFParser();
    table = new VariantTableAGGrid(mockVcfParser, mockDB);
  });

  afterEach(async () => {
    await cleanupTestDB(mockDB);
  });

  it("formats missing data as em dash", () => {
    const metadata = { type: "numeric" };

    const params1 = createMockCellParams(null, {}, "GQ");
    const result1 = table.getCellRenderer(params1, metadata);
    expect(result1.textContent).toBe("—");
    expect(result1.style.color).toBe("#9ca3af");
    const params2 = createMockCellParams(undefined, {}, "GQ");
    const result2 = table.getCellRenderer(params2, metadata);
    expect(result2.textContent).toBe("—");

    const params3 = createMockCellParams(".", {}, "GQ");
    const result3 = table.getCellRenderer(params3, metadata);
    expect(result3.textContent).toBe("—");

    const params4 = createMockCellParams("", {}, "GQ");
    const result4 = table.getCellRenderer(params4, metadata);
    expect(result4.textContent).toBe("—");
  });

  it("formats NaN string as em dash (SURVIVOR format)", () => {
    const metadata = { type: "numeric" };

    const params1 = createMockCellParams("NaN", {}, "GQ");
    const result1 = table.getCellRenderer(params1, metadata);
    expect(result1.textContent).toBe("—");

    const params2 = createMockCellParams("nan", {}, "GQ");
    const result2 = table.getCellRenderer(params2, metadata);
    expect(result2.textContent).toBe("—");

    const params3 = createMockCellParams("NAN", {}, "GQ");
    const result3 = table.getCellRenderer(params3, metadata);
    expect(result3.textContent).toBe("—");
  });

  it("renders numeric values as text", () => {
    const metadata = { type: "numeric" };

    const params = createMockCellParams(42, {}, "GQ");
    const result = table.getCellRenderer(params, metadata);
    expect(result.textContent).toBe("42");
  });

  it("renders string values as text", () => {
    const metadata = { type: "categorical" };

    const params = createMockCellParams("DEL", {}, "SVTYPE");
    const result = table.getCellRenderer(params, metadata);
    expect(result.textContent).toBe("DEL");
  });

  it("formats CIPOS/CIEND intervals with brackets", () => {
    const metadata = { type: "string" };

    const params = createMockCellParams("-10,10", {}, "CIPOS");
    const result = table.getCellRenderer(params, metadata);
    expect(result.textContent).toContain("[");
    expect(result.textContent).toContain("-10");
    expect(result.textContent).toContain("10");
    expect(result.textContent).toContain("]");
  });

  it("handles arrays with missing values", () => {
    const metadata = { type: "string" };

    const params = createMockCellParams("10,.,20", {}, "PR");
    const result = table.getCellRenderer(params, metadata);

    expect(result.textContent).toContain("10");
    expect(result.textContent).toContain("20");
    expect(result.textContent).toContain("—");
  });

  it("detects conflicts in multi-caller variants", () => {
    const rowData = {
      _allCallers: [
        { caller: "delly", GQ: 30 },
        { caller: "dysgu", GQ: 40 },
      ],
    };

    const params = createMockCellParams(30, rowData, "GQ");
    const hasConflict = table.checkFieldConflict(params);

    expect(hasConflict).toBe(true);
  });

  it("does not detect conflicts when values match", () => {
    const rowData = {
      _allCallers: [
        { caller: "delly", GQ: 40 },
        { caller: "dysgu", GQ: 40 },
      ],
    };

    const params = createMockCellParams(40, rowData, "GQ");
    const hasConflict = table.checkFieldConflict(params);

    expect(hasConflict).toBe(false);
  });

  it("does not detect conflicts for single-caller variants", () => {
    const rowData = {
      _allCallers: [{ caller: "delly", GQ: 30 }],
    };

    const params = createMockCellParams(30, rowData, "GQ");
    const hasConflict = table.checkFieldConflict(params);

    expect(hasConflict).toBe(false);
  });

  it("does not detect conflicts for BCF variants without _allCallers", () => {
    const rowData = {
      GQ: 30,
    };

    const params = createMockCellParams(30, rowData, "GQ");
    const hasConflict = table.checkFieldConflict(params);

    expect(hasConflict).toBe(false);
  });

  it("adds conflict indicator with tooltip", () => {
    const rowData = {
      _allCallers: [
        { caller: "delly", GQ: 30 },
        { caller: "dysgu", GQ: 40 },
      ],
    };

    const span = document.createElement("span");
    span.textContent = "30";

    const params = createMockCellParams(30, rowData, "GQ");
    table.addConflictIndicator(span, params);

    expect(span.textContent).toContain("⚠️");
    expect(span.children.length).toBeGreaterThan(0);

    const indicator = span.querySelector("span");
    expect(indicator.title).toContain("delly");
    expect(indicator.title).toContain("dysgu");
    expect(indicator.title).toContain("30");
    expect(indicator.title).toContain("40");
  });

  it("renders conflict indicator for CIPOS fields", () => {
    const rowData = {
      _allCallers: [
        { caller: "delly", CIPOS: "-10,10" },
        { caller: "dysgu", CIPOS: "-5,5" },
      ],
    };

    const metadata = { type: "string" };
    const params = createMockCellParams("-10,10", rowData, "CIPOS");
    const result = table.getCellRenderer(params, metadata);

    expect(result.textContent).toContain("⚠️");
  });

  it("handles zero values correctly (not treated as missing)", () => {
    const metadata = { type: "numeric" };

    const params = createMockCellParams(0, {}, "GQ");
    const result = table.getCellRenderer(params, metadata);
    expect(result.textContent).toBe("0");
    expect(result.style.color).not.toBe("#9ca3af");
  });

  it("handles false boolean values correctly (not treated as missing)", () => {
    const metadata = { type: "boolean" };

    const params = createMockCellParams(false, {}, "IMPRECISE");
    const result = table.getCellRenderer(params, metadata);
    expect(result.textContent).toBe("false");
    expect(result.style.color).not.toBe("#9ca3af");
  });
});

describe("VariantTableAGGrid - Multi-Caller Features", () => {
  let table;
  let mockVcfParser;
  let mockDB;

  beforeEach(async () => {
    mockDB = await createTestDB();
    mockVcfParser = new VCFParser();
    table = new VariantTableAGGrid(mockVcfParser, mockDB);
  });

  afterEach(async () => {
    await cleanupTestDB(mockDB);
  });

  it("shows expand button for multi-caller variants", () => {
    const variant = createSurvivorVariant({
      _allCallers: [
        { caller: "delly", GQ: 30 },
        { caller: "dysgu", GQ: 40 },
      ],
    });

    table.prefix = "survivor";
    const columnDefs = table.buildColumnDefinitions(createMockFieldMetadata());
    const expandCol = columnDefs.find((c) => c.field === "_expand");

    expect(expandCol).toBeDefined();
    expect(expandCol.cellRenderer).toBeDefined();

    const params = { data: variant };
    const button = expandCol.cellRenderer(params);

    expect(button).toBeDefined();
    expect(button.innerHTML).toContain("📋");
    expect(button.title).toContain("View all callers");
  });

  it("hides expand button for single-caller variants", () => {
    const variant = createSurvivorVariant({
      _allCallers: [{ caller: "delly", GQ: 30 }],
    });

    table.prefix = "survivor";
    const columnDefs = table.buildColumnDefinitions(createMockFieldMetadata());
    const expandCol = columnDefs.find((c) => c.field === "_expand");

    const params = { data: variant };
    const result = expandCol.cellRenderer(params);

    expect(result).toBe("");
  });

  it("hides expand button for BCF variants without _allCallers", () => {
    const variant = createMockVariant({
      chr: "NC_001133.9",
      pos: 5000,
    });

    table.prefix = "survivor";
    const columnDefs = table.buildColumnDefinitions(createMockFieldMetadata());
    const expandCol = columnDefs.find((c) => c.field === "_expand");

    const params = { data: variant };
    const result = expandCol.cellRenderer(params);

    expect(result).toBe("");
  });

  it("detects conflicts across multiple callers", () => {
    const variant = createSurvivorVariant({
      _allCallers: [
        { caller: "delly", GQ: 30, DR: 15 },
        { caller: "dysgu", GQ: 40, DR: 15 },
        { caller: "manta", GQ: 35, DR: 15 },
      ],
    });

    const params = createMockCellParams(30, variant, "GQ");
    expect(table.checkFieldConflict(params)).toBe(true);

    const params2 = createMockCellParams(15, variant, "DR");
    expect(table.checkFieldConflict(params2)).toBe(false);
  });

  it("builds detail column definitions for caller comparison", () => {
    const metadata = createMockFieldMetadata({
      GT: {
        type: "categorical",
        count: 100,
        uniqueValues: ["0/0", "0/1", "1/1"],
      },
      GQ: { type: "numeric", count: 95, min: 0, max: 99 },
      DR: { type: "numeric", count: 90, min: 0, max: 100 },
    });

    const detailCols = table.buildDetailColumnDefinitions(metadata);

    expect(detailCols[0].field).toBe("caller");
    expect(detailCols[0].headerName).toBe("Caller");
    expect(detailCols[0].pinned).toBe("left");

    const fieldNames = detailCols.map((c) => c.field);
    expect(fieldNames).toContain("GT");
    expect(fieldNames).toContain("GQ");
    expect(fieldNames).toContain("DR");
  });

  it("prioritizes common FORMAT fields in detail columns", () => {
    const metadata = createMockFieldMetadata({
      GT: { type: "categorical", count: 100, uniqueValues: ["0/0", "0/1"] },
      GQ: { type: "numeric", count: 95, min: 0, max: 99 },
      DR: { type: "numeric", count: 90, min: 0, max: 100 },
      RARE_FIELD: { type: "numeric", count: 50, min: 0, max: 10 },
    });

    const detailCols = table.buildDetailColumnDefinitions(metadata);
    const fieldNames = detailCols.map((c) => c.field);

    const gtIndex = fieldNames.indexOf("GT");
    const gqIndex = fieldNames.indexOf("GQ");
    const drIndex = fieldNames.indexOf("DR");

    expect(gtIndex).toBeLessThan(gqIndex);
    expect(gqIndex).toBeLessThan(drIndex);

    expect(fieldNames).not.toContain("RARE_FIELD");
  });

  it("applies numeric column type to numeric FORMAT fields", () => {
    const metadata = createMockFieldMetadata({
      GQ: { type: "numeric", count: 95, min: 0, max: 99 },
    });

    const detailCols = table.buildDetailColumnDefinitions(metadata);
    const gqCol = detailCols.find((c) => c.field === "GQ");

    expect(gqCol).toBeDefined();
    expect(gqCol.type).toBe("numericColumn");
  });

  it("includes only likely FORMAT fields in detail columns", () => {
    const metadata = createMockFieldMetadata({
      GT: { type: "categorical", count: 100, uniqueValues: ["0/0"] },
      CHROM: { type: "categorical", count: 100, uniqueValues: ["NC_001133.9"] },
      SVTYPE: { type: "categorical", count: 100, uniqueValues: ["DEL"] },
    });

    const detailCols = table.buildDetailColumnDefinitions(metadata);
    const fieldNames = detailCols.map((c) => c.field);

    expect(fieldNames).toContain("GT");

    expect(fieldNames).not.toContain("CHROM");
    expect(fieldNames).not.toContain("SVTYPE");
  });

  it("handles variants with different caller counts", () => {
    const twoCallers = createSurvivorVariant({
      _allCallers: [
        { caller: "delly", GQ: 30 },
        { caller: "dysgu", GQ: 40 },
      ],
    });

    const fiveCallers = createSurvivorVariant({
      _allCallers: [
        { caller: "delly", GQ: 30 },
        { caller: "dysgu", GQ: 40 },
        { caller: "manta", GQ: 35 },
        { caller: "lumpy", GQ: 38 },
        { caller: "gridss", GQ: 42 },
      ],
    });

    expect(twoCallers._allCallers.length).toBe(2);
    expect(fiveCallers._allCallers.length).toBe(5);
  });
});

describe("VariantTableAGGrid - Field Metadata", () => {
  let table;
  let mockVcfParser;
  let mockDB;

  beforeEach(async () => {
    mockDB = await createTestDB();
    mockVcfParser = new VCFParser();
    table = new VariantTableAGGrid(mockVcfParser, mockDB);

    delete window.bcfFieldMetadata;
    delete window.survivorFieldMetadata;
  });

  afterEach(async () => {
    await cleanupTestDB(mockDB);
  });

  it("extracts unique values for categorical fields", async () => {
    const variants = [
      createMockVariant({ pos: 1000, locus: "NC_001133.9:1000-1500", info: { SVTYPE: "DEL" } }),
      createMockVariant({ pos: 2000, locus: "NC_001133.9:2000-2500", info: { SVTYPE: "DUP" } }),
      createMockVariant({ pos: 3000, locus: "NC_001133.9:3000-3500", info: { SVTYPE: "DEL" } }),
      createMockVariant({ pos: 4000, locus: "NC_001133.9:4000-4500", info: { SVTYPE: "INV" } }),
    ];

    await mockDB.storeVariants("bcf", variants);
    const metadata = await table.getFieldMetadata("bcf");

    expect(metadata.SVTYPE).toBeDefined();
    expect(metadata.SVTYPE.type).toBe("categorical");
    expect(metadata.SVTYPE.uniqueValues).toBeDefined();
    expect(metadata.SVTYPE.uniqueValues.length).toBe(3);
    expect(metadata.SVTYPE.uniqueValues).toContain("DEL");
    expect(metadata.SVTYPE.uniqueValues).toContain("DUP");
    expect(metadata.SVTYPE.uniqueValues).toContain("INV");
  });

  it("detects numeric fields correctly", async () => {
    const variants = [
      createMockVariant({ pos: 1000, locus: "NC_001133.9:1000-1500" }),
      createMockVariant({ pos: 2000, locus: "NC_001133.9:2000-2500" }),
      createMockVariant({ pos: 3000, locus: "NC_001133.9:3000-3500" }),
    ];

    await mockDB.storeVariants("bcf", variants);
    const metadata = await table.getFieldMetadata("bcf");

    // Test with POS field which is always present and numeric
    expect(metadata.POS).toBeDefined();
    expect(metadata.POS.type).toBe("numeric");
    expect(metadata.POS.count).toBe(3);
    expect(metadata.POS.min).toBeLessThanOrEqual(1000);
    expect(metadata.POS.max).toBeGreaterThanOrEqual(3000);
  });

  it("counts non-null values correctly", async () => {
    const variants = [
      createMockVariant({ pos: 1000, locus: "NC_001133.9:1000-1500", id: "variant_1" }),
      createMockVariant({ pos: 2000, locus: "NC_001133.9:2000-2500", id: null }),
      createMockVariant({ pos: 3000, locus: "NC_001133.9:3000-3500", id: "variant_2" }),
      createMockVariant({ pos: 4000, locus: "NC_001133.9:4000-4500", id: undefined }),
    ];

    await mockDB.storeVariants("bcf", variants);
    const metadata = await table.getFieldMetadata("bcf");

    // ID field should have 2 non-null values
    expect(metadata.ID).toBeDefined();
    expect(metadata.ID.count).toBeGreaterThanOrEqual(2); // At least two non-null values
  });

  it("handles fields with all missing values", async () => {
    const variants = [
      createMockVariant({
        pos: 1000,
        locus: "NC_001133.9:1000-1500",
        _computed: { RARE_FIELD: null },
      }),
      createMockVariant({
        pos: 2000,
        locus: "NC_001133.9:2000-2500",
        _computed: { RARE_FIELD: null },
      }),
      createMockVariant({
        pos: 3000,
        locus: "NC_001133.9:3000-3500",
        _computed: { RARE_FIELD: undefined },
      }),
    ];

    await mockDB.storeVariants("bcf", variants);
    const metadata = await table.getFieldMetadata("bcf");

    if (metadata.RARE_FIELD) {
      expect(metadata.RARE_FIELD.count).toBe(0);
    }
  });

  it("generates different metadata for BCF vs SURVIVOR", async () => {
    const bcfVariants = [createMockVariant({ info: { SVTYPE: "DEL" } })];
    const survivorVariants = [
      createSurvivorVariant({ info: { SVTYPE: "DEL", SUPP_VEC: "110000" } }),
    ];

    await mockDB.storeVariants("bcf", bcfVariants);
    await mockDB.storeVariants("survivor", survivorVariants);

    const bcfMetadata = await table.getFieldMetadata("bcf");
    const survivorMetadata = await table.getFieldMetadata("survivor");

    expect(bcfMetadata.SVTYPE).toBeDefined();
    expect(survivorMetadata.SVTYPE).toBeDefined();

    expect(bcfMetadata.SUPP_VEC).toBeUndefined();
    expect(survivorMetadata.SUPP_VEC).toBeDefined();
  });

  it("handles empty variant set gracefully", async () => {
    const metadata = await table.getFieldMetadata("bcf");

    expect(metadata).toBeDefined();
    expect(typeof metadata).toBe("object");
  });

  it("detects string fields for non-numeric data", async () => {
    const variants = [
      createMockVariant({ info: { ID: "variant_1" } }),
      createMockVariant({ info: { ID: "variant_2" } }),
    ];

    await mockDB.storeVariants("bcf", variants);
    const metadata = await table.getFieldMetadata("bcf");

    expect(metadata.ID).toBeDefined();
    expect(metadata.ID.type).not.toBe("numeric");
  });

  it("calculates min/max for numeric fields", async () => {
    const variants = [
      createMockVariant({ pos: 1000, locus: "NC_001133.9:1000-1500" }),
      createMockVariant({ pos: 2000, locus: "NC_001133.9:2000-2500" }),
      createMockVariant({ pos: 3000, locus: "NC_001133.9:3000-3500" }),
      createMockVariant({ pos: 4000, locus: "NC_001133.9:4000-4500" }),
    ];

    await mockDB.storeVariants("bcf", variants);
    const metadata = await table.getFieldMetadata("bcf");

    expect(metadata.POS).toBeDefined();
    expect(metadata.POS.type).toBe("numeric");
    expect(metadata.POS.min).toBeLessThanOrEqual(1000);
    expect(metadata.POS.max).toBeGreaterThanOrEqual(4000);
  });
});

describe("VariantTableAGGrid - Integration Tests", () => {
  let table;
  let mockVcfParser;
  let mockDB;

  beforeEach(async () => {
    mockDB = await createTestDB();
    mockVcfParser = new VCFParser();
    table = new VariantTableAGGrid(mockVcfParser, mockDB);
  });

  afterEach(async () => {
    await cleanupTestDB(mockDB);
  });

  it("processes real BCF merged VCF data", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfText = loadRealVcf(vcfFiles.bcfMerge);
    const vcfBuffer = new TextEncoder().encode(vcfText).buffer;

    const variants = await mockVcfParser.parseVCF(vcfBuffer, 50);
    await mockDB.storeVariants("bcf", variants);

    const metadata = await table.getFieldMetadata("bcf");

    expect(metadata).toBeDefined();
    expect(Object.keys(metadata).length).toBeGreaterThan(0);
    expect(metadata.CHROM).toBeDefined();
    expect(metadata.POS).toBeDefined();
  });

  it("processes real SURVIVOR merged VCF data", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfText = loadRealVcf(vcfFiles.survivorMerge);
    const vcfBuffer = new TextEncoder().encode(vcfText).buffer;

    const variants = await mockVcfParser.parseVCF(vcfBuffer, 50);
    await mockDB.storeVariants("survivor", variants);

    const metadata = await table.getFieldMetadata("survivor");

    expect(metadata).toBeDefined();
    expect(Object.keys(metadata).length).toBeGreaterThan(0);
    expect(metadata.SUPP_VEC).toBeDefined();
  });

  it("builds columns for real BCF data", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfText = loadRealVcf(vcfFiles.bcfMerge);
    const vcfBuffer = new TextEncoder().encode(vcfText).buffer;

    const variants = await mockVcfParser.parseVCF(vcfBuffer, 50);
    await mockDB.storeVariants("bcf", variants);

    const metadata = await table.getFieldMetadata("bcf");
    const columnDefs = table.buildColumnDefinitions(metadata);

    expect(columnDefs.length).toBeGreaterThan(2);

    const fieldNames = columnDefs.map((c) => c.field);
    expect(fieldNames).toContain("CHROM");
    expect(fieldNames).toContain("POS");
  });

  it("builds columns for real SURVIVOR data", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfText = loadRealVcf(vcfFiles.survivorMerge);
    const vcfBuffer = new TextEncoder().encode(vcfText).buffer;

    const variants = await mockVcfParser.parseVCF(vcfBuffer, 50);
    await mockDB.storeVariants("survivor", variants);

    const metadata = await table.getFieldMetadata("survivor");
    const columnDefs = table.buildColumnDefinitions(metadata);

    const fieldNames = columnDefs.map((c) => c.field);
    expect(fieldNames).toContain("SUPP_VEC");
    expect(columnDefs.length).toBeGreaterThan(2);
  });

  it("returns real BCF variants as-is", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfText = loadRealVcf(vcfFiles.bcfMerge);
    const vcfBuffer = new TextEncoder().encode(vcfText).buffer;

    const variants = await mockVcfParser.parseVCF(vcfBuffer, 10);

    if (variants.length > 0) {
      const result = table.flattenVariant(variants[0]);

      expect(result).toBe(variants[0]);
      expect(result.chr).toBeDefined();
      expect(result.pos).toBeDefined();
      expect(typeof result.pos).toBe("number");
    }
  });

  it("returns real SURVIVOR variants with _allCallers as-is", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfText = loadRealVcf(vcfFiles.survivorMerge);
    const vcfBuffer = new TextEncoder().encode(vcfText).buffer;

    const variants = await mockVcfParser.parseVCF(vcfBuffer, 10);
    await mockDB.storeVariants("survivor", variants);

    const stored = await mockDB.queryVariants("survivor", {}, { limit: 1 });

    if (stored.length > 0) {
      const result = table.flattenVariant(stored[0]);

      expect(result).toBe(stored[0]);
      if (result.SUPP_VEC) {
        expect(typeof result.SUPP_VEC).toBe("string");
      }
      expect(result._variant).toBeDefined();
    }
  });

  it("extracts filters compatible with IndexedDB queries", async () => {
    const filterModel = {
      QUAL: {
        filterType: "number",
        type: "greaterThan",
        filter: 30,
      },
      SVTYPE: {
        filterType: "set",
        values: ["DEL", "DUP"],
      },
    };

    const filters = table.extractFilters(filterModel);

    const variants = [
      createMockVariant({ qual: 40, info: { SVTYPE: "DEL" } }),
      createMockVariant({ qual: 50, info: { SVTYPE: "INV" } }),
      createMockVariant({ qual: 20, info: { SVTYPE: "DUP" } }),
    ];

    await mockDB.storeVariants("bcf", variants);

    const results = await mockDB.queryVariants("bcf", filters, { limit: 100 });

    expect(results.length).toBeGreaterThanOrEqual(1);
    results.forEach((r) => {
      expect(r.QUAL).toBeGreaterThan(30);
      expect(["DEL", "DUP"]).toContain(r.SVTYPE);
    });
  });

  it("handles missing data in real variants", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfText = loadRealVcf(vcfFiles.bcfMerge);
    const vcfBuffer = new TextEncoder().encode(vcfText).buffer;

    const variants = await mockVcfParser.parseVCF(vcfBuffer, 50);

    if (variants.length > 0) {
      const variant = variants[0];
      const metadata = { type: "numeric" };

      const params = createMockCellParams(variant.info.QUAL || null, {}, "QUAL");
      const result = table.getCellRenderer(params, metadata);

      expect(result).toBeDefined();
      expect(result.textContent).toBeDefined();
    }
  });

  it("generates complete metadata from real data", async () => {
    const vcfFiles = getRealVcfFiles();
    const vcfText = loadRealVcf(vcfFiles.bcfMerge);
    const vcfBuffer = new TextEncoder().encode(vcfText).buffer;

    const variants = await mockVcfParser.parseVCF(vcfBuffer, 100);
    await mockDB.storeVariants("bcf", variants);

    const metadata = await table.getFieldMetadata("bcf");

    const numericFields = Object.keys(metadata).filter((k) => metadata[k].type === "numeric");
    const categoricalFields = Object.keys(metadata).filter(
      (k) => metadata[k].type === "categorical"
    );

    expect(numericFields.length).toBeGreaterThan(0);
    expect(categoricalFields.length).toBeGreaterThan(0);
  });
});
