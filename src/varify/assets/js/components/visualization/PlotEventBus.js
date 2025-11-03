/**
 * Plot Event Bus
 *
 * Coordinates events between plots, AG-Grid table, and IGV browser.
 * Uses native EventTarget for custom event handling.
 *
 * Events:
 * - plotSelection: User clicked or brushed a plot element
 * - tableFilterChanged: AG-Grid filter was modified
 * - plotsNeedUpdate: Plots should refresh from new data
 */

import { LoggerService } from "../../utils/LoggerService.js";

const logger = new LoggerService("PlotEventBus");

export class PlotEventBus extends EventTarget {
  constructor() {
    super();
  }

  /**
   * Emit plot selection event
   * @param {Object} selectionCriteria - Filter criteria from plot interaction
   *   e.g., { SVTYPE: 'DEL' } or { CHROM: 'chr1', SVTYPE: 'DUP' }
   */
  emitPlotSelection(selectionCriteria) {
    const event = new CustomEvent("plotSelection", {
      detail: {
        criteria: selectionCriteria,
        timestamp: Date.now(),
      },
    });
    this.dispatchEvent(event);
    logger.debug("Plot selection emitted:", selectionCriteria);
  }

  /**
   * Emit table filter changed event
   * @param {Array} filteredData - Filtered row data from AG-Grid
   */
  emitTableFilterChanged(filteredData) {
    const event = new CustomEvent("tableFilterChanged", {
      detail: {
        data: filteredData,
        count: filteredData.length,
        timestamp: Date.now(),
      },
    });
    this.dispatchEvent(event);
    logger.debug(`Table filter changed: ${filteredData.length} variants`);
  }

  /**
   * Emit plots need update event
   * @param {string} reason - Why plots need to update
   */
  emitPlotsNeedUpdate(reason = "data changed") {
    const event = new CustomEvent("plotsNeedUpdate", {
      detail: {
        reason,
        timestamp: Date.now(),
      },
    });
    this.dispatchEvent(event);
    logger.debug("Plots need update:", reason);
  }

  /**
   * Register callback for plot selection events
   * @param {Function} callback - Function to call when plot is selected
   * @returns {Function} - Cleanup function to remove listener
   */
  onPlotSelection(callback) {
    const handler = (event) => callback(event.detail);
    this.addEventListener("plotSelection", handler);

    // Return cleanup function
    return () => this.removeEventListener("plotSelection", handler);
  }

  /**
   * Register callback for table filter change events
   * @param {Function} callback - Function to call when table filter changes
   * @returns {Function} - Cleanup function
   */
  onTableFilterChanged(callback) {
    const handler = (event) => callback(event.detail);
    this.addEventListener("tableFilterChanged", handler);

    return () => this.removeEventListener("tableFilterChanged", handler);
  }

  /**
   * Register callback for plots need update events
   * @param {Function} callback - Function to call when plots need refresh
   * @returns {Function} - Cleanup function
   */
  onPlotsNeedUpdate(callback) {
    const handler = (event) => callback(event.detail);
    this.addEventListener("plotsNeedUpdate", handler);

    return () => this.removeEventListener("plotsNeedUpdate", handler);
  }
}
