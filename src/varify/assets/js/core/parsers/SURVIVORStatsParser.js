/**
 * SURVIVOR Stats Parser
 *
 * Parses SURVIVOR statistics files into structured JavaScript objects.
 * Mirrors the Python logic from stats_parser.py::parse_survivor_stats()
 */

/**
 * Parse SURVIVOR stats TSV file
 * @param {string} fileContent - Raw text content of SURVIVOR stats file
 * @returns {Array} Array of objects with size range as index and SV type counts
 *
 * Example format:
 * Len      Del  Dup  Inv  INS  TRA  UNK
 * 0-50bp   0    0    0    0    165  0
 * 50-100bp 48   20   4    39   0    0
 */
export function parseSURVIVORStats(fileContent) {
  const lines = fileContent.trim().split("\n");

  if (lines.length === 0) {
    return [];
  }

  const header = lines[0].split("\t").map((h) => h.trim());

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;

    const parts = line.split("\t").map((p) => p.trim());

    if (parts.length !== header.length) {
      console.warn(`SURVIVOR stats: skipping malformed row ${i}: ${line}`);
      continue;
    }

    const row = {};
    row[header[0]] = parts[0];

    for (let j = 1; j < header.length; j++) {
      row[header[j]] = parseInt(parts[j]) || 0;
    }

    data.push(row);
  }

  return data;
}
