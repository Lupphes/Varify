/**
 * IndexedDB database configuration
 */
export const INDEXEDDB = {
  /**
   * Database name
   */
  DB_NAME: "varify-genome-data",

  /**
   * Current database version
   */
  VERSION: 3,

  /**
   * Object store names
   */
  STORES: {
    FILES: "files",
    BCF_VARIANTS: "bcf_variants",
    SURVIVOR_VARIANTS: "survivor_variants",
  },

  /**
   * Timeout for database operations (milliseconds)
   */
  TIMEOUT: 10000,
};
