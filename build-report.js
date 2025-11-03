#!/usr/bin/env node

/**
 * Build script for Varify report generation
 *
 * 1. Builds JavaScript and CSS bundles using esbuild
 * 2. Reads the static HTML template
 * 3. Injects bundles into template placeholders
 * 4. Writes self-contained HTML to dist/report.html
 *
 */

import * as esbuild from "esbuild";
import postcss from "esbuild-postcss";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Building Varify report...\n");

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

let bundledJs = fs.readFileSync("dist/bundle.js", "utf8");
const bundledCss = fs.readFileSync("dist/bundle.css", "utf8");
console.log(`JavaScript: ${(bundledJs.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`CSS: ${(bundledCss.length / 1024).toFixed(2)} KB\n`);

// CRITICAL FIX: Normalize multiline template literals
// Replace actual newlines inside template literals with escaped \n
// This fixes the DOMPurify issue where template literals span multiple lines
console.log("Normalizing multiline template literals...");
const originalLength = bundledJs.length;

// Use a more conservative approach: only match short template literals with newlines
// This specifically targets patterns like `>\n` that cause issues
bundledJs = bundledJs.replace(/`([^`\n]{0,50})\n([^`\n]{0,50})`/g, (_match, before, after) => {
  // Replace the newline with an escaped newline
  return '`' + before + '\\n' + after + '`';
});

if (bundledJs.length !== originalLength) {
  console.log(`  ✓ Normalized ${originalLength - bundledJs.length} characters\n`);
} else {
  console.log(`  No multiline template literals found\n`);
}

const templatePath = "src/varify/templates/report-template.html";
let html = fs.readFileSync(templatePath, "utf8");

html = html.replace("<!-- BUNDLE_CSS -->", "<style>" + bundledCss + "</style>");

// CRITICAL: Escape HTML tags in the bundled JavaScript to prevent premature script tag closure
// This includes <script>, </script>, <title>, and </title> tags that appear in IGV.js SVG code
const escapedJs = bundledJs
  .replace(/<\/script>/gi, '<\\/script>')
  .replace(/<script>/gi, '<\\script>')
  .replace(/<\/title>/gi, '<\\/title>')
  .replace(/<title>/gi, '<\\title>');

html = html.replace("<!-- BUNDLE_JS -->", "<script>" + escapedJs + "</script>");

const outputPath = "dist/report.html";
fs.writeFileSync(outputPath, html, "utf8");
const finalSize = (html.length / 1024 / 1024).toFixed(2);
console.log(`Self-contained HTML created: ${outputPath} (${finalSize} MB)\n`);

console.log("Build complete!\n");
