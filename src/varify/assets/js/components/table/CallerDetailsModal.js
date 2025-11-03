/**
 * Caller Details Modal
 *
 * Creates and displays a modal showing all callers data for multi-caller variants.
 * Used in SURVIVOR mode to show detailed per-caller information.
 */

import { FORMAT_FIELD_PRIORITY } from "../../config/display.js";
import { UI_COLORS as THEME } from "../../config/colors.js";
import { isValidCaller, isMissing, formatValue } from "../../utils/DataValidation.js";
import { createLogger } from "../../utils/LoggerService.js";

const logger = createLogger("CallerDetailsModal");

export class CallerDetailsModal {
  /**
   * Show modal with caller details
   * @param {Object} rowData - Row data with _allCallers array
   */
  static show(rowData) {
    if (!rowData._allCallers || rowData._allCallers.length === 0) {
      return;
    }

    const modal = document.createElement("div");
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: ${THEME.modal.backdrop}; z-index: 10000; display: flex; align-items: center; justify-content: center;`;

    const content = document.createElement("div");
    content.style.cssText = `background: ${THEME.modal.background}; border-radius: ${THEME.modal.borderRadius}; padding: 24px; max-width: 90%; max-height: 80%; overflow: auto; box-shadow: ${THEME.modal.shadow};`;

    const { callerCount, totalCallCount } = this.calculateCounts(rowData._allCallers);

    const header = this.createHeader(callerCount, totalCallCount, modal);
    content.appendChild(header);

    const table = this.createTable(rowData);
    content.appendChild(table);

    modal.appendChild(content);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    const escapeHandler = (e) => {
      if (e.key === "Escape") {
        modal.remove();
        document.removeEventListener("keydown", escapeHandler);
      }
    };
    document.addEventListener("keydown", escapeHandler);

    document.body.appendChild(modal);
  }

  /**
   * Calculate caller count and total call count
   * @private
   */
  static calculateCounts(allCallers) {
    let callerCount = 0;
    let totalCallCount = 0;

    allCallers.forEach((caller) => {
      const callerName = caller.caller;
      if (!isValidCaller(callerName)) {
        return;
      }

      callerCount++;

      let maxCount = 1;
      Object.entries(caller).forEach(([key, value]) => {
        if (
          typeof value === "string" &&
          value.includes(",") &&
          !["caller", "variantID", "sampleIndex", "sampleName"].includes(key)
        ) {
          const parts = value.split(",");
          maxCount = Math.max(maxCount, parts.length);
        }
      });

      totalCallCount += maxCount;
    });

    return { callerCount, totalCallCount };
  }

  /**
   * Create modal header
   * @private
   */
  static createHeader(callerCount, totalCallCount, modal) {
    const header = document.createElement("div");
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid ${THEME.table.borderColor}; padding-bottom: 12px;`;

    const title = document.createElement("h3");
    if (totalCallCount > callerCount) {
      title.textContent = `Multi-Caller Details (${totalCallCount} calls from ${callerCount} callers)`;
    } else {
      title.textContent = `Multi-Caller Details (${callerCount} callers)`;
    }
    title.style.cssText = `margin: 0; font-size: 18px; font-weight: 600; color: ${THEME.text.primary};`;

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.style.cssText = `border: none; background: none; font-size: 32px; cursor: pointer; color: ${THEME.text.secondary}; line-height: 1;`;
    closeBtn.addEventListener("click", () => modal.remove());

    header.appendChild(title);
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Create table with caller data
   * @private
   */
  static createTable(rowData) {
    const table = document.createElement("table");
    table.style.cssText = "width: 100%; border-collapse: collapse; font-size: 13px;";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.style.cssText = `background: ${THEME.table.headerBg};`;

    const headers = this.buildHeaders(rowData._allCallers);

    headers.forEach((header) => {
      const th = document.createElement("th");
      th.textContent = header;
      th.style.cssText = `padding: 10px; text-align: left; border: 1px solid ${THEME.table.borderDark}; font-weight: 600;`;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = this.createTableBody(rowData._allCallers, headers);
    table.appendChild(tbody);

    return table;
  }

  /**
   * Build header list from caller data
   * @private
   */
  static buildHeaders(allCallers) {
    const headers = ["Caller", "Variant ID"];

    const formatFields = new Set();
    allCallers.forEach((caller) => {
      Object.keys(caller).forEach((key) => {
        if (!["sampleIndex", "sampleName", "caller", "ID"].includes(key)) {
          formatFields.add(key);
        }
      });
    });

    FORMAT_FIELD_PRIORITY.forEach((field) => {
      if (formatFields.has(field)) {
        headers.push(field);
        formatFields.delete(field);
      }
    });

    formatFields.forEach((field) => headers.push(field));

    return headers;
  }

  /**
   * Create table body with caller rows (with expansion for comma-separated values)
   * @private
   */
  static createTableBody(allCallers, headers) {
    const tbody = document.createElement("tbody");
    let rowIndex = 0;

    allCallers.forEach((caller) => {
      const callerName = caller.caller;
      if (!isValidCaller(callerName)) {
        return;
      }

      const expandedRows = this.expandCallerRows(caller);

      expandedRows.forEach((expandedCaller) => {
        const row = document.createElement("tr");
        row.style.cssText =
          rowIndex % 2 === 0
            ? `background: ${THEME.table.rowEven};`
            : `background: ${THEME.table.rowOdd};`;
        rowIndex++;

        headers.forEach((field) => {
          const td = document.createElement("td");
          td.style.cssText = `padding: 8px 10px; border: 1px solid ${THEME.table.border};`;

          let value;
          if (field === "Caller") {
            value = expandedCaller.caller;
          } else if (field === "Variant ID") {
            value = expandedCaller.ID;
          } else {
            value = expandedCaller[field];
          }

          if (isMissing(value)) {
            td.style.color = THEME.data.missingValue;
            td.textContent = formatValue(value);
          } else {
            td.textContent = value;
          }

          row.appendChild(td);
        });

        tbody.appendChild(row);
      });
    });

    return tbody;
  }

  /**
   * Expand caller with comma-separated FORMAT fields into multiple rows
   * @private
   * @param {Object} caller - Caller data object
   * @returns {Array<Object>} Array of expanded caller objects (one per variant call)
   */
  static expandCallerRows(caller) {
    logger.debug("Expanding caller:", caller);

    let maxCount = 1;
    const fieldArrays = {};

    Object.entries(caller).forEach(([key, value]) => {
      logger.debug(`  Field ${key}:`, value, `(type: ${typeof value})`);

      if (
        typeof value === "string" &&
        value.includes(",") &&
        !["caller", "variantID", "sampleIndex", "sampleName"].includes(key)
      ) {
        const parts = value.split(",").map((v) => v.trim());
        fieldArrays[key] = parts;
        maxCount = Math.max(maxCount, parts.length);
        logger.debug(`    -> Found ${parts.length} comma-separated values:`, parts);
      }
    });

    logger.debug("maxCount:", maxCount, "fieldArrays:", fieldArrays);

    if (maxCount === 1) {
      logger.debug("No expansion - returning single row");
      return [caller];
    }

    logger.debug(`Expanding into ${maxCount} rows`);

    const expandedRows = [];
    for (let i = 0; i < maxCount; i++) {
      const expandedCaller = {
        caller: caller.caller,
      };

      Object.entries(caller).forEach(([key, value]) => {
        if (["caller", "sampleIndex", "sampleName"].includes(key)) {
          return;
        }

        if (fieldArrays[key]) {
          expandedCaller[key] = fieldArrays[key][i] || "—";
        } else {
          expandedCaller[key] = value;
        }
      });

      expandedRows.push(expandedCaller);
    }

    return expandedRows;
  }
}
