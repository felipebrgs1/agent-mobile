import * as Clipboard from 'expo-clipboard';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { mono, Theme } from '../theme';

type Key = { label: string; seq?: string; action?: 'ctrl' | 'paste' };

// Keys a phone keyboard lacks. ⇧Tab cycles modes in Claude Code.
const KEYS: Key[] = [
  { label: 'esc', seq: '\x1b' },
  { label: 'ctrl', action: 'ctrl' },
  { label: 'tab', seq: '\t' },
  { label: '⇧tab', seq: '\x1b[Z' },
  { label: '↑', seq: '\x1b[A' },
  { label: '↓', seq: '\x1b[B' },
  { label: '←', seq: '\x1b[D' },
  { label: '→', seq: '\x1b[C' },
  { label: '^C', seq: '\x03' },
  { label: '^D', seq: '\x04' },
  { label: 'colar', action: 'paste' },
  { label: '|', seq: '|' },
  { label: '~', seq: '~' },
  { label: '/', seq: '/' },
  { label: '-', seq: '-' },
  { label: 'home', seq: '\x1b[H' },
  { label: 'end', seq: '\x1b[F' },
  { label: 'pgup', seq: '\x1b[5~' },
  { label: 'pgdn', seq: '\x1b[6~' },
];

/** Turns a typed character into its control code when Ctrl is armed (a → ^A). */
export function applyCtrl(data: string): string {
  if (data.length !== 1) return data;
  const code = data.toUpperCase().charCodeAt(0);
  if (code >= 0x40 && code <= 0x5f) return String.fromCharCode(code & 0x1f);
  if (data === ' ') return '\x00';
  if (data === '?') return '\x7f';
  return data;
}

type Props = {
  theme: Theme;
  ctrlArmed: boolean;
  onToggleCtrl: () => void;
  onSend: (data: string) => void;
};

export function ExtraKeys({ theme, ctrlArmed, onToggleCtrl, onSend }: Props) {
  const press = async (key: Key) => {
    if (key.action === 'ctrl') return onToggleCtrl();
    if (key.action === 'paste') {
      const text = await Clipboard.getStringAsync();
      // Bracketed paste keeps shells and Claude Code from running each line as it arrives.
      if (text) onSend(`\x1b[200~${text}\x1b[201~`);
      return;
    }
    if (key.seq) onSend(ctrlArmed ? applyCtrl(key.seq) : key.seq);
    if (ctrlArmed) onToggleCtrl();
  };

  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}
      contentContainerStyle={styles.content}
    >
      {KEYS.map((key) => {
        const on = key.action === 'ctrl' && ctrlArmed;
        return (
          <Pressable
            key={key.label}
            onPress={() => press(key)}
            style={({ pressed }) => [
              styles.key,
              { backgroundColor: on ? theme.accent : pressed ? theme.border : theme.surfaceAlt },
            ]}
          >
            <Text style={[styles.label, { color: on ? theme.accentText : theme.text }]}>{key.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { flexGrow: 0, borderTopWidth: StyleSheet.hairlineWidth },
  content: { paddingHorizontal: 6, paddingVertical: 6, gap: 6 },
  key: { minWidth: 40, height: 34, paddingHorizontal: 10, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: mono, fontSize: 13 },
});
