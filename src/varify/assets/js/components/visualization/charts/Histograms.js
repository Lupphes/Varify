/**
 * Histogram Chart Generators
 *
 * Implements histogram types:
 * - SV Type Distribution
 * - SV Size Distribution (with percentile filtering)
 * - Quality Score Distribution (with KDE overlay)
 */

import { PlotDataProcessor } from "../PlotDataProcessor.js";
import { getSVTypeColor } from "../../../utils/ColorSchemes.js";
import { histogram, histogramLog } from "../../../utils/StatisticsUtils.js";
import { getGridConfig, AXIS_CONFIGS, SV_SIZE_BINS } from "../../../config/plots.js";
import { LoggerService } from "../../../utils/LoggerService.js";

const logger = new LoggerService("Histograms");

/**
 * Render SV Type Distribution histogram
 *
 * @param {Array} variants - Array of variant objects
 * @param {Object} echarts - ECharts library
 * @param {HTMLElement} container - DOM element
 * @param {Object} eventBus - Plot event bus
 * @returns {Object} - ECharts instance
 */
export function renderTypeDistribution(variants, echarts, container, eventBus) {
  const title = "Structural Variant Type Distribution";

  const filtered = PlotDataProcessor.filterNA(variants, "SVTYPE");

  if (filtered.length === 0) {
    return renderEmptyChart(echarts, container, title);
  }

  const sorted = PlotDataProcessor.sortBy(filtered, "SVTYPE");
  const counts = PlotDataProcessor.valueCounts(sorted, "SVTYPE");

  const allSVTypes = Array.from(new Set(filtered.map((v) => v.SVTYPE))).sort();

  const values = allSVTypes.map((type) => counts[type] || 0);

  const option = {
    title: { text: title },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    grid: getGridConfig("withRotatedLabels"),
    xAxis: {
      ...AXIS_CONFIGS.categoryWithRotation,
      data: allSVTypes,
      name: "SV Type",
    },
    yAxis: {
      type: "value",
      name: "Count",
    },
    series: [
      {
        type: "bar",
        data: allSVTypes.map((type, i) => ({
          value: values[i],
          itemStyle: { color: getSVTypeColor(type) },
        })),
      },
    ],
  };

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    eventBus.emitPlotSelection({ SVTYPE: params.name });
  });

  return chart;
}

/**
 * Render SV Size Distribution with logarithmic binning
 * Uses log-scale bins to better visualize heavily skewed size distributions
 */
export function renderSizeDistribution(variants, echarts, container, eventBus) {
  const title = "Structural Variant Size Distribution";

  const filtered = variants.filter(
    (v) => v.SVLEN !== null && v.SVLEN !== undefined && !(v.SVLEN === 0 && v.SVTYPE === "TRA")
  );

  if (filtered.length === 0) {
    return renderEmptyChart(echarts, container, title);
  }

  const svlenValues = filtered.map((v) => Math.abs(v.SVLEN));

  const histDataRaw = histogramLog(svlenValues, SV_SIZE_BINS, "percent");

  const nonEmptyIndices = histDataRaw.counts
    .map((count, i) => (count > 0 ? i : -1))
    .filter((i) => i !== -1);

  const histData = {
    counts: nonEmptyIndices.map((i) => histDataRaw.counts[i]),
    binLabels: nonEmptyIndices.map((i) => histDataRaw.binLabels[i]),
    percentages: nonEmptyIndices.map((i) => histDataRaw.percentages[i]),
    binEdges: nonEmptyIndices.map((i) => histDataRaw.binEdges[i]),
  };

  const smallVariants = filtered.filter((v) => Math.abs(v.SVLEN) < 1000).length;
  const mediumVariants = filtered.filter((v) => {
    const len = Math.abs(v.SVLEN);
    return len >= 1000 && len < 10000;
  }).length;
  const largeVariants = filtered.filter((v) => Math.abs(v.SVLEN) >= 10000).length;

  const smallPct = ((smallVariants / filtered.length) * 100).toFixed(1);
  const mediumPct = ((mediumVariants / filtered.length) * 100).toFixed(1);
  const largePct = ((largeVariants / filtered.length) * 100).toFixed(1);

  const subtitle = `N=${filtered.length.toLocaleString()} (${smallPct}% <1Kb, ${mediumPct}% 1-10Kb, ${largePct}% ≥10Kb)`;

  const option = {
    title: {
      text: title,
      subtext: subtitle,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        if (!params || params.length === 0) return "";
        const binLabel = params[0].name;
        const percentage = params[0].value.toFixed(2);
        const count = histData.counts[params[0].dataIndex];
        return `<strong>${binLabel} bp</strong><br/>Count: ${count.toLocaleString()}<br/>Percentage: ${percentage}%`;
      },
    },
    grid: getGridConfig("withRotatedLabels"),
    xAxis: {
      type: "category",
      data: histData.binLabels,
      name: "SV Length (bp)",
      nameLocation: "middle",
      nameGap: 35,
      axisLabel: {
        rotate: 45,
        interval: 0,
        fontSize: 10,
      },
    },
    yAxis: {
      type: "value",
      name: "Percentage (%)",
      nameLocation: "middle",
      nameGap: 40,
    },
    series: [
      {
        type: "bar",
        data: histData.percentages,
        itemStyle: {
          color: "#3498db",
          opacity: 0.8,
        },
        emphasis: {
          itemStyle: {
            color: "#2980b9",
            opacity: 1.0,
          },
        },
      },
    ],
  };

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    const binIndex = params.dataIndex;
    const minLen = histData.binEdges[binIndex];
    const maxLen = histData.binEdges[binIndex + 1];

    const maxFilter = isFinite(maxLen) ? maxLen : undefined;

    const filters = {
      SVLEN_MIN: minLen,
    };

    if (maxFilter !== undefined) {
      filters.SVLEN_MAX = maxFilter;
    }

    eventBus.emitPlotSelection(filters);
  });

  return chart;
}

/**
 * Render Quality Score Distribution with KDE overlay
 */
export function renderQualityDistribution(variants, echarts, container, eventBus) {
  const title = "Quality Score Distribution (5th-95th percentile)";

  const filtered = PlotDataProcessor.filterNA(variants, "QUAL");

  if (filtered.length === 0) {
    return renderEmptyChart(echarts, container, title);
  }

  const percentileFiltered = PlotDataProcessor.filterPercentile(filtered, "QUAL", 0.05, 0.95);

  if (percentileFiltered.length === 0) {
    return renderEmptyChart(echarts, container, title);
  }

  const qualValues = percentileFiltered.map((v) => v.QUAL);

  const uniqueQuals = new Set(qualValues).size;
  const hasLowVariation = uniqueQuals < 10;

  if (hasLowVariation) {
    logger.debug(
      `Low variation detected: ${uniqueQuals} unique QUAL values in ${qualValues.length} variants`
    );
  }

  const histData = histogram(qualValues, 50, "percent");

  const binWidth = histData.binEdges.length > 1 ? histData.binEdges[1] - histData.binEdges[0] : 1;

  const binLabels = histData.binEdges
    .map((edge, i) => {
      if (i < histData.binEdges.length - 1) {
        const start = edge.toFixed(1);
        const end = histData.binEdges[i + 1].toFixed(1);
        return `${start}`;
      }
      return null;
    })
    .filter((label) => label !== null);

  const series = [
    {
      name: "Histogram",
      type: "bar",
      data: histData.percentages,
      barMaxWidth: 50,
      itemStyle: {
        color: "#3498db",
        opacity: 0.8,
      },
    },
  ];

  if (uniqueQuals > 1) {
    const kde = PlotDataProcessor.computeKDE(qualValues, 1000);

    let minQual = qualValues[0];
    let maxQual = qualValues[0];
    for (let i = 1; i < qualValues.length; i++) {
      if (qualValues[i] < minQual) minQual = qualValues[i];
      if (qualValues[i] > maxQual) maxQual = qualValues[i];
    }

    const filteredKDE = kde.x
      .map((x, i) => ({ x, y: kde.y[i] }))
      .filter((point) => point.x >= minQual && point.x <= maxQual);

    const kdeSum = filteredKDE.reduce((sum, point) => sum + point.y, 0);

    const kdeData = filteredKDE.map((point) => {
      const binIndex = histData.binEdges.findIndex((edge, i) => {
        if (i === histData.binEdges.length - 1) return false;
        return point.x >= edge && point.x < histData.binEdges[i + 1];
      });

      const xIndex = binIndex >= 0 ? binIndex : 0;
      const yValue = ((point.y / kdeSum) * 100 * qualValues.length) / binWidth;

      return [xIndex, yValue];
    });

    series.push({
      name: "KDE",
      type: "line",
      data: kdeData,
      smooth: true,
      lineStyle: {
        color: "#e74c3c",
        width: 2,
      },
      symbol: "none",
      xAxisIndex: 0,
      yAxisIndex: 0,
    });
  }

  const option = {
    title: { text: title },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        if (params.seriesName === "Histogram" && params.seriesType === "bar") {
          const binIndex = params.dataIndex;
          const percentage = params.value;
          const count = histData.counts[binIndex];
          const binStart = histData.binEdges[binIndex];
          const binEnd = histData.binEdges[binIndex + 1];

          return `
            <strong>Quality Score: ${binStart.toFixed(2)} - ${binEnd.toFixed(2)}</strong><br/>
            Count: ${count.toLocaleString()}<br/>
            Percentage: ${percentage.toFixed(2)}%
          `;
        }

        if (params.seriesType === "line" && params.value) {
          const binIndex = Math.floor(params.value[0]);
          const kdeValue = params.value[1];
          const binStart = histData.binEdges[binIndex];
          const binEnd = histData.binEdges[binIndex + 1];

          return `
            <strong>Quality Score: ${binStart.toFixed(2)} - ${binEnd.toFixed(2)}</strong><br/>
            ${params.marker} KDE Density: ${kdeValue.toFixed(2)}%
          `;
        }

        return "";
      },
    },
    legend: {
      data: series.map((s) => s.name),
      top: 30,
    },
    xAxis: {
      type: "category",
      data: binLabels,
      name: "Quality Score",
      axisLabel: {
        interval: Math.floor(binLabels.length / 10),
        rotate: 45,
      },
    },
    yAxis: {
      type: "value",
      name: "Percentage",
    },
    series: series,
  };

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    if (params.componentType === "series" && params.seriesType === "bar") {
      const dataIndex = params.dataIndex;
      let minQual = histData.binEdges[dataIndex];
      let maxQual = histData.binEdges[dataIndex + 1];

      if (maxQual - minQual < 0.01) {
        minQual = Math.max(0, minQual - 0.5);
        maxQual = maxQual + 0.5;
        logger.debug(
          `Bin click with identical min/max (${histData.binEdges[dataIndex]}), expanding range to [${minQual}, ${maxQual}]`
        );
      }

      eventBus.emitPlotSelection({
        QUAL_MIN: minQual,
        QUAL_MAX: maxQual,
      });
    }
  });

  return chart;
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
