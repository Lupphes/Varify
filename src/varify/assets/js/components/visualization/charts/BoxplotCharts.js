/**
 * Boxplot Chart Generators
 *
 * Implements distribution charts using ECharts boxplot type:
 * - SV Type vs Size (boxplot colored by SV type)
 * - Quality by Caller (boxplot colored by caller)
 */

import { PlotDataProcessor } from "../PlotDataProcessor.js";
import { getSVTypeColor, getCallerColor } from "../../../utils/ColorSchemes.js";
import { groupBy, boxplotStats } from "../../../utils/StatisticsUtils.js";
import { getGridConfig, AXIS_CONFIGS } from "../../../config/plots.js";

/**
 * Render SV Type vs Size (boxplot with scatter overlay)
 *
 * @param {Array} variants - Array of variant objects
 * @param {Object} echarts - ECharts library
 * @param {HTMLElement} container - DOM element
 * @param {Object} eventBus - Plot event bus
 * @returns {Object} - ECharts instance
 */
export function renderTypeVsSize(variants, echarts, container, eventBus) {
  console.log(`[TypeVsSize] Starting with ${variants.length} variants`);

  const variantsWithAbsSVLEN = variants.map((v) => ({
    ...v,
    SVLEN_ABS: v.SVLEN ? Math.abs(v.SVLEN) : null,
  }));

  // Only apply percentile filtering if we have a large dataset (>100 variants)
  // For smaller filtered datasets, show all data to avoid empty plots
  let filtered = variantsWithAbsSVLEN;
  let titleSuffix = "";

  if (variantsWithAbsSVLEN.length > 100) {
    console.log(
      `[TypeVsSize] Large dataset (${variantsWithAbsSVLEN.length}), applying percentile filtering`
    );
    filtered = PlotDataProcessor.filterPercentile(variantsWithAbsSVLEN, "SVLEN_ABS", 0.05, 0.95);
    titleSuffix = " (5th–95th percentile)";

    console.log(`[TypeVsSize] After percentile filtering: ${filtered.length} variants`);
    if (filtered.length === 0) {
      console.log("[TypeVsSize] Percentile filtering removed all data, fallback to unfiltered");
      filtered = variantsWithAbsSVLEN; // Fallback to all data
    }
  } else {
    console.log(
      `[TypeVsSize] Small dataset (${variantsWithAbsSVLEN.length}), skipping percentile filtering`
    );
  }

  const title = `Structural Variant Type vs Size Distribution${titleSuffix}`;

  if (filtered.length === 0) {
    console.log("[TypeVsSize] No variants after filtering, rendering empty chart");
    return renderEmptyChart(echarts, container, title);
  }

  const grouped = groupBy(filtered, "SVTYPE");
  const svTypes = Object.keys(grouped).sort();
  console.log(`[TypeVsSize] Found ${svTypes.length} SV types:`, svTypes);

  if (svTypes.length === 0) {
    console.log("[TypeVsSize] No SV types found, rendering empty chart");
    return renderEmptyChart(echarts, container, title);
  }

  const boxplotData = svTypes.map((type) => {
    const values = grouped[type]
      .map((v) => v.SVLEN_ABS)
      .filter((val) => val !== null && val !== undefined)
      .sort((a, b) => a - b);

    const stats = boxplotStats(values);
    return {
      value: stats,
      itemStyle: {
        color: getSVTypeColor(type),
        borderColor: getSVTypeColor(type),
      },
    };
  });

  const subtitle = `N=${filtered.length.toLocaleString()} variants`;

  const option = {
    title: {
      text: title,
      subtext: subtitle,
    },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        if (params.seriesType === "boxplot") {
          // boxplotStats returns [min, Q1, median, Q3, max] (indices 0-4)
          // Data structure is { value: [stats], itemStyle: {...} }
          const data = params.data.value || params.data;
          if (!data || data.length < 5) return "";
          return `
            ${params.name}<br/>
            Min: ${formatNumber(data[0])}<br/>
            Q1: ${formatNumber(data[1])}<br/>
            Median: ${formatNumber(data[2])}<br/>
            Q3: ${formatNumber(data[3])}<br/>
            Max: ${formatNumber(data[4])}
          `;
        }
        if (!params.value || params.value.length < 2) return "";
        return `${svTypes[params.value[0]]}<br/>Size: ${formatNumber(params.value[1])} bp`;
      },
    },
    grid: getGridConfig("standard"),
    xAxis: {
      type: "category",
      data: svTypes,
      name: "SV Type",
      boundaryGap: true,
      splitArea: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: "SV Length (bp)",
      scale: true,
      axisLabel: {
        formatter: (value) => formatNumber(value),
      },
    },
    series: [
      {
        name: "boxplot",
        type: "boxplot",
        data: boxplotData,
      },
    ],
  };

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    if (params.seriesType === "boxplot") {
      eventBus.emitPlotSelection({ SVTYPE: params.name });
    }
  });

  return chart;
}

/**
 * Render Quality by Caller
 */
export function renderQualityByCaller(variants, echarts, container, eventBus) {
  const title = "Quality Spread of Structural Variants by Supporting Callers";

  console.log(`[QualitySpread] Starting with ${variants.length} variants`);

  const exploded = PlotDataProcessor.extractCallers(variants);
  console.log(`[QualitySpread] After extracting callers: ${exploded.length} observations`);

  if (exploded.length === 0) {
    console.log("[QualitySpread] No observations after caller extraction, rendering empty chart");
    return renderEmptyChart(echarts, container, title);
  }

  const filtered = PlotDataProcessor.filterPercentile(exploded, "QUAL", 0.05, 0.95);
  console.log(`[QualitySpread] After percentile filtering: ${filtered.length} observations`);

  if (filtered.length === 0) {
    console.log(
      "[QualitySpread] No observations after percentile filtering, rendering empty chart"
    );
    return renderEmptyChart(echarts, container, title);
  }

  const grouped = groupBy(filtered, "Caller");
  const callers = Object.keys(grouped).sort();
  console.log(`[QualitySpread] Found ${callers.length} callers:`, callers);

  if (callers.length === 0) {
    console.log("[QualitySpread] No callers found, rendering empty chart");
    return renderEmptyChart(echarts, container, title);
  }

  const boxplotData = callers.map((caller) => {
    const values = grouped[caller]
      .map((v) => v.QUAL)
      .filter((val) => val !== null && val !== undefined)
      .sort((a, b) => a - b);

    const stats = boxplotStats(values);

    const uniqueValues = new Set(values).size;
    const min = Math.min(...values);
    const max = Math.max(...values);

    console.log(
      `[QualitySpread] Caller "${caller}": ${values.length} values, ${uniqueValues} unique, range [${min.toFixed(2)}, ${max.toFixed(2)}]`
    );

    if (uniqueValues === 1) {
      // Add tiny variation to make boxplot visible (±0.1)
      const value = stats[2]; // median
      stats[0] = value - 0.1; // min
      stats[1] = value - 0.05; // Q1
      stats[2] = value; // median (unchanged)
      stats[3] = value + 0.05; // Q3
      stats[4] = value + 0.1; // max
      console.log(
        `[QualitySpread] -> Adding artificial spread ±0.1 for visibility (boxplot: [${stats[0].toFixed(2)}, ${stats[1].toFixed(2)}, ${stats[2].toFixed(2)}, ${stats[3].toFixed(2)}, ${stats[4].toFixed(2)}])`
      );
    }

    return {
      value: stats,
      itemStyle: {
        color: getCallerColor(caller),
        borderColor: getCallerColor(caller),
      },
    };
  });

  const subtitle = `N=${filtered.length.toLocaleString()} observations across ${callers.length} callers (5th-95th percentile)`;

  const option = {
    title: {
      text: title,
      subtext: subtitle,
    },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        console.log(`[QualitySpread] Tooltip params:`, params);

        if (params.seriesType === "boxplot") {
          const data = params.data.value || params.data;
          const caller = params.name;

          console.log(`[QualitySpread] Tooltip data:`, data);
          console.log(`[QualitySpread] Tooltip caller:`, caller);

          if (!data || data.length < 5) {
            console.log(`[QualitySpread] Invalid data format:`, data);
            return "";
          }

          const values =
            grouped[caller]
              ?.map((v) => v.QUAL)
              .filter((val) => val !== null && val !== undefined) || [];

          // boxplotStats returns [min, Q1, median, Q3, max] (indices 0-4)
          return `
            <strong>${caller}</strong><br/>
            Count: ${values.length}<br/>
            Min: ${data[0].toFixed(2)}<br/>
            Q1: ${data[1].toFixed(2)}<br/>
            Median: ${data[2].toFixed(2)}<br/>
            Q3: ${data[3].toFixed(2)}<br/>
            Max: ${data[4].toFixed(2)}
          `;
        }
        console.log(`[QualitySpread] Non-boxplot tooltip, returning empty`);
        return "";
      },
    },
    grid: getGridConfig("withRotatedLabels"),
    xAxis: {
      ...AXIS_CONFIGS.categoryWithRotation,
      data: callers,
      name: "Caller",
      boundaryGap: true,
      splitArea: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: "Quality Score",
      scale: true,
    },
    series: [
      {
        name: "boxplot",
        type: "boxplot",
        data: boxplotData,
      },
    ],
  };

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    if (params.seriesType === "boxplot") {
      eventBus.emitPlotSelection({ SUPP_CALLERS: params.name });
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
    series: [{ type: "boxplot", data: [] }],
  };

  const chart = echarts.init(container);
  chart.setOption(option);
  return chart;
}

/**
 * Format large numbers
 */
function formatNumber(value) {
  if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (value >= 1e3) return (value / 1e3).toFixed(2) + "K";
  return value.toFixed(0);
}
