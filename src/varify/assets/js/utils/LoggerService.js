/**
 * Logger Service
 *
 * Centralized logging utility with configurable log levels.
 * Allows conditional logging based on environment or debug flags.
 */

const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

/**
 * Logger Configuration
 * Set DEBUG_MODE to true to enable debug logging
 */
const config = {
  level: LogLevel.INFO,
  debugMode: false,
};

if (typeof window !== "undefined") {
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get("debug");
  const debugStorage = localStorage.getItem("varify_debug");

  if (debugParam === "true" || debugStorage === "true") {
    config.debugMode = true;
    config.level = LogLevel.DEBUG;
  }
}

/**
 * Logger class for structured logging
 */
export class LoggerService {
  constructor(context = "") {
    this.context = context;
  }

  /**
   * Format log message with context
   */
  _format(message, ...args) {
    const contextStr = this.context ? `[${this.context}] ` : "";
    return [contextStr + message, ...args];
  }

  /**
   * Log error message
   */
  error(message, ...args) {
    if (config.level >= LogLevel.ERROR) {
      console.error(...this._format(message, ...args));
    }
  }

  /**
   * Log warning message
   */
  warn(message, ...args) {
    if (config.level >= LogLevel.WARN) {
      console.warn(...this._format(message, ...args));
    }
  }

  /**
   * Log info message
   */
  info(message, ...args) {
    if (config.level >= LogLevel.INFO) {
      console.log(...this._format(message, ...args));
    }
  }

  /**
   * Log debug message
   */
  debug(message, ...args) {
    if (config.debugMode && config.level >= LogLevel.DEBUG) {
      console.log(...this._format(message, ...args));
    }
  }

  /**
   * Log table data
   */
  table(data, columns) {
    if (config.debugMode) {
      if (this.context) {
        console.log(`[${this.context}] Table data:`);
      }
      console.table(data, columns);
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(subContext) {
    const newContext = this.context ? `${this.context}:${subContext}` : subContext;
    return new LoggerService(newContext);
  }
}
