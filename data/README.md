# Collected data

This directory stores X search-result exports collected by the signed-in browser userscript.

## Layout

- `raw/<account>/<keyword>/`: original exports exactly as collected. Do not edit these after commit.
- `normalized/<account>/`: machine-friendly JSON/JSONL imported from raw exports. `statusId` is the deduplication key.
- `curated/<account>/`: parenting-only records after explicit review/classification. Do not treat `normalized` records as curated by default.

## Current corpus

`yuukamiya68` / keyword `子供` contains 519 unique status records from the uploaded TXT export. The normalized files preserve date, body, status URL, status ID and matched keyword. Because `子供` also matches childhood anecdotes, general opinions, fiction/game discussion and other non-parenting uses, `parentingRelevant` is intentionally `null` and `categories` is empty until curation.

Future searches such as `娘`, `赤ちゃん`, `育児`, `子育て`, `寝かしつけ`, etc. should be added as separate raw exports and then merged by `statusId`, unioning `matchedKeywords`.

Prefer committing the collector's JSON export as the authoritative machine-readable source when available. TXT is retained for human inspection and provenance.
