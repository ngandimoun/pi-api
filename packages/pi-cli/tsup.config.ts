import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    hokage: "src/hokage.ts",
  },
  format: ["esm"],
  target: "node18",
  clean: true,
  sourcemap: process.env.PI_CLI_DEV === "1",
  dts: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  noExternal: ["pi-routine-spec", "yaml"],
  external: [
    "conf",
    "chokidar",
    "execa",
    "simple-git",
    "ts-morph",
    "@clack/prompts",
    "boxen",
    "cac",
    "chalk",
    "cli-spinners",
    "clipboardy",
    "fast-glob",
    "gradient-string",
    "marked",
    "marked-terminal",
  ],
});
