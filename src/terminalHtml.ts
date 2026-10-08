// Page loaded inside the WebView. It only renders: the WebSocket lives in React Native
// (so it can send auth headers), and bytes are relayed here through injectJavaScript.
//
//   RN → page:  window.recv({type: 'write', data: base64} | {type: 'reset'} | {type: 'theme', ...} | ...)
//   page → RN:  ReactNativeWebView.postMessage({type: 'ready' | 'input' | 'resize', ...})

const XTERM = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0';
const FIT = 'https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.11.0';

export function terminalHtml(theme: Record<string, string>, fontSize: number) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=block" rel="stylesheet" />
<link rel="stylesheet" href="${XTERM}/css/xterm.css" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: ${theme.background}; }
  #term { position: absolute; inset: 4px 2px 0 6px; }
  .xterm .xterm-viewport { scrollbar-width: none; }
  .xterm .xterm-viewport::-webkit-scrollbar { display: none; }
</style>
</head>
<body>
<div id="term"></div>
<script src="${XTERM}/lib/xterm.js"></script>
<script src="${FIT}/lib/addon-fit.js"></script>
<script>
(function () {
  function post(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  if (typeof Terminal === 'undefined') {
    post({ type: 'error', message: 'Não foi possível carregar o xterm.js (sem internet?)' });
    return;
  }

  var term = new Terminal({
    fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
    fontSize: ${fontSize},
    lineHeight: 1.15,
    cursorBlink: true,
    scrollback: 5000,
    allowProposedApi: true,
    theme: ${JSON.stringify(theme)},
  });
  var fit = new FitAddon.FitAddon();
  term.loadAddon(fit);

  var lastCols = 0, lastRows = 0;
  function refit() {
    try { fit.fit(); } catch (e) { return; }
    if (term.cols !== lastCols || term.rows !== lastRows) {
      lastCols = term.cols; lastRows = term.rows;
      post({ type: 'resize', cols: term.cols, rows: term.rows });
    }
  }

  function decode(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  window.recv = function (msg) {
    switch (msg.type) {
      case 'write': term.write(decode(msg.data)); break;
      case 'text': term.write(msg.data); break;
      case 'reset': term.reset(); break;
      case 'focus': term.focus(); break;
      case 'blur': term.blur(); break;
      case 'fit': lastCols = 0; refit(); break;
      case 'theme': term.options.theme = msg.theme; document.body.style.background = msg.theme.background; break;
      case 'fontSize': term.options.fontSize = msg.size; refit(); break;
    }
  };

  function start() {
    term.open(document.getElementById('term'));
    term.onData(function (data) { post({ type: 'input', data: data }); });
    term.onBinary(function (data) { post({ type: 'input', data: data }); });
    new ResizeObserver(refit).observe(document.getElementById('term'));
    refit();
    post({ type: 'ready', cols: term.cols, rows: term.rows });
  }

  // Measure cell size only after the font is in, otherwise columns come out wrong.
  var started = false;
  function once() { if (!started) { started = true; start(); } }
  if (document.fonts && document.fonts.load) {
    document.fonts.load('${fontSize}px "JetBrains Mono"').then(once, once);
    setTimeout(once, 1500);
  } else {
    once();
  }
})();
</script>
</body>
</html>`;
}
