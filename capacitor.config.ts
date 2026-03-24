import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.towerdefense.rpg',
  appName: 'Tower Defense RPG',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#1a1a2e',
  },
  plugins: {
    // Mantener pantalla encendida durante el juego
    KeepAwake: {
      isKeptAwake: true,
    },
  },
};

export default config;
