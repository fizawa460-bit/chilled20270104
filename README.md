# X Post Collector PoC

X（旧Twitter）に**自分で通常ログイン済みのChrome**で、X検索画面に表示された公開投稿をDOMから整理・保存するTampermonkey PoCです。X API、外部検索、Cookie転送、認証回避、CAPTCHA回避は行いません。

## 現在の機能
- 対象ユーザー、開始日、終了日、複数検索語を画面パネルから指定
- `from:<user> <keyword> since:<date> until:<date>` を検索語ごとに順次実行
- `f=live` を付けて「最新」検索を優先
- `article` / `time` / `/status/` / `data-testid` を中心にDOM抽出
- status IDを主キーに重複除去し、`matchedKeywords` は全検索語を保持
- 返信/引用の判定、可能な場合は返信数・リポスト数・いいね数も取得
- 自動スクロール（ランダム待機）、無限ループ防止
- IndexedDBへ逐次保存し、ブラウザを閉じても再開可能
- JSON / CSV / TXT export
- 現在の検索語、取得件数、重複ヒット数、最古投稿日、スクロール回数を表示
- ログON/OFF

## Tampermonkeyへの導入
1. ChromeにTampermonkeyを入れます。
2. このrepoの `userscript/x-post-collector.user.js` を開き、内容をTampermonkeyの新規スクリプトへ貼り付けて保存します。
3. ChromeでXへ通常どおりログインします。
4. `https://x.com/search` を開き、Tampermonkeyでスクリプトが有効になっていることを確認します。
5. 右上に出る **X Post Collector PoC** パネルへユーザー／期間／検索語を入力し、**収集開始**を押します。
6. 完了後、JSON / CSV / TXTボタンで保存します。

## 最初の実証テスト
初期値は次の通りです。
- ユーザー: `yuukamiya68`
- 開始日: `2016-08-01`
- 終了日: `2016-09-02`
- 検索語: `子供`

Xの `until:` は排他的です。上記は2016-09-02より前を対象にします。X内部検索で確認済みの2016-08-10、08-17、08-19、08-21、09-01付近の投稿がJSON等へ入ればPoC成功です。

## 複数検索語
検索語欄は1行1件です。例:

```text
子供
赤ちゃん
娘
育児
子育て
育児休暇
育児疲れ
育児当番
ミルク
おむつ
離乳食
夜泣き
抱っこ
寝かしつけ
ハイハイ
つかまり立ち
保育園
```

同じstatus IDが複数語で見つかった場合、投稿レコードは1件だけ保持し、`matchedKeywords` にヒット語を追加します。

## 途中再開
収集状態と投稿はIndexedDB `x-post-collector` に保存します。停止・タブ終了・ブラウザ終了後にX検索画面を開き、**続きから再開**を押してください。同じstatus IDは再登録せず、検索語だけ統合します。**収集開始**は新しいrun設定を開始しますが、既存投稿DBは消しません。

## 停止条件
- 停止ボタン
- 8回連続で新規投稿が増えない
- 開始日より古い投稿へ到達
- 1検索語あたり最大120スクロール

スクロール待機は約1.4〜3.2秒のランダムです。X側がログイン確認、レート制限、CAPTCHA等を出した場合、このツールは回避せず停止してください。

## 取得データ
`statusId`, `username`, `displayName`, `postedAt`, `text`, `url`, `matchedKeywords`, `isReply`, `isQuote`, `metrics.replies`, `metrics.reposts`, `metrics.likes`, `collectedAt`。

## XのDOM変更で壊れた場合
まず `src/parser.js` とuserscript内の `parseArticle()` を確認します。依存箇所は主に `article`, `time[datetime]`, `a[href*="/status/"]`, `[data-testid="tweetText"]`, `[data-testid="User-Name"]`, `reply/retweet/like` です。生成CSS class名には依存しません。

## 構成
- `src/parser.js` DOM抽出
- `src/storage.js` IndexedDB
- `src/exporter.js` JSON/CSV/TXT
- `src/ui.js` 操作パネル
- `src/collector.js` 検索URL・スクロール制御
- `userscript/x-post-collector.user.js` Tampermonkeyでそのまま動く単体版
- `docs/SPEC.md` 設計
- `docs/TESTING.md` 手動テスト

将来Chrome拡張へ移す場合は `src/` を再利用し、userscript固有の起動部分だけ差し替える想定です。
