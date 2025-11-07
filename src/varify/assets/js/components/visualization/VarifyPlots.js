/**
 * VarifyPlots - Main Plotting Component
 */

import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart, BoxplotChart, HeatmapChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  BrushComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  BoxplotChart,
  HeatmapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  BrushComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

import { PlotEventBus } from "./PlotEventBus.js";
import { PlotRenderer } from "./PlotRenderer.js";
import * as BarCharts from "./charts/BarCharts.js";
import * as Histograms from "./charts/Histograms.js";
import * as BoxplotCharts from "./charts/BoxplotCharts.js";
import * as ScatterCharts from "./charts/ScatterCharts.js";
import * as Heatmaps from "./charts/Heatmaps.js";
import * as InteractiveCharts from "./charts/InteractiveCharts.js";
import { LoggerService } from "../../utils/LoggerService.js";

const logger = new LoggerService("VarifyPlots");

/**
 * VarifyPlots Component
 */
export class VarifyPlots {
  constructor(dbManager, vcfType, containerPrefix) {
    this.dbManager = dbManager;
    this.vcfType = vcfType;
    this.containerPrefix = containerPrefix;
    this.eventBus = new PlotEventBus();
    this.renderer = new PlotRenderer(echarts);
    this.charts = new Map();
    this.variants = [];
    this.isInitialized = false;
  }

  /**
   * Initialize plots - load data and render all charts
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("VarifyPlots already initialized");
      return;
    }

    logger.debug(`Initializing ${this.vcfType} plots...`);
    logger.debug(`vcfType: ${this.vcfType}, containerPrefix: ${this.containerPrefix}`);

    try {
      logger.debug(`Querying IndexedDB for variants with type: ${this.vcfType}`);

      const totalCount = await this.dbManager.getVariantCount(this.vcfType, {});
      logger.debug(`Total variant count: ${totalCount}`);

      if (totalCount === 0) {
        logger.error(`No variants found in IndexedDB for type: ${this.vcfType}`);
        logger.debug(`Checking what's stored in IndexedDB...`);
        const allBcf = await this.dbManager.queryVariants("bcf", {}, { limit: 10 });
        const allSurvivor = await this.dbManager.queryVariants("survivor", {}, { limit: 10 });
        logger.debug(
          `BCF variants in DB: ${allBcf.length}, SURVIVOR variants in DB: ${allSurvivor.length}`
        );
        return;
      }

      logger.info(`Loading ${totalCount} variants for plots...`);
      this.variants = await this.dbManager.queryVariants(this.vcfType, {}, {
        limit: totalCount > 0 ? totalCount : 500000, 
      });
      logger.debug(`Loaded ${this.variants.length} variants from IndexedDB`);

      await this.renderAllCharts();

      this.handleResize = this.handleResize.bind(this);
      window.addEventListener("resize", this.handleResize);

      this.isInitialized = true;
      logger.debug("Initialization complete");
    } catch (error) {
      logger.error("Initialization error:", error);
      throw error;
    }
  }

  /**
   * Render all chart types
   */
  async renderAllCharts() {
    const chartDefinitions = [
      { id: "sv-callers", fn: BarCharts.renderSVCallers, name: "SV Callers" },
      {
        id: "primary-callers",
        fn: BarCharts.renderPrimaryCallers,
        name: "Primary Callers",
      },
      {
        id: "cumulative-length",
        fn: BarCharts.renderCumulativeSVLength,
        name: "Cumulative Length",
      },
      {
        id: "types-by-caller",
        fn: BarCharts.renderTypesByCaller,
        name: "Types by Caller",
      },

      {
        id: "type-distribution",
        fn: Histograms.renderTypeDistribution,
        name: "Type Distribution",
      },
      {
        id: "size-distribution",
        fn: Histograms.renderSizeDistribution,
        name: "Size Distribution",
      },
      {
        id: "quality-distribution",
        fn: Histograms.renderQualityDistribution,
        name: "Quality Distribution",
      },

      {
        id: "type-vs-size",
        fn: BoxplotCharts.renderTypeVsSize,
        name: "Type vs Size",
      },
      {
        id: "quality-by-caller",
        fn: BoxplotCharts.renderQualityByCaller,
        name: "Quality by Caller",
      },

      {
        id: "size-vs-quality",
        fn: ScatterCharts.renderSizeVsQuality,
        name: "Size vs Quality",
      },

      {
        id: "type-heatmap",
        fn: Heatmaps.renderTypeHeatmap,
        name: "Type Heatmap",
      },

      {
        id: "caller-combinations",
        fn: InteractiveCharts.renderCallerCombinations,
        name: "Caller Combinations",
      },
    ];

    let renderedCount = 0;

    for (const { id, fn, name } of chartDefinitions) {
      const containerId = `${this.containerPrefix}-${id}`;
      const container = document.getElementById(containerId);

      if (!container) {
        logger.warn(`Container not found: ${containerId}`);
        continue;
      }

      try {
        const chart =
          id === "caller-combinations"
            ? fn(this.variants, this.vcfType, echarts, container, this.eventBus)
            : fn(this.variants, echarts, container, this.eventBus);

        this.charts.set(id, chart);
        renderedCount++;
        logger.debug(`Rendered: ${name}`);
      } catch (error) {
        logger.error(`Error rendering ${name}:`, error);
      }
    }

    logger.debug(`Rendered ${renderedCount}/${chartDefinitions.length} charts`);
  }

  /**
   * Update all charts with filtered data (from table filter changes)
   * @param {Array} filteredVariants - Filtered variants from AG-Grid
   */
  async updateFromFilteredData(filteredVariants) {
    logger.info(`Updating ${this.charts.size} charts with ${filteredVariants.length} filtered variants`);

    if (!this.isInitialized) {
      logger.warn("Cannot update - not initialized");
      return;
    }

    const previousVariants = this.variants;
    this.variants = filteredVariants;

    const chartEntries = Array.from(this.charts.entries());

    if (chartEntries.length === 0) {
      logger.warn("No charts to update");
      return;
    }

    const batchSize = 3;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < chartEntries.length; i += batchSize) {
      const batch = chartEntries.slice(i, i + batchSize);

      const progress = Math.min(i + batchSize, chartEntries.length);
      if (window.updateChartLoadingProgress) {
        window.updateChartLoadingProgress(`Updating charts: ${progress} / ${chartEntries.length}`);
      }

      await Promise.all(
        batch.map(async ([id, chart]) => {
          try {
            const container = chart.getDom();

            if (!container) {
              logger.error(`No container found for chart ${id}`);
              errorCount++;
              return;
            }

            chart.dispose();

            const chartDef = this.getChartDefinition(id);
            if (!chartDef) {
              logger.warn(`Chart definition not found: ${id}`);
              errorCount++;
              return;
            }

            const newChart =
              id === "caller-combinations"
                ? chartDef.fn(this.variants, this.vcfType, echarts, container, this.eventBus)
                : chartDef.fn(this.variants, echarts, container, this.eventBus);

            if (!newChart) {
              logger.error(`Failed to create chart ${id}`);
              errorCount++;
              return;
            }

            this.charts.set(id, newChart);
            successCount++;
            logger.debug(`Successfully updated chart: ${id}`);
          } catch (error) {
            logger.error(`Error updating chart ${id}:`, error);
            errorCount++;
            this.variants = previousVariants;
          }
        })
      );

      if (i + batchSize < chartEntries.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    logger.info(`Chart update complete: ${successCount} successful, ${errorCount} errors`);
  }

  /**
   * Get chart definition by ID
   */
  getChartDefinition(id) {
    const definitions = {
      "sv-callers": { fn: BarCharts.renderSVCallers },
      "primary-callers": { fn: BarCharts.renderPrimaryCallers },
      "cumulative-length": { fn: BarCharts.renderCumulativeSVLength },
      "types-by-caller": { fn: BarCharts.renderTypesByCaller },
      "type-distribution": { fn: Histograms.renderTypeDistribution },
      "size-distribution": { fn: Histograms.renderSizeDistribution },
      "quality-distribution": { fn: Histograms.renderQualityDistribution },
      "type-vs-size": { fn: BoxplotCharts.renderTypeVsSize },
      "quality-by-caller": { fn: BoxplotCharts.renderQualityByCaller },
      "size-vs-quality": { fn: ScatterCharts.renderSizeVsQuality },
      "type-heatmap": { fn: Heatmaps.renderTypeHeatmap },
      "caller-combinations": { fn: InteractiveCharts.renderCallerCombinations },
    };

    return definitions[id];
  }

  /**
   * Register callback for plot selection events
   * @param {Function} callback - Function to call with selection criteria
   * @returns {Function} - Cleanup function
   */
  onPlotSelection(callback) {
    return this.eventBus.onPlotSelection(callback);
  }

  /**
   * Register callback for table filter change events
   * @param {Function} callback - Function to call with filtered data
   * @returns {Function} - Cleanup function
   */
  onTableFilterChanged(callback) {
    return this.eventBus.onTableFilterChanged(callback);
  }

  /**
   * Handle window resize - resize all charts
   */
  handleResize() {
    if (!this.isInitialized) return;

    this.charts.forEach((chart) => {
      try {
        chart.resize();
      } catch (error) {
        logger.warn("Error resizing chart:", error);
      }
    });
  }

  /**
   * Show loading state on all charts
   */
  showLoading(text = "Loading...") {
    this.charts.forEach((chart) => {
      this.renderer.showLoading(chart, text);
    });
  }

  /**
   * Hide loading state on all charts
   */
  hideLoading() {
    this.charts.forEach((chart) => {
      this.renderer.hideLoading(chart);
    });
  }

  /**
   * Cleanup - dispose all charts and remove listeners
   */
  destroy() {
    logger.debug("Destroying component...");

    this.charts.forEach((chart, id) => {
      try {
        chart.dispose();
      } catch (error) {
        logger.warn(`Error disposing chart ${id}:`, error);
      }
    });

    this.charts.clear();

    if (this.handleResize) {
      window.removeEventListener("resize", this.handleResize);
    }

    this.eventBus.clearAllListeners();

    this.isInitialized = false;
    logger.debug("Component destroyed");
  }

  /**
   * Get number of rendered charts
   */
  getChartCount() {
    return this.charts.size;
  }

  /**
   * Check if component is initialized
   */
  isReady() {
    return this.isInitialized && this.charts.size > 0;
  }
}
