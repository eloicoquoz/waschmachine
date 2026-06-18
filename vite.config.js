// vite.config.js  —  Waschmachine
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name:             "Waschmachine",
        short_name:       "Waschmachine",
        description:      "Waschmachine Volleyball Club — tournois, chat & feed",
        theme_color:      "#0F1A2A",
        background_color: "#151F2E",
        display:          "standalone",
        orientation:      "portrait",
        start_url:        "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cache app shell for offline
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // Firestore reads work offline
            urlPattern: /^https:\/\/firestore\.googleapis\.com/,
            handler: "NetworkFirst",
            options: { cacheName: "firestore-cache" },
          },
          {
            // Firebase Storage images/videos
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com/,
            handler: "CacheFirst",
            options: { cacheName: "storage-cache", expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 } },
          },
        ],
      },
      // Required for FCM push notifications
      devOptions: { enabled: true },
    }),
  ],
});
