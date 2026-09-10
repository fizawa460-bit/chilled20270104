export function createPanel(defaults, handlers) {
  const root = document.createElement('div');
  root.id = 'xpc-panel';
  root.innerHTML = `
    <style>
      #xpc-panel{position:fixed;right:14px;top:70px;z-index:2147483647;width:290px;background:#111;color:#eee;border:1px solid #555;border-radius:10px;padding:10px;font:12px/1.35 system-ui;box-shadow:0 4px 20px #0008}
      #xpc-panel input,#xpc-panel textarea{box-sizing:border-box;width:100%;margin:2px 0 7px;background:#222;color:#fff;border:1px solid #555;border-radius:5px;padding:5px}
      #xpc-panel textarea{height:92px;resize:vertical}
      #xpc-panel button{appearance:none!important;-webkit-appearance:none!important;margin:2px!important;padding:6px 9px!important;cursor:pointer!important;background:#1d9bf0!important;color:#fff!important;border:1px solid #1d9bf0!important;border-radius:6px!important;font:600 12px/1.2 system-ui!important;opacity:1!important;-webkit-text-fill-color:#fff!important}
      #xpc-panel button:hover{filter:brightness(.92)}
      #xpc-panel .xpc-row{display:flex;gap:4px;flex-wrap:wrap}
      #xpc-panel .xpc-stats{margin-top:7px;padding-top:7px;border-top:1px solid #444;white-space:pre-line}
    </style>
    <b>X Post Collector PoC</b>
    <label>ユーザー名<input data-k="username" value="${defaults.username}"></label>
    <label>開始日<input data-k="startDate" type="date" value="${defaults.startDate}"></label>
    <label>終了日 (until・排他的)<input data-k="endDate" type="date" value="${defaults.endDate}"></label>
    <label>検索語（1行1件）<textarea data-k="keywords">${defaults.keywords.join('\n')}</textarea></label>
    <label><input data-k="logging" type="checkbox" style="width:auto" ${defaults.logging ? 'checked' : ''}> ログON</label>
    <div class="xpc-row"><button data-a="start">収集開始</button><button data-a="resume">続きから再開</button><button data-a="stop">停止</button></div>
    <div class="xpc-row"><button data-a="json">JSON</button><button data-a="csv">CSV</button><button data-a="txt">TXT</button></div>
    <div class="xpc-stats" data-role="stats">待機中</div>`;
  document.body.appendChild(root);

  const readConfig = () => ({
    username: root.querySelector('[data-k="username"]').value.trim().replace(/^@/, ''),
    startDate: root.querySelector('[data-k="startDate"]').value,
    endDate: root.querySelector('[data-k="endDate"]').value,
    keywords: root.querySelector('[data-k="keywords"]').value.split(/\n/).map((s) => s.trim()).filter(Boolean),
    logging: root.querySelector('[data-k="logging"]').checked,
  });

  root.addEventListener('click', (e) => {
    const action = e.target?.dataset?.a;
    if (!action || !handlers[action]) return;
    handlers[action](readConfig());
  });

  return {
    root,
    setStats(text) { root.querySelector('[data-role="stats"]').textContent = text; },
    readConfig,
  };
}
