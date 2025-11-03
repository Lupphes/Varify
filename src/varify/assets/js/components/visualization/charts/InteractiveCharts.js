/**
 * Interactive Chart Generators
 *
 * Implements complex interactive charts:
 * - Caller Combinations (stacked bar with dual sliders for min/max callers)
 */

import { PlotDataProcessor } from "../PlotDataProcessor.js";
import { getCallerColor } from "../../../utils/ColorSchemes.js";
import { GRID_CONFIGS } from "../../../config/plots.js";

/**
 * Render Caller Combinations chart with dual sliders
 *
 * @param {Array} variants - Array of variant objects
 * @param {string} vcfType - 'bcf' or 'survivor'
 * @param {Object} echarts - ECharts library
 * @param {HTMLElement} container - DOM element
 * @param {Object} eventBus - Plot event bus
 * @returns {Object} - ECharts instance
 */
export function renderCallerCombinations(variants, vcfType, echarts, container, eventBus) {
  const title = "Structural Variant Caller Distribution";

  if (variants.length === 0) {
    return renderEmptyChart(echarts, container, title);
  }

  const counts = PlotDataProcessor.computeCallerCombinations(variants);

  if (Object.keys(counts).length === 0) {
    return renderEmptyChart(echarts, container, title);
  }

  const numCallersCategories = Object.keys(counts)
    .map(Number)
    .sort((a, b) => a - b);

  const allCallers = new Set();
  Object.values(counts).forEach((callerCounts) => {
    Object.keys(callerCounts).forEach((caller) => allCallers.add(caller));
  });

  const callerTotals = {};
  Array.from(allCallers).forEach((caller) => {
    const total = numCallersCategories.reduce((sum, n) => {
      return sum + (counts[n][caller] || 0);
    }, 0);
    if (total > 0) {
      callerTotals[caller] = total;
    }
  });

  // Sort callers by total count (descending) for better visualization
  const callers = Object.keys(callerTotals).sort((a, b) => callerTotals[b] - callerTotals[a]);

  // Count actual variants, not sum of caller occurrences
  const variantCounts = numCallersCategories.map((n) => {
    return variants.filter((v) => {
      const callerList = PlotDataProcessor.extractCallersWithDuplicates(v.SUPP_CALLERS || "");
      return callerList.length === n;
    }).length;
  });

  // Prepare stacked bar data (one series per caller, only non-zero callers)
  const series = callers.map((caller) => ({
    name: caller,
    type: "bar",
    stack: "total",
    data: numCallersCategories.map((n) => counts[n][caller] || 0),
    itemStyle: {
      color: getCallerColor(caller),
    },
    emphasis: {
      focus: "series",
    },
  }));

  const xAxisLabels = numCallersCategories.map((n, i) => {
    return `${n}\n(${variantCounts[i]})`;
  });

  const option = {
    title: { text: title },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const numCallers = params[0].name.split("\n")[0];
        let tooltip = `<strong>Number of Callers: ${numCallers}</strong><br/>`;

        params.forEach((item) => {
          if (item.value > 0) {
            tooltip += `${item.marker} ${item.seriesName}: ${item.value}<br/>`;
          }
        });

        return tooltip;
      },
    },
    legend: {
      data: callers,
      top: 35,
      type: "scroll",
    },
    grid: {
      ...GRID_CONFIGS.standard,
      top: "20%",
      bottom: "25%", // Extra space for dual sliders
    },
    xAxis: {
      type: "category",
      data: xAxisLabels,
      name: "Number of Callers per SV",
      nameLocation: "middle",
      nameGap: 60,
      axisLabel: {
        interval: 0,
        fontSize: 10,
      },
    },
    yAxis: {
      type: "value",
      name: "Count of SVs",
      scale: true,
    },
    series: series,

    // Single slider for interval selection
    dataZoom: [
      {
        type: "slider",
        show: true,
        xAxisIndex: 0,
        start: 0,
        end: 100,
        bottom: 30,
        height: 25,
        handleSize: "80%",
        showDetail: true,
        showDataShadow: true,
        labelFormatter: (value, valueStr) => {
          const index = Math.round(value);
          if (index >= 0 && index < numCallersCategories.length) {
            return `${numCallersCategories[index]} callers`;
          }
          return "";
        },
      },
    ],
  };

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    if (params.componentType === "series") {
      const numCallers = params.name.split("\n")[0];
      const caller = params.seriesName;

      eventBus.emitPlotSelection({
        NUM_CALLERS: parseInt(numCallers),
        SUPP_CALLERS: caller,
      });
    }
  });

  return chart;
}

/**
 * Render empty chart
 */
function renderEmptyChart(echarts, container, title) {
  const option = {
    title: { text: title, subtext: "No data to display" },
    xAxis: { type: "category", data: [] },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: [] }],
  };

  const chart = echarts.init(container);
  chart.setOption(option);
  return chart;
}
