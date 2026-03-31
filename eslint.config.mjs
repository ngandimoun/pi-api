import { createRequire } from "module";

const require = createRequire(import.meta.url);

/** @type {import("eslint").Linter.Config[]} */
const nextConfig = require("eslint-config-next");

const config = [
  ...nextConfig,
  {
    ignores: [
      ".trigger/**",
      "services/**/.venv/**",
      "services/**/venv/**",
      "services/**/__pycache__/**",
    ],
  },
];

export default config;
