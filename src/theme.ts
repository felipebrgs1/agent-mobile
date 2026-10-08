import { useColorScheme } from 'react-native';

export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  ok: string;
  warn: string;
  danger: string;
  terminal: Record<string, string>;
};

const dark: Theme = {
  dark: true,
  bg: '#0e0e0e',
  surface: '#161616',
  surfaceAlt: '#1f1f1f',
  border: '#2a2a2a',
  text: '#e6e6e6',
  muted: '#8a8a8a',
  accent: '#e6e6e6',
  accentText: '#0e0e0e',
  ok: '#7fb38a',
  warn: '#c9a96a',
  danger: '#d27a72',
  terminal: {
    background: '#0e0e0e',
    foreground: '#dcdcdc',
    cursor: '#e6e6e6',
    cursorAccent: '#0e0e0e',
    selectionBackground: '#3a3a3a',
    black: '#1c1c1c',
    red: '#d27a72',
    green: '#8fb98f',
    yellow: '#d2b97a',
    blue: '#86a3c3',
    magenta: '#b294bb',
    cyan: '#8abeb7',
    white: '#c8c8c8',
    brightBlack: '#5c5c5c',
    brightRed: '#e09089',
    brightGreen: '#a6cba6',
    brightYellow: '#e2cb92',
    brightBlue: '#9db8d6',
    brightMagenta: '#c6aacd',
    brightCyan: '#a2d1ca',
    brightWhite: '#f0f0f0',
  },
};

const light: Theme = {
  dark: false,
  bg: '#f7f7f7',
  surface: '#ffffff',
  surfaceAlt: '#efefef',
  border: '#e0e0e0',
  text: '#171717',
  muted: '#737373',
  accent: '#171717',
  accentText: '#f7f7f7',
  ok: '#3f8a50',
  warn: '#a07a2c',
  danger: '#b5483f',
  terminal: {
    background: '#fbfbfb',
    foreground: '#262626',
    cursor: '#171717',
    cursorAccent: '#fbfbfb',
    selectionBackground: '#d6d6d6',
    black: '#262626',
    red: '#b5483f',
    green: '#3f7f4a',
    yellow: '#8a6a1f',
    blue: '#3d6896',
    magenta: '#7d5689',
    cyan: '#2f7a72',
    white: '#a3a3a3',
    brightBlack: '#6b6b6b',
    brightRed: '#c9554b',
    brightGreen: '#4c9459',
    brightYellow: '#a07a2c',
    brightBlue: '#4a7aad',
    brightMagenta: '#916aa0',
    brightCyan: '#3a8f86',
    brightWhite: '#d4d4d4',
  },
};

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark;
}

export const mono = 'JetBrainsMono_400Regular';
export const monoBold = 'JetBrainsMono_700Bold';
