declare module "marked-terminal" {
  import type { MarkedExtension } from "marked";

  /** Options accepted by `markedTerminal` — kept permissive since upstream
   *  publishes no types. See https://github.com/mikaelbr/marked-terminal. */
  export type MarkedTerminalOptions = Record<string, unknown>;

  export function markedTerminal(
    options?: MarkedTerminalOptions,
    highlightOptions?: Record<string, unknown>
  ): MarkedExtension;

  const _default: new (
    options?: MarkedTerminalOptions,
    highlightOptions?: Record<string, unknown>
  ) => unknown;
  export default _default;
}
