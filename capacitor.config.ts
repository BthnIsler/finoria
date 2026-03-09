import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tr.finoria.app',
  appName: 'Finoria',
  // webDir is required by Capacitor CLI even when using server.url
  webDir: 'out',
  server: {
    // Use the live Vercel deployment so all Next.js API routes work
    url: 'https://finoria.vercel.app',
    cleartext: false,
    // Allow navigation back to the app
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0a1021',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a1021',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
  },
  android: {
    // Allow HTTP/HTTPS cleartext
    allowMixedContent: false,
    // Build-related
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
