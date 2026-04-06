import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["@monaco-editor/react", "monaco-editor"],
  },
  build: {
    rollupOptions: {
      output: {
        // Split monaco into its own chunk to avoid huge bundles
        manualChunks: {
          "monaco-editor": ["monaco-editor"],
        },
      },
    },
  },
  worker: {
    format: "es",
  },
});
