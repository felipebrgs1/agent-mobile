import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SessionInfo } from '../api';
import { mono, Theme } from '../theme';
import { ConnStatus } from './TerminalView';

type Props = {
  theme: Theme;
  sessions: SessionInfo[];
  activeId: string | null;
  status: Record<string, ConnStatus>;
  onSelect: (id: string) => void;
  onClose: (session: SessionInfo) => void;
  onNew: () => void;
};

const KIND_ICON: Record<string, string> = { shell: '$', claude: '✳', ssh: '⇄', custom: '›' };

export function TabBar({ theme, sessions, activeId, status, onSelect, onClose, onNew }: Props) {
  const dotColor = (s: SessionInfo) => {
    const st = s.exited ? 'exited' : status[s.id];
    if (st === 'open') return theme.ok;
    if (st === 'exited') return theme.muted;
    if (st === 'closed') return theme.danger;
    return theme.warn;
  };

  return (
    <View style={[styles.bar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {sessions.map((s) => {
          const active = s.id === activeId;
          return (
            <Pressable
              key={s.id}
              onPress={() => onSelect(s.id)}
              onLongPress={() => onClose(s)}
              style={[styles.tab, { backgroundColor: active ? theme.surfaceAlt : 'transparent', borderColor: active ? theme.border : 'transparent' }]}
            >
              <View style={[styles.dot, { backgroundColor: dotColor(s) }]} />
              <Text style={[styles.icon, { color: theme.muted }]}>{KIND_ICON[s.kind] ?? '$'}</Text>
              <Text numberOfLines={1} style={[styles.name, { color: active ? theme.text : theme.muted }]}>
                {s.name}
              </Text>
              {active && (
                <Pressable hitSlop={10} onPress={() => onClose(s)}>
                  <Text style={[styles.close, { color: theme.muted }]}>×</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable onPress={onNew} style={[styles.newBtn, { borderLeftColor: theme.border }]} hitSlop={6}>
        <Text style={[styles.plus, { color: theme.text }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  tabs: { paddingHorizontal: 6, paddingVertical: 6, gap: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, maxWidth: 200 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  icon: { fontFamily: mono, fontSize: 12 },
  name: { fontFamily: mono, fontSize: 13, flexShrink: 1 },
  close: { fontSize: 18, lineHeight: 20, marginLeft: 2 },
  newBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth },
  plus: { fontSize: 22, fontWeight: '300' },
});
