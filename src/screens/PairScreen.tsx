import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Api, Connection, normalizeUrl, saveConnection } from '../api';
import { mono, Theme } from '../theme';

type Props = {
  theme: Theme;
  initial?: Connection | null;
  onPaired: (conn: Connection) => void;
};

export function PairScreen({ theme, initial, onPaired }: Props) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [token, setToken] = useState(initial?.token ?? '');
  const [cfId, setCfId] = useState(initial?.cfClientId ?? '');
  const [cfSecret, setCfSecret] = useState(initial?.cfClientSecret ?? '');
  const [advanced, setAdvanced] = useState(!!initial?.cfClientId);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false); // the scanner fires several times per QR

  const connect = async (override?: Partial<Connection>) => {
    const conn: Connection = {
      url: normalizeUrl(override?.url ?? url),
      token: (override?.token ?? token).trim(),
      cfClientId: cfId.trim() || undefined,
      cfClientSecret: cfSecret.trim() || undefined,
    };
    setBusy(true);
    setError(null);
    try {
      const api = new Api(conn);
      await api.health();
      await api.listSessions(); // validates the token
      await saveConnection(conn);
      onPaired(conn);
    } catch (e) {
      setError((e as Error).message || 'Falha ao conectar');
    } finally {
      setBusy(false);
    }
  };

  const startScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return setError('Sem permissão de câmera');
    }
    scanned.current = false;
    setScanning(true);
  };

  const onScanned = ({ data }: { data: string }) => {
    if (scanned.current) return;
    scanned.current = true;
    setScanning(false);
    try {
      const parsed = JSON.parse(data) as { url: string; token: string };
      setUrl(parsed.url);
      setToken(parsed.token);
      connect(parsed);
    } catch {
      setError('QR code não reconhecido');
    }
  };

  if (scanning) {
    return (
      <View style={styles.flex}>
        <CameraView
          style={styles.flex}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
        <SafeAreaView edges={['bottom']} style={styles.scanFooter}>
          <Pressable onPress={() => setScanning(false)} style={[styles.button, { backgroundColor: theme.surface }]}>
            <Text style={[styles.buttonText, { color: theme.text }]}>Cancelar</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const input = [styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.border }];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.logo, { color: theme.text }]}>pocketterm</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            No PC, rode <Text style={{ fontFamily: mono, color: theme.text }}>pocketterm -pair -url https://…</Text> e
            escaneie o QR code.
          </Text>

          <Pressable onPress={startScan} style={[styles.button, { backgroundColor: theme.accent }]}>
            <Text style={[styles.buttonText, { color: theme.accentText }]}>Escanear QR code</Text>
          </Pressable>

          <Text style={[styles.divider, { color: theme.muted }]}>ou digite</Text>

          <Text style={[styles.label, { color: theme.muted }]}>URL do túnel</Text>
          <TextInput value={url} onChangeText={setUrl} placeholder="https://term.seudominio.com" placeholderTextColor={theme.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={input} />

          <Text style={[styles.label, { color: theme.muted }]}>token</Text>
          <TextInput value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry style={input} />

          <Pressable onPress={() => setAdvanced((v) => !v)}>
            <Text style={[styles.link, { color: theme.muted }]}>
              {advanced ? '▾' : '▸'} Cloudflare Access (service token)
            </Text>
          </Pressable>
          {advanced && (
            <>
              <Text style={[styles.label, { color: theme.muted }]}>CF-Access-Client-Id</Text>
              <TextInput value={cfId} onChangeText={setCfId} autoCapitalize="none" autoCorrect={false} style={input} />
              <Text style={[styles.label, { color: theme.muted }]}>CF-Access-Client-Secret</Text>
              <TextInput value={cfSecret} onChangeText={setCfSecret} autoCapitalize="none" autoCorrect={false} secureTextEntry style={input} />
            </>
          )}

          {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

          <Pressable
            disabled={busy || !url || !token}
            onPress={() => connect()}
            style={[styles.button, { backgroundColor: theme.surfaceAlt, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, opacity: busy || !url || !token ? 0.5 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: theme.text }]}>{busy ? 'Conectando…' : 'Conectar'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, gap: 10, paddingTop: 48 },
  logo: { fontFamily: mono, fontSize: 28 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  divider: { textAlign: 'center', fontSize: 12, marginVertical: 8 },
  label: { fontSize: 12, marginTop: 4 },
  input: { fontFamily: mono, fontSize: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  link: { fontSize: 13, marginTop: 8 },
  error: { fontSize: 13 },
  button: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  buttonText: { fontSize: 15, fontWeight: '600' },
  scanFooter: { position: 'absolute', left: 24, right: 24, bottom: 24 },
});
