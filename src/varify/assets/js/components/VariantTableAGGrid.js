/**
 * AG-Grid Variant Table Component
 *
 * Replaces DataTables with high-performance AG-Grid + IndexedDB backend.
 * Features:
 * - Virtual scrolling (only renders visible rows)
 * - IndexedDB-backed data source for fast filtering
 * - Built-in filters (numeric ranges, categorical sets, text search)
 * - Row selection and IGV navigation
 * - Export functionality
 */

import { createGrid } from "ag-grid-community";
import { CategoricalFilter } from "./CategoricalFilter.js";
import { CategoricalFloatingFilter } from "./CategoricalFloatingFilter.js";
import { FORMAT_FIELD_PRIORITY, COLUMN_PRIORITY_ORDER, COLUMN_WIDTHS } from "../config/display.js";
import { UI_COLORS as THEME } from "../config/colors.js";
import { CallerDetailsModal } from "./table/CallerDetailsModal.js";
import { TableExporter } from "./table/TableExporter.js";
import { MetadataService } from "../services/MetadataService.js";
import { LoggerService } from "../utils/LoggerService.js";

const logger = new LoggerService("VariantTableAGGrid");
const metadataService = new MetadataService();

export class VariantTableAGGrid {
  constructor(vcfParser, genomeDBManager, plotsComponent = null) {
    this.vcfParser = vcfParser;
    this.genomeDBManager = genomeDBManager;
    this.plotsComponent = plotsComponent;
    this.gridApi = null;
    this.columnApi = null;
  }

  async createVariantTable(prefix, igvBrowser, header, containerId = null) {
    this.prefix = prefix;
    this.igvBrowser = igvBrowser;
    this.hasNavigatedToFirst = false;

    const tableId = containerId || `${prefix}-variant-table`;
    const containerEl = document.getElementById(tableId);

    if (!containerEl) {
      logger.error(`Container ${tableId} not found`);
      return null;
    }

    containerEl.classList.add("ag-theme-alpine");
    containerEl.style.height = "600px";

    const fieldMetadata = await this.getFieldMetadata(prefix);
    const columnDefs = this.buildColumnDefinitions(fieldMetadata);
    const datasource = this.createDatasource(prefix);

    const gridOptions = {
      columnDefs: columnDefs,
      rowModelType: "infinite",
      cacheBlockSize: 100,
      maxBlocksInCache: 10,
      rowSelection: "multiple",
      suppressRowClickSelection: true,
      animateRows: false,
      onRowClicked: (event) => this.handleRowClick(event, igvBrowser),
      onSelectionChanged: () => this.updateSelectAllCheckbox(prefix),
      onFilterChanged: () => this.handleFilterChanged(),
      components: {
        categoricalFilter: CategoricalFilter,
        categoricalFloatingFilter: CategoricalFloatingFilter,
      },
      defaultColDef: {
        sortable: true,
        resizable: true,
        filter: true, // Enable filtering by default
        floatingFilter: true, // Show filter inputs below headers
        minWidth: 80, // Minimum width for all columns
        flex: 0, // Don't flex by default (use explicit widths)
      },
      overlayLoadingTemplate: '<span class="ag-overlay-loading-center">Loading variants...</span>',
      overlayNoRowsTemplate:
        '<span class="ag-overlay-no-rows-center">No variants to display</span>',
    };

    this.gridApi = createGrid(containerEl, gridOptions);
    this.gridApi.setGridOption("datasource", datasource);

    window[`${prefix}GridApi`] = this.gridApi;
    this.setupExportHandlers(prefix, header);

    logger.info(
      `AG-Grid table created for ${prefix} with ${Object.keys(fieldMetadata).length} columns`
    );

    return this.gridApi;
  }

  buildColumnDefinitions(fieldMetadata) {
    const columnDefs = [];

    columnDefs.push({
      headerName: "",
      checkboxSelection: true,
      width: 50,
      pinned: "left",
      lockPosition: true,
      suppressMenu: true,
      filter: false,
      sortable: false,
    });

    if (this.prefix === "survivor") {
      columnDefs.push({
        headerName: "Details",
        field: "_expand",
        width: 40,
        pinned: "left",
        lockPosition: true,
        suppressMenu: true,
        filter: false,
        sortable: false,
        cellRenderer: (params) => {
          if (!params.data) {
            return "";
          }

          if (!params.data._allCallers || params.data._allCallers.length <= 1) {
            return "";
          }

          const button = document.createElement("button");
          button.innerHTML = "📋";
          button.title = "View all callers";
          button.className = "ag-expand-button";
          button.style.cssText = `cursor: pointer; border: 1px solid ${THEME.buttons.primary}; border-radius: 4px; padding: 4px 8px; background: ${THEME.buttons.primaryLight}; font-size: 14px;`;
          button.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showCallerDetailsModal(params.data);
          });
          return button;
        },
      });
    }

    const hasData = (metadata) => {
      if (metadata.count === 0) return false;
      if (metadata.type === "boolean" && metadata.count === 0) return false;

      return true;
    };

    for (const field of COLUMN_PRIORITY_ORDER) {
      const metadata = fieldMetadata[field];
      if (!metadata) continue;
      if (!hasData(metadata)) continue;

      const colDef = {
        field: field,
        headerName: field,
        cellRenderer: (params) => this.getCellRenderer(params, metadata),
      };

      if (COLUMN_WIDTHS[field]) {
        colDef.width = COLUMN_WIDTHS[field];
      } else {
        colDef.width = 120;

        if (field.includes("CALLER")) {
          colDef.width = 150;
        }
      }

      this.configureColumnFilter(colDef, metadata);

      columnDefs.push(colDef);
    }

    for (const field of Object.keys(fieldMetadata)) {
      if (!COLUMN_PRIORITY_ORDER.includes(field)) {
        const metadata = fieldMetadata[field];
        if (!hasData(metadata)) continue;

        const colDef = {
          field: field,
          headerName: field,
          cellRenderer: (params) => this.getCellRenderer(params, metadata),
        };

        if (COLUMN_WIDTHS[field]) {
          colDef.width = COLUMN_WIDTHS[field];
          colDef.suppressSizeToFit = true;
        } else {
          colDef.width = 120;

          if (field.includes("CALLER")) {
            colDef.width = 150;
          }
        }

        this.configureColumnFilter(colDef, metadata);

        columnDefs.push(colDef);
      }
    }

    return columnDefs;
  }

  buildDetailColumnDefinitions(fieldMetadata) {
    const columnDefs = [];

    columnDefs.push({
      field: "caller",
      headerName: "Caller",
      width: 120,
      pinned: "left",
    });

    const formatPriorityOrder = FORMAT_FIELD_PRIORITY;

    for (const field of formatPriorityOrder) {
      const metadata = fieldMetadata[field];
      if (metadata) {
        const colDef = {
          field: field,
          headerName: field,
          width: 120,
        };

        if (metadata.type === "numeric") {
          colDef.type = "numericColumn";
        }

        columnDefs.push(colDef);
      }
    }

    for (const field of Object.keys(fieldMetadata)) {
      if (!formatPriorityOrder.includes(field) && field !== "caller") {
        if (/^[A-Z]{1,3}$/.test(field)) {
          const metadata = fieldMetadata[field];
          const colDef = {
            field: field,
            headerName: field,
            width: 120,
          };

          if (metadata.type === "numeric") {
            colDef.type = "numericColumn";
          }

          columnDefs.push(colDef);
        }
      }
    }

    return columnDefs;
  }

  showCallerDetailsModal(rowData) {
    CallerDetailsModal.show(rowData);
  }

  configureColumnFilter(colDef, metadata) {
    if (colDef.field === "SVTYPE") {
      const valuesArray = metadataService.getUniqueValues(metadata);

      if (valuesArray.length > 0) {
        colDef.filter = "categoricalFilter";
        colDef.floatingFilter = true;
        colDef.floatingFilterComponent = "categoricalFloatingFilter";
        colDef.filterParams = {
          uniqueValues: valuesArray,
        };
        colDef.minWidth = 150;
        colDef.width = 200;
        colDef.headerTooltip = `SV Type (categorical). Values: ${valuesArray.join(", ")}`;
        return;
      }
    }

    if (metadataService.isNumericField(metadata)) {
      colDef.filter = "agNumberColumnFilter";
      colDef.filterParams = {
        filterOptions: ["greaterThan", "lessThan", "inRange", "equals"],
        maxNumConditions: 1,
      };
    } else if (metadataService.isCategoricalField(metadata)) {
      const valuesArray = metadataService.getUniqueValues(metadata);

      if (valuesArray.length > 0 && valuesArray.length < 20) {
        colDef.filter = "categoricalFilter";
        colDef.floatingFilter = true;
        colDef.floatingFilterComponent = "categoricalFloatingFilter";
        colDef.filterParams = {
          uniqueValues: valuesArray,
        };
        colDef.minWidth = 150;
        colDef.width = 200;
        colDef.headerTooltip = `Categorical field. Values: ${valuesArray.join(", ")}`;
      } else {
        colDef.filter = "agTextColumnFilter";
        colDef.filterParams = {
          maxNumConditions: 1,
        };
      }
    } else {
      colDef.filter = "agTextColumnFilter";
      colDef.filterParams = {
        maxNumConditions: 1,
      };
    }
  }

  getCellRenderer(params, metadata) {
    const value = params.value;
    const span = document.createElement("span");

    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "." ||
      (typeof value === "string" && value.toUpperCase() === "NAN")
    ) {
      span.style.color = THEME.data.missingValue;
      span.textContent = "—";
      return span;
    }

    const hasConflict = this.checkFieldConflict(params);

    if (
      (params.colDef.field === "CIPOS" || params.colDef.field === "CIEND") &&
      typeof value === "string" &&
      value.includes(",")
    ) {
      span.textContent = `[${value.replace(/,/g, ", ")}]`;
      if (hasConflict) {
        this.addConflictIndicator(span, params);
      }
      return span;
    }

    if (typeof value === "string" && value.includes(",")) {
      const parts = value.split(",");
      parts.forEach((p, i) => {
        const trimmed = p.trim();
        if (trimmed === "." || trimmed === "") {
          const missingSpan = document.createElement("span");
          missingSpan.style.color = THEME.data.missingValue;
          missingSpan.textContent = "—";
          span.appendChild(missingSpan);
        } else {
          span.appendChild(document.createTextNode(trimmed));
        }
        if (i < parts.length - 1) {
          span.appendChild(document.createTextNode(", "));
        }
      });
      if (hasConflict) {
        this.addConflictIndicator(span, params);
      }
      return span;
    }

    if (metadata && metadata.type === "numeric") {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        span.textContent = num.toLocaleString();
        if (hasConflict) {
          this.addConflictIndicator(span, params);
        }
        return span;
      }
    }

    span.textContent = String(value);
    if (hasConflict) {
      this.addConflictIndicator(span, params);
    }
    return span;
  }

  checkFieldConflict(params) {
    const field = params.colDef.field;
    const rowData = params.data;

    if (!rowData) {
      return false;
    }

    if (!rowData._allCallers || rowData._allCallers.length <= 1) {
      return false;
    }

    const values = rowData._allCallers.map((caller) => caller[field]);
    const uniqueValues = new Set(values.map((v) => JSON.stringify(v)));

    return uniqueValues.size > 1;
  }

  addConflictIndicator(span, params) {
    const field = params.colDef.field;
    const rowData = params.data;

    const indicator = document.createElement("span");
    indicator.textContent = " ⚠️";
    indicator.style.marginLeft = "4px";
    indicator.style.cursor = "help";

    const callerValues = rowData._allCallers
      .map((caller) => `${caller.caller}: ${caller[field] ?? "—"}`)
      .join("\n");

    indicator.title = `Conflicting values:\n${callerValues}`;

    span.appendChild(indicator);
  }

  createDatasource(prefix) {
    return {
      rowCount: undefined,
      getRows: async (params) => {
        try {
          const filters = this.extractFilters(params.filterModel);

          const sort =
            params.sortModel && params.sortModel.length > 0
              ? {
                  field: params.sortModel[0].colId,
                  direction: params.sortModel[0].sort,
                }
              : null;

          const multiCallerMode = prefix === "survivor" && window.survivorMultiCallerMode;

          logger.debug(
            `Querying IndexedDB: offset=${params.startRow}, limit=${params.endRow - params.startRow}`,
            { filters, sort, multiCallerMode }
          );

          // Query IndexedDB
          const variants = await this.genomeDBManager.queryVariants(prefix, filters, {
            offset: params.startRow,
            limit: params.endRow - params.startRow,
            sort: sort,
            multiCallerMode: multiCallerMode,
          });

          const totalCount = await this.genomeDBManager.getVariantCount(prefix, filters, {
            multiCallerMode: multiCallerMode,
          });

          logger.debug(`Retrieved ${variants.length} variants (total: ${totalCount})`);

          const flattenedVariants = variants.map((v) => this.flattenVariant(v));

          if (prefix === "survivor" && flattenedVariants.length > 0 && !window._loggedAllCallers) {
            window._loggedAllCallers = true;
            const firstVariant = flattenedVariants[0];
            logger.debug("=== First Grid Variant ===");
            logger.debug("Has _allCallers:", !!firstVariant._allCallers);
            logger.debug("_allCallers length:", firstVariant._allCallers?.length);
            logger.debug("_allCallers:", firstVariant._allCallers);
          }

          params.successCallback(flattenedVariants, totalCount);

          if (!this.hasNavigatedToFirst && flattenedVariants.length > 0 && params.startRow === 0) {
            this.hasNavigatedToFirst = true;
            this.navigateToVariant(flattenedVariants[0], null, false);
          }
        } catch (error) {
          logger.error("Error loading variants from IndexedDB:", error);
          params.failCallback();
        }
      },
    };
  }

  extractFilters(filterModel) {
    if (!filterModel) return {};
    const filters = {};

    for (const [field, filter] of Object.entries(filterModel)) {
      if (!filter) continue;

      if (filter.filterType === "number") {
        if (filter.type === "greaterThan") {
          filters[field] = { min: filter.filter };
        } else if (filter.type === "lessThan") {
          filters[field] = { max: filter.filter };
        } else if (filter.type === "inRange") {
          filters[field] = { min: filter.filter, max: filter.filterTo };
        } else if (filter.type === "equals") {
          filters[field] = { min: filter.filter, max: filter.filter };
        }
      } else if (filter.filterType === "set") {
        if (filter.values && filter.values.length > 0) {
          filters[field] = { values: filter.values };
        }
      } else if (filter.filterType === "categorical") {
        if (filter.selectedValues && filter.selectedValues.length > 0) {
          filters[field] = { values: filter.selectedValues };
        } else if (filter.values && filter.values.length > 0) {
          filters[field] = { values: filter.values };
        }
      } else if (filter.filterType === "text") {
        if (filter.type === "contains") {
          filters[field] = filter.filter;
        } else if (filter.type === "equals") {
          filters[field] = filter.filter;
        }
      } else if (filter.values && Array.isArray(filter.values)) {
        filters[field] = { values: filter.values };
      } else if (filter.selectedValues && Array.isArray(filter.selectedValues)) {
        filters[field] = { values: filter.selectedValues };
      }
    }

    return filters;
  }

  navigateToVariant(variant, igvBrowser = null, shouldScroll = true) {
    const browser = igvBrowser || this.igvBrowser;

    if (!browser) {
      logger.warn("IGV browser not initialized");
      return;
    }

    const maxlen = 10000;
    const flanking = 1000;

    const isTranslocation = variant.CHR2 && variant.CHR2 !== variant.CHROM;
    const svlen = variant.SVLEN ? Math.abs(parseInt(variant.SVLEN)) : 0;
    const isLargeSV = svlen > maxlen;

    let locus;

    if (isTranslocation) {
      const pos1 = parseInt(variant.POS);
      const pos2 = parseInt(variant.END || variant.POS);
      const locus1 = `${variant.CHROM}:${Math.max(1, pos1 - flanking)}-${pos1 + flanking}`;
      const locus2 = `${variant.CHR2}:${Math.max(1, pos2 - flanking)}-${pos2 + flanking}`;
      locus = `${locus1} ${locus2}`;
      logger.debug(`Navigating IGV to translocation (multi-locus): ${locus}`);
    } else if (isLargeSV && variant.END) {
      const pos1 = parseInt(variant.POS);
      const pos2 = parseInt(variant.END);
      const locus1 = `${variant.CHROM}:${Math.max(1, pos1 - flanking)}-${pos1 + flanking}`;
      const locus2 = `${variant.CHROM}:${Math.max(1, pos2 - flanking)}-${pos2 + flanking}`;
      locus = `${locus1} ${locus2}`;
      logger.debug(`Navigating IGV to large SV (multi-locus): ${locus}`);
    } else {
      locus = variant.locus || `${variant.CHROM || variant.chr}:${variant.POS || variant.pos}`;
      logger.debug(`Navigating IGV to: ${locus}`);
    }

    browser.search(locus);

    if (shouldScroll) {
      const igvDiv = browser.root;
      if (igvDiv) {
        igvDiv.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  handleRowClick(event, igvBrowser) {
    if (!window.lastSelectedVariant) {
      window.lastSelectedVariant = {};
    }
    window.lastSelectedVariant[this.prefix] = event.data;

    this.navigateToVariant(event.data, igvBrowser);
  }

  updateSelectAllCheckbox(prefix) {
    const checkbox = document.getElementById(`select-all-${prefix}`);
    if (!checkbox) return;

    const selectedCount = this.gridApi.getSelectedRows().length;
    const displayedCount = this.gridApi.getDisplayedRowCount();

    checkbox.checked = selectedCount > 0 && selectedCount === displayedCount;
    checkbox.indeterminate = selectedCount > 0 && selectedCount < displayedCount;
  }

  flattenVariant(variant) {
    return variant;
  }

  async getFieldMetadata(prefix) {
    if (window[`${prefix}FieldMetadata`]) {
      return window[`${prefix}FieldMetadata`];
    }

    logger.info(`Analyzing field metadata for ${prefix}...`);
    const metadata = {};

    const variants = await this.genomeDBManager.queryVariants(prefix, {}, { limit: 10000 });

    if (variants.length === 0) {
      return metadata;
    }

    const fieldValues = {};

    variants.forEach((variant) => {
      Object.entries(variant).forEach(([field, value]) => {
        if (field.startsWith("_")) return;
        if (typeof value === "object" && value !== null && !Array.isArray(value)) return;

        if (!fieldValues[field]) {
          fieldValues[field] = {
            values: [],
            numericValues: [],
            count: 0,
          };
        }

        if (value !== null && value !== undefined && value !== "" && value !== ".") {
          fieldValues[field].count++;
          fieldValues[field].values.push(value);

          const numValue = Number(value);
          if (!isNaN(numValue) && typeof value !== "boolean") {
            fieldValues[field].numericValues.push(numValue);
          }
        }
      });
    });

    Object.entries(fieldValues).forEach(([field, data]) => {
      if (data.count === 0) return;

      const isNumeric = data.numericValues.length > data.count * 0.8;

      if (isNumeric) {
        let min = data.numericValues[0];
        let max = data.numericValues[0];
        for (let i = 1; i < data.numericValues.length; i++) {
          if (data.numericValues[i] < min) min = data.numericValues[i];
          if (data.numericValues[i] > max) max = data.numericValues[i];
        }
        metadata[field] = {
          type: "numeric",
          count: data.count,
          min: min,
          max: max,
        };
      } else {
        const uniqueValues = [...new Set(data.values)];
        metadata[field] = {
          type: uniqueValues.length < 50 ? "categorical" : "string",
          count: data.count,
          uniqueValues: uniqueValues.length < 50 ? uniqueValues : undefined,
        };
      }
    });

    window[`${prefix}FieldMetadata`] = metadata;

    return metadata;
  }

  setupExportHandlers(prefix, header) {
    const exporter = new TableExporter(this.gridApi);

    const csvBtn = document.getElementById(`export-csv-${prefix}`);
    if (csvBtn) {
      csvBtn.addEventListener("click", () => exporter.exportToCSV(prefix));
    }

    const vcfBtn = document.getElementById(`export-vcf-${prefix}`);
    if (vcfBtn) {
      vcfBtn.addEventListener("click", () => exporter.exportToVCF(prefix, header));
    }
  }

  async handleFilterChanged() {
    if (!this.plotsComponent) return;

    if (this._filterTimeout) {
      clearTimeout(this._filterTimeout);
    }

    this._filterTimeout = setTimeout(async () => {
      try {
        const filterModel = this.gridApi.getFilterModel();
        logger.debug("AG-Grid filter model:", filterModel);
        logger.debug("Filter model details:", JSON.stringify(filterModel, null, 2));

        if (Object.keys(filterModel).length === 0) {
          const allVariants = await this.genomeDBManager.queryVariants(
            this.prefix,
            {},
            { limit: Infinity }
          );
          logger.debug(`No filters active: ${allVariants.length} variants`);
          await this.plotsComponent.updateFromFilteredData(allVariants);
          return;
        }

        const dbFilters = this.extractFilters(filterModel);
        logger.debug("Converted to DB filters:", dbFilters);

        const filteredData = await this.genomeDBManager.queryVariants(this.prefix, dbFilters, {
          limit: Infinity,
        });

        logger.debug(`Filter changed: ${filteredData.length} variants`);

        if (filteredData.length > 0 && dbFilters.QUAL) {
          logger.debug("Sample QUAL values from filtered data:");
          filteredData.slice(0, 5).forEach((v, i) => {
            logger.debug(`  Variant ${i}: QUAL = ${v.QUAL} (type: ${typeof v.QUAL})`);
          });
        } else if (filteredData.length === 0 && dbFilters.QUAL) {
          const sampleVariants = await this.genomeDBManager.queryVariants(
            this.prefix,
            {},
            { limit: 10 }
          );
          logger.debug("No variants matched QUAL filter. Sample QUAL values from DB:");
          sampleVariants.forEach((v, i) => {
            logger.debug(`  Variant ${i}: QUAL = ${v.QUAL} (type: ${typeof v.QUAL})`);
          });
        }

        await this.plotsComponent.updateFromFilteredData(filteredData);
      } catch (error) {
        logger.error("Error updating plots:", error);
      }
    }, 300);
  }

  applyFilterFromPlot(filterCriteria) {
    if (!this.gridApi) return;

    logger.debug("Applying filter from plot:", filterCriteria);

    if (filterCriteria.SVTYPE) {
      this.genomeDBManager
        .queryVariants(this.prefix, {}, { limit: Infinity })
        .then((allVariants) => {
          const matchingExact = allVariants.filter(
            (v) => v.SVTYPE === filterCriteria.SVTYPE
          ).length;
          const matchingContains = allVariants.filter(
            (v) => v.SVTYPE && v.SVTYPE.includes(filterCriteria.SVTYPE)
          ).length;
          logger.debug(
            `SVTYPE="${filterCriteria.SVTYPE}" - Exact matches: ${matchingExact}, Contains matches: ${matchingContains}`
          );
        });
    }

    const filterModel = {};

    for (const [field, value] of Object.entries(filterCriteria)) {
      if (field.endsWith("_MIN") || field.endsWith("_MAX")) {
        const baseField = field.replace(/_MIN$|_MAX$/, "");

        if (!filterModel[baseField]) {
          filterModel[baseField] = {
            filterType: "number",
            type: "inRange",
          };
        }

        if (field.endsWith("_MIN")) {
          filterModel[baseField].filter = value;
        } else {
          filterModel[baseField].filterTo = value;
        }
      } else {
        const column = this.gridApi.getColumn(field);
        const columnDef = column ? column.getColDef() : null;

        if (columnDef && columnDef.filter === "categoricalFilter") {
          filterModel[field] = {
            filterType: "set",
            values: [String(value)],
          };
        } else {
          const filterType = field === "SVTYPE" ? "contains" : "equals";
          filterModel[field] = {
            filterType: "text",
            type: filterType,
            filter: String(value),
          };
        }
      }
    }

    this.gridApi.setFilterModel(filterModel);
  }
}
