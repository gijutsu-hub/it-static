import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.itstatic",
  appName: "IT'S STATIC",
  webDir: "out",
  // Point to the live server so native app loads the deployed web app
  server: {
    url: "https://itstatic.app",
    cleartext: false,
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#fbf8fc",
  },
  android: {
    backgroundColor: "#fbf8fc",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#fbf8fc",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Geolocation: {
      permissions: ["location"],
    },
  },
};

export default config;
