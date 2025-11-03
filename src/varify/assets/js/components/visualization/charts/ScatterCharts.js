/**
 * Scatter Plot Chart Generators
 *
 * Implements:
 * - SV Size vs Quality Score (scatter with color by SVTYPE)
 */

import { getSVTypeColor } from "../../../utils/ColorSchemes.js";
import { groupBy, quantiles } from "../../../utils/StatisticsUtils.js";
import { getGridConfig } from "../../../config/plots.js";
import { LoggerService } from "../../../utils/LoggerService.js";

const logger = new LoggerService("ScatterCharts");

/**
 * Render SV Size vs Quality scatter plot
 *
 * @param {Array} variants - Array of variant objects
 * @param {Object} echarts - ECharts library
 * @param {HTMLElement} container - DOM element
 * @param {Object} eventBus - Plot event bus
 * @returns {Object} - ECharts instance
 */
export function renderSizeVsQuality(variants, echarts, container, eventBus) {
  const totalVariants = variants.length;

  // Filter for valid QUAL and handle SVLEN
  // For log scale: treat SVLEN=0 as 1bp (minimum plottable value)
  const filtered = variants
    .filter(
      (v) => v.SVLEN !== null && v.SVLEN !== undefined && v.QUAL !== null && v.QUAL !== undefined
    )
    .map((v) => ({
      ...v,
      SVLEN: Math.abs(v.SVLEN) || 1, // Use absolute value, treat 0 as 1bp for log scale
    }));

  const zeroLengthCount = variants.filter((v) => v.SVLEN === 0).length;
  const excluded = totalVariants - filtered.length;

  if (zeroLengthCount > 0 || excluded > 0) {
    const excludedByNullLen = variants.filter(
      (v) => v.SVLEN === null || v.SVLEN === undefined
    ).length;
    const excludedByNullQual = variants.filter(
      (v) => v.QUAL === null || v.QUAL === undefined
    ).length;
    logger.debug(`SV Size vs Quality: ${filtered.length}/${totalVariants} variants displayed`);
    if (zeroLengthCount > 0) {
      logger.debug(
        `Note: ${zeroLengthCount} variants with SVLEN=0 shown at 1bp (log scale minimum)`
      );
    }
    if (excluded > 0) {
      logger.debug(
        `Excluded: ${excluded} total (SVLEN=null: ${excludedByNullLen}, QUAL=null: ${excludedByNullQual})`
      );
    }
  }

  if (filtered.length === 0) {
    const title = "SV Size vs Quality Score";
    return renderEmptyChart(echarts, container, title);
  }

  // Only apply percentile filtering if we have a large dataset (>100 variants)
  // For smaller filtered datasets, show all data to avoid empty plots
  let plotData = filtered;
  let titleSuffix = "";

  if (filtered.length > 100) {
    // Filter 5th-95th percentiles for SVLEN and QUAL to remove outliers
    const svlenValues = filtered.map((v) => v.SVLEN);
    const qualValues = filtered.map((v) => v.QUAL);

    const [svlenLower, svlenUpper] = quantiles(svlenValues, [0.05, 0.95]);
    const [qualLower, qualUpper] = quantiles(qualValues, [0.05, 0.95]);

    plotData = filtered.filter(
      (v) =>
        v.SVLEN >= svlenLower && v.SVLEN <= svlenUpper && v.QUAL >= qualLower && v.QUAL <= qualUpper
    );

    titleSuffix = " (5th-95th percentile)";

    if (plotData.length === 0) {
      plotData = filtered; // Fallback to all data if percentile filtering removes everything
    }
  }

  const title = `SV Size vs Quality Score${titleSuffix}`;

  const grouped = groupBy(plotData, "SVTYPE");
  const svTypes = Object.keys(grouped).sort();

  const series = svTypes.map((svtype) => ({
    name: svtype,
    type: "scatter",
    data: grouped[svtype].map((v) => [v.SVLEN, v.QUAL]),
    symbolSize: 6,
    itemStyle: {
      color: getSVTypeColor(svtype),
      opacity: 0.6,
    },
  }));

  let subtitle = `N=${plotData.length.toLocaleString()} variants`;
  if (zeroLengthCount > 0) {
    subtitle += ` (${zeroLengthCount} with SVLEN=0 shown at 1bp)`;
  }

  const option = {
    title: {
      text: title,
      subtext: subtitle,
    },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        if (!params.value || params.value.length < 2) return "";
        return `
          <strong>${params.seriesName}</strong><br/>
          SVLEN: ${formatNumber(params.value[0])} bp<br/>
          QUAL: ${params.value[1].toFixed(2)}
        `;
      },
    },
    legend: {
      data: svTypes,
      top: 60, // Increased to make room for title + subtitle
      type: "scroll",
      orient: "horizontal",
      padding: [5, 10],
      itemGap: 15,
      textStyle: {
        fontSize: 12,
      },
    },
    grid: {
      ...getGridConfig("scatter"),
      top: "32%", // Extra top space for legend, subtitle, and Y-axis label
    },
    xAxis: {
      type: "log", // Use logarithmic scale for better distribution
      name: "SV Length (bp)",
      nameLocation: "middle",
      nameGap: 35,
      scale: true,
      axisLabel: {
        formatter: (value) => formatNumber(value),
      },
    },
    yAxis: {
      type: "value",
      name: "Quality Score",
      nameLocation: "middle",
      nameGap: 45,
      scale: true,
    },
    series: series,
    // Enable brush selection for filtering
    brush: {
      toolbox: ["rect", "polygon", "clear"],
      xAxisIndex: 0,
      yAxisIndex: 0,
      brushStyle: {
        borderWidth: 1,
        color: "rgba(52, 152, 219, 0.2)",
        borderColor: "#3498db",
      },
    },
    toolbox: {
      feature: {
        brush: {
          type: ["rect", "polygon", "clear"],
        },
        saveAsImage: {
          title: "Save as PNG",
        },
      },
    },
  };

  const chart = echarts.init(container);
  chart.setOption(option);

  chart.on("click", (params) => {
    if (params.componentType === "series") {
      eventBus.emitPlotSelection({ SVTYPE: params.seriesName });
    }
  });

  chart.on("brushEnd", (params) => {
    if (params.areas && params.areas.length > 0) {
      const area = params.areas[0];
      const coordRange = area.coordRange;

      if (coordRange && coordRange.length === 2) {
        // coordRange = [[xMin, xMax], [yMin, yMax]]
        const [xRange, yRange] = coordRange;

        eventBus.emitPlotSelection({
          SVLEN_MIN: xRange[0],
          SVLEN_MAX: xRange[1],
          QUAL_MIN: yRange[0],
          QUAL_MAX: yRange[1],
        });
      }
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
    xAxis: { type: "value" },
    yAxis: { type: "value" },
    series: [{ type: "scatter", data: [] }],
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
