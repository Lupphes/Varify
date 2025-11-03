#!/usr/bin/env node

/**
 * Build script for Varify report generation
 *
 * Builds JavaScript and CSS bundles using esbuild.
 *
 * Usage:
 *   node build-report.js           # Build to dist/ only
 *   node build-report.js --package # Build directly to src/varify/dist/ for packaging
 */

import * as esbuild from "esbuild";
import postcss from "esbuild-postcss";
import fs from "fs";

const buildForPackage = process.argv.includes("--package");
const outputDir = buildForPackage ? "src/varify/dist" : "dist";

console.log(`Building Varify bundles to ${outputDir}/...\n`);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

try {
  await esbuild.build({
    entryPoints: ["src/varify/assets/js/index.js"],
    bundle: true,
    outfile: `${outputDir}/bundle.js`,
    format: "iife",
    globalName: "Varify",
    minify: true,
    mainFields: ["module", "main"],
    charset: "utf8",
    legalComments: "none",
  });
  console.log(`JavaScript bundle created: ${outputDir}/bundle.js\n`);
} catch (error) {
  console.error("Failed to build JavaScript bundle:", error);
  process.exit(1);
}

try {
  await esbuild.build({
    entryPoints: ["src/varify/assets/css/index.css"],
    bundle: true,
    outfile: `${outputDir}/bundle.css`,
    minify: true,
    plugins: [postcss()],
    loader: {
      ".css": "css",
    },
  });
  console.log(`CSS bundle created: ${outputDir}/bundle.css\n`);
} catch (error) {
  console.error("Failed to build CSS bundle:", error);
  process.exit(1);
}

const bundleJsSize = fs.statSync(`${outputDir}/bundle.js`).size;
const bundleCssSize = fs.statSync(`${outputDir}/bundle.css`).size;

console.log(`JavaScript: ${(bundleJsSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`CSS: ${(bundleCssSize / 1024).toFixed(2)} KB\n`);

if (buildForPackage) {
  console.log("Build complete! Bundles ready for Python package.\n");
} else {
  console.log("Build complete! Run 'npm run build:package' to build for Python packaging.\n");
}
