import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/@firebase/firestore") ||
            id.includes("node_modules/firebase/firestore") ||
            id.includes("node_modules/firebase/firestore/lite")
          ) {
            return "firebase-firestore";
          }

          if (id.includes("node_modules/@firebase/database") || id.includes("node_modules/firebase/database")) {
            return "firebase-database";
          }

          if (id.includes("node_modules/firebase")) {
            return "firebase-core";
          }

          if (id.includes("node_modules/react")) {
            return "react-vendor";
          }
        },
      },
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: "./src/test/setup.js",
  },
});
