import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Api, SessionInfo } from '../api';
import { terminalHtml } from '../terminalHtml';
import { Theme } from '../theme';

export type ConnStatus = 'connecting' | 'open' | 'closed' | 'exited';

export type TerminalHandle = {
  send: (data: string) => void;
  focus: () => void;
};

type Props = {
  api: Api;
  session: SessionInfo;
  active: boolean;
  theme: Theme;
  fontSize: number;
  /** Rewrites typed input, e.g. to apply a sticky Ctrl from the extra-keys bar. */
  transformInput?: (data: string) => string;
  onStatus?: (status: ConnStatus) => void;
  onExit?: (code: number) => void;
};

const MAX_BACKOFF = 10_000;

export const TerminalView = forwardRef<TerminalHandle, Props>(function TerminalView(
  { api, session, active, theme, fontSize, transformInput, onStatus, onExit },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ready = useRef(false);
  const queue = useRef<object[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const size = useRef<{ cols: number; rows: number } | null>(null);
  const exited = useRef(session.exited);
  const backoff = useRef(1000);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);
  const reloaded = useRef(false);

  // Keep latest callbacks without re-running the socket effect.
  const cb = useRef({ transformInput, onStatus, onExit });
  cb.current = { transformInput, onStatus, onExit };

  // The page is built once; later theme/font changes are pushed as messages
  // so the WebView doesn't reload and lose the screen.
  const [html] = useState(() => terminalHtml(theme.terminal, fontSize));

  // Batch messages to the WebView so a burst of output becomes one bridge call.
  const toPage = useCallback((msg: object) => {
    queue.current.push(msg);
    if (!ready.current || flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      const batch = queue.current;
      queue.current = [];
      if (batch.length === 0) return;
      const js = batch.map((m) => `window.recv(${JSON.stringify(m)});`).join('');
      webRef.current?.injectJavaScript(js + 'true;');
    }, 16);
  }, []);

  const sendWs = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const connect = useCallback(() => {
    if (unmounted.current || exited.current) return;
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    const prev = wsRef.current;
    if (prev && (prev.readyState === WebSocket.OPEN || prev.readyState === WebSocket.CONNECTING)) return;

    cb.current.onStatus?.('connecting');
    const ws = api.openSocket(session.id);
    wsRef.current = ws;

    ws.onopen = () => {
      backoff.current = 1000;
      cb.current.onStatus?.('open');
      if (size.current) ws.send(JSON.stringify({ type: 'resize', ...size.current }));
    };

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string);
      switch (msg.type) {
        case 'replay':
          toPage({ type: 'reset' });
          if (msg.data) toPage({ type: 'write', data: msg.data });
          break;
        case 'output':
          toPage({ type: 'write', data: msg.data });
          break;
        case 'exit':
          exited.current = true;
          toPage({ type: 'text', data: `\r\n\x1b[2m[processo encerrado · código ${msg.code}]\x1b[0m\r\n` });
          cb.current.onStatus?.('exited');
          cb.current.onExit?.(msg.code);
          break;
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      if (unmounted.current || exited.current) return;
      cb.current.onStatus?.('closed');
      const delay = backoff.current;
      backoff.current = Math.min(delay * 2, MAX_BACKOFF);
      retryTimer.current = setTimeout(connect, delay);
    };
  }, [api, session.id, toPage]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    // Phones drop sockets in the background; reconnect as soon as we're back.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        backoff.current = 1000;
        connect();
      }
    });
    return () => {
      unmounted.current = true;
      sub.remove();
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  useEffect(() => {
    toPage({ type: 'theme', theme: theme.terminal });
  }, [theme, toPage]);

  useEffect(() => {
    toPage({ type: 'fontSize', size: fontSize });
  }, [fontSize, toPage]);

  useEffect(() => {
    if (active) toPage({ type: 'fit' });
  }, [active, toPage]);

  useImperativeHandle(
    ref,
    () => ({
      send: (data: string) => sendWs({ type: 'input', data }),
      focus: () => toPage({ type: 'focus' }),
    }),
    [sendWs, toPage],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = JSON.parse(e.nativeEvent.data);
    switch (msg.type) {
      case 'ready':
        if (reloaded.current) {
          // The page was rebuilt (e.g. WebView process killed): reconnect to get a fresh replay.
          reloaded.current = false;
          const ws = wsRef.current;
          wsRef.current = null;
          ws?.close();
          connect();
        }
        ready.current = true;
        size.current = { cols: msg.cols, rows: msg.rows };
        sendWs({ type: 'resize', ...size.current });
        toPage({ type: 'fit' }); // also flushes anything queued before the page was ready
        break;
      case 'input': {
        const data = cb.current.transformInput ? cb.current.transformInput(msg.data) : msg.data;
        sendWs({ type: 'input', data });
        break;
      }
      case 'resize':
        size.current = { cols: msg.cols, rows: msg.rows };
        sendWs({ type: 'resize', ...size.current });
        break;
      case 'error':
        console.warn(msg.message);
        break;
    }
  };

  return (
    <View
      style={[StyleSheet.absoluteFill, { opacity: active ? 1 : 0 }]}
      pointerEvents={active ? 'auto' : 'none'}
    >
      <WebView
        ref={webRef}
        source={{ html, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        style={{ backgroundColor: theme.terminal.background }}
        containerStyle={{ backgroundColor: theme.terminal.background }}
        javaScriptEnabled
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        automaticallyAdjustContentInsets={false}
        textInteractionEnabled={false}
        setSupportMultipleWindows={false}
        autoManageStatusBarEnabled={false}
        onLoadStart={() => {
          if (ready.current) reloaded.current = true;
          ready.current = false;
        }}
        onContentProcessDidTerminate={() => webRef.current?.reload()}
        onRenderProcessGone={() => webRef.current?.reload()}
      />
    </View>
  );
});
