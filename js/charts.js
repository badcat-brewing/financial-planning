/**
 * charts.js
 * Chart.js wrappers with dark theme defaults.
 */

var CHART_COLORS = {
  green: '#66bb6a',
  purple: '#7c4dff',
  orange: '#ffa726',
  red: '#ef5350',
  blue: '#4fc3f7',
  teal: '#26a69a',
  pink: '#ec407a',
  yellow: '#ffee58',
  indigo: '#5c6bc0',
  lime: '#9ccc65',
};

var CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#b0b0c8',
        font: { size: 12 },
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: '#252540',
      titleColor: '#e8e8f0',
      bodyColor: '#b0b0c8',
      borderColor: '#2a2a4a',
      borderWidth: 1,
      padding: 12,
      callbacks: {
        label: function (context) {
          var label = context.dataset.label || '';
          var value = context.parsed.y != null ? context.parsed.y : context.parsed;
          return label + ': ' + formatMoney(value);
        },
      },
    },
  },
  scales: {
    x: {
      ticks: { color: '#6e6e8a', font: { size: 11 } },
      grid: { color: 'rgba(42, 42, 74, 0.5)' },
    },
    y: {
      ticks: {
        color: '#6e6e8a',
        font: { size: 11 },
        callback: function (value) {
          return formatMoney(value);
        },
      },
      grid: { color: 'rgba(42, 42, 74, 0.5)' },
    },
  },
};

/**
 * Format a number as money string.
 * e.g. 1234567 -> "$1,234,567", -280000 -> "-$280,000"
 */
function formatMoney(amount) {
  if (amount == null || isNaN(amount)) return '$0';
  var isNegative = amount < 0;
  var absValue = Math.abs(Math.round(amount));
  var formatted = absValue.toLocaleString('en-US');
  return (isNegative ? '-$' : '$') + formatted;
}

/**
 * Global flag: when true, display values in today's (real) dollars.
 * Toggled by the sidebar UI. Pages re-render when this changes.
 */
var showRealDollars = false;

/**
 * Global flag: when true, include second home purchase and ongoing costs.
 * Toggled by the sidebar UI. Pages re-render when this changes.
 */
var includeSecondHome = true;

/**
 * Convert a nominal dollar amount to display dollars.
 * If showRealDollars is true, deflates by cumulative inflation from CURRENT_YEAR.
 * If false, returns the nominal amount unchanged.
 */
function toDisplayDollars(amount, year, inflationRate) {
  if (!showRealDollars || !inflationRate || year <= CURRENT_YEAR) return amount;
  var yearsFromNow = year - CURRENT_YEAR;
  var deflator = Math.pow(1 + inflationRate, yearsFromNow);
  return amount / deflator;
}

/**
 * Get a label suffix for the current dollar display mode.
 */
function getDollarModeLabel() {
  return showRealDollars ? ' (today\'s dollars)' : '';
}

/**
 * Deep merge helper for chart options.
 */
function mergeChartOptions(defaults, overrides) {
  var result = JSON.parse(JSON.stringify(defaults));
  if (!overrides) return result;

  Object.keys(overrides).forEach(function (key) {
    if (
      overrides[key] &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key]) &&
      result[key] &&
      typeof result[key] === 'object'
    ) {
      result[key] = mergeChartOptions(result[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  });

  return result;
}

/**
 * Rebuild CHART_DEFAULTS with live callback references
 * (JSON.parse/stringify strips functions).
 */
function getDefaultOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#b0b0c8',
          font: { size: 12 },
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: '#252540',
        titleColor: '#e8e8f0',
        bodyColor: '#b0b0c8',
        borderColor: '#2a2a4a',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function (context) {
            var label = context.dataset.label || '';
            var value = context.parsed.y != null ? context.parsed.y : context.parsed;
            return label + ': ' + formatMoney(value);
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#6e6e8a', font: { size: 11 } },
        grid: { color: 'rgba(42, 42, 74, 0.5)' },
      },
      y: {
        ticks: {
          color: '#6e6e8a',
          font: { size: 11 },
          callback: function (value) {
            return formatMoney(value);
          },
        },
        grid: { color: 'rgba(42, 42, 74, 0.5)' },
      },
    },
  };
}

/**
 * Create a line chart.
 */
function createLineChart(canvasId, labels, datasets, options) {
  var ctx = document.getElementById(canvasId);
  if (!ctx) {
    console.error('Canvas not found: ' + canvasId);
    return null;
  }

  var defaultOpts = getDefaultOptions();
  var mergedOptions = options ? mergeChartOptions(defaultOpts, options) : defaultOpts;

  // Restore callbacks after merge
  if (!mergedOptions.plugins) mergedOptions.plugins = {};
  if (!mergedOptions.plugins.tooltip) mergedOptions.plugins.tooltip = {};
  if (!mergedOptions.plugins.tooltip.callbacks) {
    mergedOptions.plugins.tooltip.callbacks = {
      label: function (context) {
        var label = context.dataset.label || '';
        var value = context.parsed.y != null ? context.parsed.y : context.parsed;
        return label + ': ' + formatMoney(value);
      },
    };
  }
  if (mergedOptions.scales && mergedOptions.scales.y && mergedOptions.scales.y.ticks) {
    if (!mergedOptions.scales.y.ticks.callback) {
      mergedOptions.scales.y.ticks.callback = function (value) {
        return formatMoney(value);
      };
    }
  }

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets,
    },
    options: mergedOptions,
  });
}

/**
 * Create a doughnut chart with percentage tooltips.
 */
function createDoughnutChart(canvasId, labels, values, colors) {
  var ctx = document.getElementById(canvasId);
  if (!ctx) {
    console.error('Canvas not found: ' + canvasId);
    return null;
  }

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#1e1e35',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#b0b0c8',
            font: { size: 12 },
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: '#252540',
          titleColor: '#e8e8f0',
          bodyColor: '#b0b0c8',
          borderColor: '#2a2a4a',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function (context) {
              var label = context.label || '';
              var value = context.parsed;
              var total = context.dataset.data.reduce(function (sum, v) { return sum + v; }, 0);
              var pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return label + ': ' + formatMoney(value) + ' (' + pct + '%)';
            },
          },
        },
      },
    },
  });
}

/**
 * Create a stacked area chart.
 * Optional secondaryDatasets: array of line datasets plotted on right-hand Y axis (y2).
 */
function createStackedAreaChart(canvasId, labels, datasets, options, secondaryDatasets) {
  var ctx = document.getElementById(canvasId);
  if (!ctx) {
    console.error('Canvas not found: ' + canvasId);
    return null;
  }

  // Apply fill and stacking to each area dataset
  datasets.forEach(function (ds) {
    ds.fill = true;
    ds.yAxisID = 'y';
    if (ds.borderWidth == null) ds.borderWidth = 1;
  });

  // Apply secondary axis to overlay datasets
  var allDatasets = datasets.slice();
  if (secondaryDatasets && secondaryDatasets.length > 0) {
    secondaryDatasets.forEach(function (ds) {
      ds.yAxisID = 'y2';
      ds.fill = false;
      if (ds.borderWidth == null) ds.borderWidth = 2;
      if (ds.pointRadius == null) ds.pointRadius = 0;
      if (ds.tension == null) ds.tension = 0.3;
      allDatasets.push(ds);
    });
  }

  var defaultOpts = getDefaultOptions();
  defaultOpts.scales.x.stacked = true;
  defaultOpts.scales.y.stacked = true;

  // Add secondary Y axis if needed
  if (secondaryDatasets && secondaryDatasets.length > 0) {
    defaultOpts.scales.y2 = {
      position: 'right',
      stacked: false,
      grid: { drawOnChartArea: false },
      ticks: {
        color: '#6e6e8a',
        font: { size: 11 },
        callback: function (value) {
          return formatMoney(value);
        },
      },
    };
  }

  var mergedOptions = options ? mergeChartOptions(defaultOpts, options) : defaultOpts;

  // Restore callbacks
  if (mergedOptions.scales && mergedOptions.scales.y && mergedOptions.scales.y.ticks) {
    if (typeof mergedOptions.scales.y.ticks.callback !== 'function') {
      mergedOptions.scales.y.ticks.callback = function (value) {
        return formatMoney(value);
      };
    }
  }
  if (mergedOptions.scales && mergedOptions.scales.y2 && mergedOptions.scales.y2.ticks) {
    if (typeof mergedOptions.scales.y2.ticks.callback !== 'function') {
      mergedOptions.scales.y2.ticks.callback = function (value) {
        return formatMoney(value);
      };
    }
  }

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: allDatasets,
    },
    options: mergedOptions,
  });
}

/**
 * Create a bar chart.
 */
function createBarChart(canvasId, labels, datasets, options) {
  var ctx = document.getElementById(canvasId);
  if (!ctx) {
    console.error('Canvas not found: ' + canvasId);
    return null;
  }

  var defaultOpts = getDefaultOptions();
  var mergedOptions = options ? mergeChartOptions(defaultOpts, options) : defaultOpts;

  // Restore callbacks
  if (mergedOptions.scales && mergedOptions.scales.y && mergedOptions.scales.y.ticks) {
    if (typeof mergedOptions.scales.y.ticks.callback !== 'function') {
      mergedOptions.scales.y.ticks.callback = function (value) {
        return formatMoney(value);
      };
    }
  }

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets,
    },
    options: mergedOptions,
  });
}
