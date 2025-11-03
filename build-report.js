#!/usr/bin/env node

/**
 * Build script for Varify report generation
 *
 * Builds JavaScript and CSS bundles using esbuild.
 * Bundles are copied to the Python package during installation
 */

import * as esbuild from "esbuild";
import postcss from "esbuild-postcss";
import fs from "fs";

console.log("Building Varify bundles...\n");

try {
  await esbuild.build({
    entryPoints: ["src/varify/assets/js/index.js"],
    bundle: true,
    outfile: "dist/bundle.js",
    format: "iife",
    globalName: "Varify",
    minify: true,
    mainFields: ["module", "main"],
    charset: "utf8",
    legalComments: "none",
  });
  console.log("JavaScript bundle created: dist/bundle.js\n");
} catch (error) {
  console.error("Failed to build JavaScript bundle:", error);
  process.exit(1);
}

try {
  await esbuild.build({
    entryPoints: ["src/varify/assets/css/index.css"],
    bundle: true,
    outfile: "dist/bundle.css",
    minify: true,
    plugins: [postcss()],
    loader: {
      ".css": "css",
    },
  });
  console.log("CSS bundle created: dist/bundle.css\n");
} catch (error) {
  console.error("Failed to build CSS bundle:", error);
  process.exit(1);
}

const bundleJsSize = fs.statSync("dist/bundle.js").size;
const bundleCssSize = fs.statSync("dist/bundle.css").size;

console.log(`JavaScript: ${(bundleJsSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`CSS: ${(bundleCssSize / 1024).toFixed(2)} KB\n`);

console.log("Build complete! Run 'pip install -e .' to copy bundles to package.\n");
