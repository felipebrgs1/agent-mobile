import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CreateSession } from '../api';
import { mono, Theme } from '../theme';

type Profile = {
  kind: string;
  title: string;
  hint: string;
  field?: { label: string; placeholder: string };
  build: (value: string) => Pick<CreateSession, 'name' | 'script'>;
};

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const PROFILES: Profile[] = [
  { kind: 'shell', title: 'Terminal', hint: 'seu shell padrão', build: () => ({ name: 'shell' }) },
  { kind: 'claude', title: 'Claude Code', hint: 'nova sessão do claude', build: () => ({ name: 'claude', script: 'claude' }) },
  { kind: 'claude', title: 'Claude Code (continuar)', hint: 'retoma a última conversa', build: () => ({ name: 'claude', script: 'claude --continue' }) },
  {
    kind: 'ssh',
    title: 'SSH',
    hint: 'conecta a partir do PC, com as chaves dele',
    field: { label: 'host', placeholder: 'usuario@servidor ou alias do ~/.ssh/config' },
    build: (host) => ({ name: host, script: `ssh ${shellQuote(host)}` }),
  },
  {
    kind: 'custom',
    title: 'Comando',
    hint: 'qualquer comando (htop, docker logs -f …)',
    field: { label: 'comando', placeholder: 'htop' },
    build: (cmd) => ({ name: cmd.split(' ')[0], script: cmd }),
  },
];

type Props = {
  theme: Theme;
  visible: boolean;
  onClose: () => void;
  onCreate: (req: CreateSession) => Promise<void>;
};

export function NewSessionSheet({ theme, visible, onClose, onCreate }: Props) {
  const [selected, setSelected] = useState(0);
  const [value, setValue] = useState('');
  const [cwd, setCwd] = useState('~');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = PROFILES[selected];
  const canCreate = !busy && (!profile.field || value.trim().length > 0);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreate({ ...profile.build(value.trim()), kind: profile.kind, cwd: cwd.trim() || '~' });
      setValue('');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.border }];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Nova aba</Text>

          {PROFILES.map((p, i) => {
            const on = i === selected;
            return (
              <Pressable
                key={p.title}
                onPress={() => setSelected(i)}
                style={[styles.option, { borderColor: on ? theme.accent : theme.border, backgroundColor: on ? theme.surfaceAlt : 'transparent' }]}
              >
                <Text style={[styles.optTitle, { color: theme.text }]}>{p.title}</Text>
                <Text style={[styles.optHint, { color: theme.muted }]}>{p.hint}</Text>
              </Pressable>
            );
          })}

          {profile.field && (
            <>
              <Text style={[styles.label, { color: theme.muted }]}>{profile.field.label}</Text>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder={profile.field.placeholder}
                placeholderTextColor={theme.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={input}
              />
            </>
          )}

          <Text style={[styles.label, { color: theme.muted }]}>diretório</Text>
          <TextInput value={cwd} onChangeText={setCwd} autoCapitalize="none" autoCorrect={false} style={input} />

          {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

          <Pressable
            disabled={!canCreate}
            onPress={submit}
            style={[styles.button, { backgroundColor: theme.accent, opacity: canCreate ? 1 : 0.4 }]}
          >
            <Text style={[styles.buttonText, { color: theme.accentText }]}>{busy ? 'Abrindo…' : 'Abrir'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, paddingBottom: 32, gap: 8 },
  title: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  option: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  optTitle: { fontSize: 15, fontWeight: '500' },
  optHint: { fontSize: 12, marginTop: 2 },
  label: { fontSize: 12, marginTop: 6 },
  input: { fontFamily: mono, fontSize: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  error: { fontSize: 13 },
  button: { marginTop: 8, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
