import { resolve } from "node:path";
import { codecovVitePlugin } from "@codecov/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "promptops-gui",
      uploadToken: process.env.CODECOV_TOKEN,
      gitService: "github",
    }),
  ],
  build: {
    outDir: "coverage/bundle-analysis",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "scripts/codecov-bundle-entry.ts"),
      formats: ["es"],
      fileName: "bundle",
    },
  },
});
