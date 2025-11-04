/**
 * Bar Chart Generators
 *
 * Implements bar chart types:
 * - SV Callers distribution
 * - Primary Callers distribution
 * - Cumulative SV length per chromosome
 * - SV Types by Caller (stacked bar)
 */

import { PlotDataProcessor } from "../PlotDataProcessor.js";
import { getSVTypeColor, getCallerColor } from "../../../utils/ColorSchemes.js";
import { groupBy, sum } from "../../../utils/StatisticsUtils.js";
import { getGridConfig, AXIS_CONFIGS } from "../../../config/plots.js";

/**
 * Render SV Callers bar chart
 *
 * @param {Array} variants - Array of variant objects
 * @param {Object} echarts - ECharts library
 * @param {HTMLElement} container - DOM element
 * @param {Object} eventBus - Plot event bus
 * @returns {Object} - ECharts instance
 */
export function renderSVCallers(variants, echarts, container, eventBus) {
  const title = "Structural Variant Callers Reported";

  const exploded = PlotDataProcessor.extractCallers(variants);

  if (exploded.length === 0) {
    return renderEmptyChart(echarts, container, title);
  }

  const counts = PlotDataProcessor.valueCounts(exploded, "Caller");
  const callers = Object.keys(counts);
  const values = Object.values(counts);

  const option = {
    title: { text: title },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    grid: getGridConfig("withRotatedLabels"),
    xAxis: {
      ...AXIS_CONFIGS.categoryWithRotation,
      data: callers,
    },
    yAxis: {
      type: "value",
      name: "Count",
    },
    series: [
      {
        type: "bar",
        data: callers.map((caller, i) => ({
          value: values[i],
          itemStyle: { color: getCallerColor(caller) },
        })),
      },
    ],
  };

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    eventBus.emitPlotSelection({ SUPP_CALLERS: params.name });
  });

  return chart;
}

/**
 * Render Primary Callers bar chart
 */
export function renderPrimaryCallers(variants, echarts, container, eventBus) {
  const title = "Primary Structural Variant Callers";

  const filtered = PlotDataProcessor.filterNA(variants, "PRIMARY_CALLER");

  if (filtered.length === 0) {
    return renderEmptyChart(echarts, container, title);
  }

  const counts = PlotDataProcessor.valueCounts(filtered, "PRIMARY_CALLER");
  const callers = Object.keys(counts);
  const values = Object.values(counts);

  const option = {
    title: { text: title },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    grid: getGridConfig("withRotatedLabels"),
    xAxis: {
      ...AXIS_CONFIGS.categoryWithRotation,
      data: callers,
    },
    yAxis: {
      type: "value",
      name: "Count",
    },
    series: [
      {
        type: "bar",
        data: callers.map((caller, i) => ({
          value: values[i],
          itemStyle: { color: getCallerColor(caller) },
        })),
      },
    ],
  };

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    eventBus.emitPlotSelection({ PRIMARY_CALLER: params.name });
  });

  return chart;
}

/**
 * Render Cumulative SV Length per Chromosome
 */
export function renderCumulativeSVLength(variants, echarts, container, eventBus) {
  const title = "Cumulative Structural Variant Length per Chromosome";

  const filtered = variants.filter((v) => v.SVLEN !== null && v.SVLEN !== undefined && v.CHROM);

  if (filtered.length === 0) {
    return renderEmptyChart(echarts, container, title);
  }

  const grouped = groupBy(filtered, "CHROM");
  const chromLengths = {};

  for (const [chrom, variants] of Object.entries(grouped)) {
    const totalLength = sum(variants.map((v) => Math.abs(v.SVLEN)));

    // Filter out inf/-inf
    if (isFinite(totalLength)) {
      chromLengths[chrom] = totalLength;
    }
  }

  // Sort chromosomes naturally (chr1, chr2, ..., chr10, chr11, ...)
  const chroms = Object.keys(chromLengths).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, "")) || 999;
    const numB = parseInt(b.replace(/\D/g, "")) || 999;
    return numA - numB;
  });

  const values = chroms.map((c) => chromLengths[c]);

  const numChromosomes = chroms.length;
  const xAxisConfig = calculateXAxisConfig(numChromosomes);

  const option = {
    title: { text: title },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const value = params[0].value;
        return `${params[0].name}<br/>Total: ${formatLargeNumber(value)} bp`;
      },
    },
    grid: {
      ...getGridConfig("withRotatedLabels"),
      bottom: xAxisConfig.gridBottom,
    },
    xAxis: {
      type: "category",
      data: chroms,
      name: "Chromosome",
      nameLocation: "middle",
      nameGap: xAxisConfig.nameGap,
      axisLabel: {
        interval: xAxisConfig.interval,
        rotate: xAxisConfig.rotate,
        fontSize: xAxisConfig.fontSize,
        overflow: "none",
      },
    },
    yAxis: {
      type: "value",
      name: "Cumulative SV Length (bp)",
      axisLabel: {
        formatter: (value) => formatLargeNumber(value),
      },
    },
    series: [
      {
        type: "bar",
        data: values,
      },
    ],
  };

  if (numChromosomes > 30) {
    option.dataZoom = [
      {
        type: "slider",
        show: true,
        xAxisIndex: [0],
        start: 0,
        end: Math.min(100, (30 / numChromosomes) * 100), 
        bottom: "5%",
      },
      {
        type: "inside",
        xAxisIndex: [0],
        start: 0,
        end: Math.min(100, (30 / numChromosomes) * 100),
      },
    ];
  }

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    eventBus.emitPlotSelection({ CHROM: params.name });
  });

  return chart;
}

/**
 * Render SV Types by Caller (stacked bar)
 */
export function renderTypesByCaller(variants, echarts, container, eventBus) {
  const title = "Types Reported by Caller";

  const exploded = PlotDataProcessor.extractCallers(variants);

  if (exploded.length === 0) {
    return renderEmptyChart(echarts, container, title);
  }

  const { rows, cols, values } = PlotDataProcessor.crosstab(exploded, "Caller", "SVTYPE");

  const callerTotals = rows.map((caller, i) => sum(values[i]));
  const sortedIndices = callerTotals
    .map((total, i) => ({ total, i }))
    .sort((a, b) => b.total - a.total)
    .map((item) => item.i);

  const sortedCallers = sortedIndices.map((i) => rows[i]);
  const sortedValues = sortedIndices.map((i) => values[i]);

  const series = cols.map((svtype, colIdx) => ({
    name: svtype,
    type: "bar",
    stack: "total",
    data: sortedValues.map((row) => row[colIdx]),
    itemStyle: { color: getSVTypeColor(svtype) },
  }));

  const option = {
    title: { text: title },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    legend: {
      data: cols,
      top: 35,
      type: "scroll",
      orient: "horizontal",
      padding: [5, 10],
      itemGap: 10,
      textStyle: {
        fontSize: 11,
      },
    },
    grid: {
      ...getGridConfig("withRotatedLabels"),
      top: "20%", // Extra top space for legend
    },
    xAxis: {
      ...AXIS_CONFIGS.categoryWithRotation,
      data: sortedCallers,
      name: "Caller",
      nameLocation: "middle",
      nameGap: 35,
    },
    yAxis: {
      type: "value",
      name: "Count",
      nameLocation: "middle",
      nameGap: 40,
    },
    series: series,
  };

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    eventBus.emitPlotSelection({
      SUPP_CALLERS: params.name, // caller (x-axis)
      SVTYPE: params.seriesName, // svtype (series)
    });
  });

  return chart;
}

/**
 * Calculate dynamic X-axis configuration based on number of chromosomes
 */
function calculateXAxisConfig(numChromosomes) {
  if (numChromosomes <= 15) {
    return {
      fontSize: 11,
      rotate: 45,
      interval: 0,
      nameGap: 35,
      gridBottom: "20%",
    };
  } else if (numChromosomes <= 25) {
    return {
      fontSize: 9,
      rotate: 60,
      interval: 0, 
      nameGap: 40,
      gridBottom: "22%",
    };
  } else if (numChromosomes <= 40) {
    return {
      fontSize: 8,
      rotate: 60,
      interval: 1, 
      nameGap: 40,
      gridBottom: "22%",
    };
  } else {
    return {
      fontSize: 7,
      rotate: 60,
      interval: 2,
      nameGap: 40,
      gridBottom: "25%",
    };
  }
}

/**
 * Render empty chart (when no data)
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

/**
 * Format large numbers (e.g., 1234567 -> 1.23M)
 */
function formatLargeNumber(value) {
  if (value >= 1e9) return (value / 1e9).toFixed(2) + "G";
  if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (value >= 1e3) return (value / 1e3).toFixed(2) + "K";
  return value.toFixed(0);
}
