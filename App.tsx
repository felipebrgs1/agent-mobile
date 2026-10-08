import { JetBrainsMono_400Regular, JetBrainsMono_700Bold, useFonts } from '@expo-google-fonts/jetbrains-mono';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { clearConnection, Connection, loadConnection } from './src/api';
import { MainScreen } from './src/screens/MainScreen';
import { PairScreen } from './src/screens/PairScreen';
import { useTheme } from './src/theme';

export default function App() {
  const theme = useTheme();
  const [fontsLoaded] = useFonts({ JetBrainsMono_400Regular, JetBrainsMono_700Bold });
  const [conn, setConn] = useState<Connection | null | undefined>(undefined);

  useEffect(() => {
    loadConnection().then(setConn, () => setConn(null));
  }, []);

  const disconnect = async () => {
    await clearConnection();
    setConn(null);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {!fontsLoaded || conn === undefined ? (
        <View style={{ flex: 1, backgroundColor: theme.bg }} />
      ) : conn ? (
        <MainScreen theme={theme} conn={conn} onDisconnect={disconnect} />
      ) : (
        <PairScreen theme={theme} onPaired={setConn} />
      )}
    </SafeAreaProvider>
  );
}
