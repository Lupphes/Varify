/**
 * Plot Configuration for Varify
 *
 * Defines default options, styling, and data processing settings for all plots.
 * ECharts theme configuration moved to colors.js
 */

// Axis label configurations for different chart types
export const AXIS_CONFIGS = {
  // Category axis with rotated labels (for bar charts with many categories)
  categoryWithRotation: {
    type: "category",
    axisLabel: {
      interval: 0, // Force show all labels
      rotate: 45, // Rotate for better fit
      fontSize: 11,
      overflow: "none", // Don't hide overflow
    },
  },

  // Category axis without rotation (for charts with few categories)
  categoryNoRotation: {
    type: "category",
    axisLabel: {
      interval: 0,
      fontSize: 11,
    },
  },

  // Value axis (standard)
  value: {
    type: "value",
  },
};

// Grid configurations for different layout needs
export const GRID_CONFIGS = {
  // Grid with extra bottom space for rotated labels
  withRotatedLabels: {
    left: "5%", // Reduced from 10% to align more with heading
    right: "5%",
    bottom: "20%", // Extra space for rotated labels
    top: "25%", // Increased for title + subtitle + Y-axis label space
    containLabel: true,
  },

  // Standard grid
  standard: {
    left: "5%", // Reduced from 10% to align more with heading
    right: "10%",
    top: "25%", // Increased for title + subtitle + Y-axis label space
    bottom: "15%",
    containLabel: true,
  },

  // Grid for scatter plots with more left space
  scatter: {
    left: "8%", // Reduced from 12% to align more with heading
    right: "5%",
    bottom: "15%",
    top: "25%", // Increased for title + subtitle + Y-axis label space
    containLabel: true,
  },

  // Grid for heatmaps
  heatmap: {
    height: "60%",
    top: "25%", // Increased for title + subtitle + Y-axis label space
    left: "10%", // Reduced from 15% to align more with heading
    containLabel: true,
  },
};

/**
 * Get grid configuration by type
 */
export function getGridConfig(gridType) {
  return GRID_CONFIGS[gridType] || GRID_CONFIGS.standard;
}

/**
 * SV Size Bins for Logarithmic Histogram
 * Bins designed to capture distribution across orders of magnitude:
 * - 0-50bp: Very small (primers, adapters)
 * - 50-100bp: Small indels
 * - 100-500bp: Medium indels
 * - 500-1Kbp: Large indels
 * - 1K-5Kbp: Small SVs
 * - 5K-10Kbp: Medium SVs
 * - 10K-50Kbp: Large SVs
 * - 50K-100Kbp: Very large SVs
 * - 100K-500Kbp: Huge SVs
 * - 500K-1Mbp: Megabase SVs
 * - >1Mbp: Chromosomal rearrangements
 */
export const SV_SIZE_BINS = [
  0,
  50,
  100,
  500,
  1000,
  5000,
  10000,
  50000,
  100000,
  500000,
  1000000,
  Infinity,
];

/**
 * Plot Data Processing Defaults
 * Default values for data filtering and processing
 */
export const PLOT_DEFAULTS = {
  // Percentile filtering defaults
  percentile: {
    lower: 0.05, // 5th percentile
    upper: 0.95, // 95th percentile
  },

  // KDE (Kernel Density Estimation) settings
  kde: {
    bandwidth: "scott", // Scott's rule for bandwidth selection
    gridPoints: 100, // Number of points in KDE grid
  },

  // Histogram settings
  histogram: {
    bins: 30, // Default number of bins
    autoRange: true, // Automatically determine range
  },
};
