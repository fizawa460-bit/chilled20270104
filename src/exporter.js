function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function toJson(posts) {
  return JSON.stringify([...posts].sort((a, b) => String(a.postedAt).localeCompare(String(b.postedAt))), null, 2);
}

export function toCsv(posts) {
  const header = ['statusId','username','displayName','postedAt','text','url','matchedKeywords','isReply','isQuote','replies','reposts','likes','collectedAt'];
  const rows = posts.map((p) => [
    p.statusId, p.username, p.displayName, p.postedAt, p.text, p.url,
    (p.matchedKeywords || []).join('|'), p.isReply, p.isQuote,
    p.metrics?.replies, p.metrics?.reposts, p.metrics?.likes, p.collectedAt,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function toTxt(posts) {
  return [...posts]
    .sort((a, b) => String(a.postedAt).localeCompare(String(b.postedAt)))
    .map((p) => [
      p.postedAt || '',
      p.text || '',
      p.url || '',
      `検索語: ${(p.matchedKeywords || []).join(', ')}`,
    ].join('\n'))
    .join('\n\n---\n\n');
}

export function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
