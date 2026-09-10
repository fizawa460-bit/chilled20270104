#!/usr/bin/env node
import fs from 'node:fs';

function parseTxt(text, fallbackKeyword = null) {
  const blocks = text.trim().split(/\n\n---\n\n/g);
  const rows = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    if (!lines.length) continue;
    const postedAt = lines[0].trim();
    let urlIndex = -1;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (/^https:\/\/x\.com\/[^/]+\/status\/\d+$/.test(lines[i].trim())) {
        urlIndex = i;
        break;
      }
    }
    if (urlIndex < 0) continue;
    const url = lines[urlIndex].trim();
    const m = url.match(/^https:\/\/x\.com\/([^/]+)\/status\/(\d+)$/);
    if (!m) continue;
    const keywordLine = lines.slice(urlIndex + 1).find((line) => line.startsWith('検索語:'));
    const matchedKeywords = keywordLine
      ? keywordLine.slice('検索語:'.length).split(',').map((s) => s.trim()).filter(Boolean)
      : (fallbackKeyword ? [fallbackKeyword] : []);
    rows.push({
      statusId: m[2],
      username: m[1],
      postedAt,
      text: lines.slice(1, urlIndex).join('\n').trim(),
      url,
      matchedKeywords,
      parentingRelevant: null,
      categories: [],
      source: 'tampermonkey-txt-import',
    });
  }
  return rows;
}

function mergeRows(rows) {
  const byId = new Map();
  for (const row of rows) {
    const old = byId.get(row.statusId);
    if (!old) {
      byId.set(row.statusId, row);
      continue;
    }
    byId.set(row.statusId, {
      ...old,
      ...row,
      matchedKeywords: [...new Set([...(old.matchedKeywords || []), ...(row.matchedKeywords || [])])],
      parentingRelevant: old.parentingRelevant ?? row.parentingRelevant ?? null,
      categories: [...new Set([...(old.categories || []), ...(row.categories || [])])],
    });
  }
  return [...byId.values()].sort((a, b) => String(a.postedAt).localeCompare(String(b.postedAt)));
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node tools/import-txt.js <export1.txt> [export2.txt ...] > merged.jsonl');
  process.exit(1);
}

const rows = mergeRows(args.flatMap((file) => parseTxt(fs.readFileSync(file, 'utf8'))));
for (const row of rows) process.stdout.write(`${JSON.stringify(row)}\n`);
console.error(`Imported ${rows.length} unique statuses from ${args.length} file(s).`);
