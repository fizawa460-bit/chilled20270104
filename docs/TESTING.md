# TESTING

## PoC acceptance test
1. Install `userscript/x-post-collector.user.js` in Tampermonkey.
2. Sign in to X normally in Chrome.
3. Open `https://x.com/search`.
4. Use defaults: user `yuukamiya68`, start `2016-08-01`, end `2016-09-02`, keyword `子供`.
5. Click **収集開始**. The script navigates to Latest search and starts scrolling after the page loads.
6. Confirm the panel updates keyword, total records, duplicate hits, oldest post date and scroll count.
7. Stop manually once to verify **停止** works, reload X, then click **続きから再開**.
8. Export JSON, CSV and TXT and confirm all three download.

## Expected manual spot checks
X internal search has been observed to contain relevant posts around 2016-08-10, 2016-08-17, 2016-08-19, 2016-08-21 and 2016-09-01. Exact wording is intentionally not hard-coded; verify captured status URLs/dates against what X currently renders.

## DOM-break checklist
If collection returns zero while X visibly shows results, inspect `src/parser.js` / the matching parser inside the userscript. Check in this order: `article`, `time[datetime]`, `/status/` links, `data-testid="tweetText"`, `data-testid="User-Name"`, then metric test ids.

## Safety checks
- DevTools Network should show no requests created by this script except normal X navigation initiated by changing `location.href`.
- No cookie/local credential is read or transmitted.
- CAPTCHA/authentication screens are not bypassed; stop collection and resolve them manually if X presents one.
