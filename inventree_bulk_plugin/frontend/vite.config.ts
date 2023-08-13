import { readdirSync } from "fs";
import { resolve, parse } from "path";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

// read all pages from src/pages/*
const basePath = resolve(__dirname, "src/pages/");
const inputs = Object.fromEntries(readdirSync(basePath).map((f) => [parse(f).name, resolve(basePath, f)]));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],
  build: {
    manifest: false,
    rollupOptions: {
      input: inputs,
      output: {
        dir: resolve(__dirname, "../static/inventree-bulk-plugin/dist"),
        entryFileNames: "[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
      preserveEntrySignatures: "exports-only",
    },
    cssCodeSplit: false,
  },
});
