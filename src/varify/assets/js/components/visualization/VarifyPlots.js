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
      console.warn("VarifyPlots already initialized");
      return;
    }

    console.log(`[VarifyPlots] Initializing ${this.vcfType} plots...`);
    console.log(`[VarifyPlots] vcfType: ${this.vcfType}, containerPrefix: ${this.containerPrefix}`);

    try {
      console.log(`[VarifyPlots] Querying IndexedDB for variants with type: ${this.vcfType}`);
      this.variants = await this.dbManager.queryVariants(this.vcfType, {}, { limit: Infinity });
      console.log(`[VarifyPlots] Loaded ${this.variants.length} variants from IndexedDB`);

      if (this.variants.length === 0) {
        console.error(`[VarifyPlots] No variants found in IndexedDB for type: ${this.vcfType}`);
        console.log(`[VarifyPlots] Checking what's stored in IndexedDB...`);
        const allBcf = await this.dbManager.queryVariants("bcf", {}, { limit: 10 });
        const allSurvivor = await this.dbManager.queryVariants("survivor", {}, { limit: 10 });
        console.log(
          `[VarifyPlots] BCF variants in DB: ${allBcf.length}, SURVIVOR variants in DB: ${allSurvivor.length}`
        );
        return;
      }

      await this.renderAllCharts();

      this.handleResize = this.handleResize.bind(this);
      window.addEventListener("resize", this.handleResize);

      this.isInitialized = true;
      console.log("[VarifyPlots] Initialization complete");
    } catch (error) {
      console.error("[VarifyPlots] Initialization error:", error);
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
        console.warn(`[VarifyPlots] Container not found: ${containerId}`);
        continue;
      }

      try {
        const chart =
          id === "caller-combinations"
            ? fn(this.variants, this.vcfType, echarts, container, this.eventBus)
            : fn(this.variants, echarts, container, this.eventBus);

        this.charts.set(id, chart);
        renderedCount++;
        console.log(`[VarifyPlots] Rendered: ${name}`);
      } catch (error) {
        console.error(`[VarifyPlots] Error rendering ${name}:`, error);
      }
    }

    console.log(`[VarifyPlots] Rendered ${renderedCount}/${chartDefinitions.length} charts`);
  }

  /**
   * Update all charts with filtered data (from table filter changes)
   * @param {Array} filteredVariants - Filtered variants from AG-Grid
   */
  async updateFromFilteredData(filteredVariants) {
    console.log(`[VarifyPlots] Updating plots with ${filteredVariants.length} filtered variants`);

    if (!this.isInitialized) {
      console.warn("[VarifyPlots] Cannot update - not initialized");
      return;
    }

    const previousVariants = this.variants;
    this.variants = filteredVariants;

    for (const [id, chart] of this.charts.entries()) {
      try {
        const container = chart.getDom();

        chart.dispose();

        const chartDef = this.getChartDefinition(id);

        if (!chartDef) {
          console.warn(`[VarifyPlots] Chart definition not found: ${id}`);
          continue;
        }

        const newChart =
          id === "caller-combinations"
            ? chartDef.fn(this.variants, this.vcfType, echarts, container, this.eventBus)
            : chartDef.fn(this.variants, echarts, container, this.eventBus);

        this.charts.set(id, newChart);
      } catch (error) {
        console.error(`[VarifyPlots] Error updating chart ${id}:`, error);
        this.variants = previousVariants;
      }
    }

    console.log("[VarifyPlots] Charts updated");
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
        console.warn("[VarifyPlots] Error resizing chart:", error);
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
    console.log("[VarifyPlots] Destroying component...");

    this.charts.forEach((chart, id) => {
      try {
        chart.dispose();
      } catch (error) {
        console.warn(`[VarifyPlots] Error disposing chart ${id}:`, error);
      }
    });

    this.charts.clear();

    if (this.handleResize) {
      window.removeEventListener("resize", this.handleResize);
    }

    this.eventBus.clearAllListeners();

    this.isInitialized = false;
    console.log("[VarifyPlots] Component destroyed");
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
