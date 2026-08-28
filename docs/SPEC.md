# SPEC

## Scope
This PoC organizes public posts already visible to the signed-in user on X search pages. It does not call private X APIs, bypass authentication, solve CAPTCHAs, or export cookies/passwords.

## Search state machine
1. Persist run state in IndexedDB.
2. Build `from:<user> <keyword> since:<start> until:<end>`.
3. Navigate to X search with `f=live` (Latest).
4. Parse visible `article` elements.
5. Upsert by status ID and merge `matchedKeywords`.
6. Scroll with randomized 1.4–3.2 second delays.
7. Stop on user request, max scrolls, start-date boundary, or 8 stagnant rounds.
8. Advance to the next keyword and navigate again.

`until:` follows X search semantics and is exclusive.

## DOM strategy
Prefer semantic anchors over generated CSS classes:
- `article`
- `time[datetime]`
- `a[href*="/status/"]`
- `[data-testid="tweetText"]`
- `[data-testid="User-Name"]`
- metric test ids (`reply`, `retweet`, `like`)

All extraction logic lives in `parseArticle()` so selectors can be replaced without rewriting storage/export code.

## Persistence
IndexedDB database `x-post-collector` contains:
- `posts`: keyPath `statusId`
- `meta`: run configuration/progress

## Export
JSON preserves the complete record. CSV is flattened for inspection. TXT contains date, body, URL and matched keywords.
