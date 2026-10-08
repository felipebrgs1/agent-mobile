import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Api, Connection, CreateSession, SessionInfo } from '../api';
import { applyCtrl, ExtraKeys } from '../components/ExtraKeys';
import { NewSessionSheet } from '../components/NewSessionSheet';
import { TabBar } from '../components/TabBar';
import { ConnStatus, TerminalHandle, TerminalView } from '../components/TerminalView';
import { mono, Theme } from '../theme';

type Props = {
  theme: Theme;
  conn: Connection;
  onDisconnect: () => void;
};

export function MainScreen({ theme, conn, onDisconnect }: Props) {
  const api = useMemo(() => new Api(conn), [conn]);
  const [host, setHost] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, ConnStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ctrlArmed, setCtrlArmed] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  const terminals = useRef<Record<string, TerminalHandle | null>>({});

  // Sessions live on the PC, so the tab list is always whatever the daemon has.
  const refresh = useCallback(async () => {
    try {
      const [health, list] = await Promise.all([api.health(), api.listSessions()]);
      setHost(health.host);
      setSessions(list);
      setActiveId((cur) => (cur && list.some((s) => s.id === cur) ? cur : (list[list.length - 1]?.id ?? null)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const create = async (req: CreateSession) => {
    const s = await api.createSession(req);
    setSessions((list) => [...list, s]);
    setActiveId(s.id);
  };

  const close = (s: SessionInfo) => {
    const kill = async () => {
      try {
        await api.deleteSession(s.id);
      } catch {
        // Already gone on the PC; drop it locally anyway.
      }
      delete terminals.current[s.id];
      const next = sessions.filter((x) => x.id !== s.id);
      setSessions(next);
      setActiveId((cur) => (cur === s.id ? (next[next.length - 1]?.id ?? null) : cur));
    };
    if (s.exited) return kill();
    Alert.alert('Fechar aba', `Encerrar "${s.name}" no PC?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Encerrar', style: 'destructive', onPress: kill },
    ]);
  };

  const menu = () => {
    Alert.alert(host ?? 'PC', conn.url, [
      { text: 'Fonte maior', onPress: () => setFontSize((f) => Math.min(f + 1, 22)) },
      { text: 'Fonte menor', onPress: () => setFontSize((f) => Math.max(f - 1, 8)) },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Desconectar', 'Esquecer este PC? As sessões continuam rodando nele.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Desconectar', style: 'destructive', onPress: onDisconnect },
          ]),
      },
      { text: 'Fechar', style: 'cancel' },
    ]);
  };

  const transformInput = useCallback(
    (data: string) => {
      if (!ctrlArmed) return data;
      setCtrlArmed(false);
      return applyCtrl(data);
    },
    [ctrlArmed],
  );

  const sendToActive = (data: string) => activeId && terminals.current[activeId]?.send(data);

  const activeStatus = activeId ? status[activeId] : undefined;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: theme.surface }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={menu} hitSlop={8} style={styles.hostBtn}>
            <View style={[styles.dot, { backgroundColor: error ? theme.danger : host ? theme.ok : theme.warn }]} />
            <Text style={[styles.host, { color: theme.text }]} numberOfLines={1}>
              {host ?? 'conectando…'}
            </Text>
            <Text style={{ color: theme.muted }}>▾</Text>
          </Pressable>
          {activeStatus === 'closed' && <Text style={[styles.badge, { color: theme.warn }]}>reconectando…</Text>}
        </View>

        <TabBar
          theme={theme}
          sessions={sessions}
          activeId={activeId}
          status={status}
          onSelect={setActiveId}
          onClose={close}
          onNew={() => setSheetOpen(true)}
        />

        <View style={[styles.flex, { backgroundColor: theme.terminal.background }]}>
          {sessions.map((s) => (
            <TerminalView
              key={s.id}
              ref={(h) => {
                terminals.current[s.id] = h;
              }}
              api={api}
              session={s}
              active={s.id === activeId}
              theme={theme}
              fontSize={fontSize}
              transformInput={transformInput}
              onStatus={(st) => setStatus((m) => ({ ...m, [s.id]: st }))}
              onExit={(code) =>
                setSessions((list) => list.map((x) => (x.id === s.id ? { ...x, exited: true, exitCode: code } : x)))
              }
            />
          ))}

          {sessions.length === 0 && (
            <View style={styles.empty}>
              {loading ? (
                <ActivityIndicator color={theme.muted} />
              ) : error ? (
                <>
                  <Text style={[styles.emptyText, { color: theme.danger }]}>{error}</Text>
                  <Pressable onPress={refresh} style={[styles.emptyBtn, { borderColor: theme.border }]}>
                    <Text style={{ color: theme.text }}>Tentar de novo</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.emptyText, { color: theme.muted }]}>Nenhuma sessão aberta no PC.</Text>
                  <Pressable onPress={() => setSheetOpen(true)} style={[styles.emptyBtn, { borderColor: theme.border }]}>
                    <Text style={{ color: theme.text }}>+ Nova aba</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>

        {activeId && (
          <ExtraKeys
            theme={theme}
            ctrlArmed={ctrlArmed}
            onToggleCtrl={() => setCtrlArmed((v) => !v)}
            onSend={sendToActive}
          />
        )}
      </KeyboardAvoidingView>

      <NewSessionSheet theme={theme} visible={sheetOpen} onClose={() => setSheetOpen(false)} onCreate={create} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  hostBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  host: { fontFamily: mono, fontSize: 14, flexShrink: 1 },
  badge: { fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  emptyBtn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
});
