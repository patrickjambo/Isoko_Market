/**
 * Capacitor configuration for Zenova native apps (Android + iOS).
 *
 * Strategy: "remote" mode — the native shell loads zenova.rw in a WebView.
 * This means:
 *   - No static export needed (server-side features, auth, Prisma all work)
 *   - One codebase serves web, Android (Play Store) and iOS (App Store)
 *   - Updates deploy to production without app store review
 *   - Internet connection required (same as web — this is a marketplace, not offline-first)
 *
 * To build:
 *   npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
 *   npx cap add android   # first time only
 *   npx cap add ios       # first time only (requires Mac + Xcode)
 *   npx cap sync          # after any config change
 *   npx cap open android  # open in Android Studio → Build signed AAB
 *   npx cap open ios      # open in Xcode → Archive → Distribute
 *
 * @type {import('@capacitor/cli').CapacitorConfig}
 */
const config = {
  appId: 'rw.zenova.app',
  appName: 'Zenova',

  // webDir is unused in remote mode but required by the CLI
  webDir: 'out',

  server: {
    // Load the live production site inside the native WebView.
    // Change to 'http://10.0.2.2:3000' for local Android emulator testing.
    url: 'https://zenova.rw',
    cleartext: false, // HTTPS only in production
  },

  ios: {
    // Safe area insets — prevents content hiding behind iPhone notch / Dynamic Island
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
    // Use the user's preferred content size (respects iOS accessibility settings)
    preferredContentMode: 'mobile',
    // Allow navigation within zenova.rw — block all other domains
    allowsLinkPreview: false,
  },

  android: {
    backgroundColor: '#ffffff',
    // Allow mixed content only in debug builds (enforced by server HSTS anyway)
    allowMixedContent: false,
    // Capture input for chat/search fields
    captureInput: true,
    // Show webview debugging in Chrome DevTools during development
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    // Push notifications — optional, add @capacitor/push-notifications to enable
    // PushNotifications: {
    //   presentationOptions: ['badge', 'sound', 'alert'],
    // },

    // Share sheet — lets users share listings
    // SplashScreen: {
    //   launchShowDuration: 1500,
    //   backgroundColor: '#ffffff',
    //   androidSplashResourceName: 'splash',
    //   splashFullScreen: true,
    //   splashImmersive: true,
    // },
  },
};

// eslint-disable-next-line import/no-default-export
export default config;
