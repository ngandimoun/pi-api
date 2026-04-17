import chalk from "chalk";
import gradient from "gradient-string";

import { shouldUseColor, shouldUseUnicode } from "./ui/chat-ui.js";

const HOKAGE_TITLE = "THE HOKAGE HAS ARRIVED";
const HOKAGE_SUBTITLE = "Guardian of Codebase Integrity";

/** Truecolor gradient — orange → red → purple — used when color is on. */
const hokageGradient = gradient(["#ffb347", "#ff5c5c", "#8a2be2"]);

function rawFace(): string {
  // Static ASCII face — coloring happens below.
  return [
    "        ████████",
    "      ██▓▓▓▓▓▓██",
    "    ██▓▓██████▓▓██",
    "    ██▓▓██▓▓██▓▓██",
    "    ██▓▓████▓▓██",
    "      ████████",
    "    ██████████",
    "  ██████████████",
    "  ██████████████",
    "    ████████",
  ].join("\n");
}

function asciiFace(): string {
  return [
    "        ########",
    "      ##++++++##",
    "    ##++######++##",
    "    ##++##++##++##",
    "    ##++####++##",
    "      ########",
    "    ##########",
    "  ########+######",
    "  ##############",
    "    ########",
  ].join("\n");
}

export function showHokageArt(): void {
  const color = shouldUseColor();
  const unicode = shouldUseUnicode();
  const face = unicode ? rawFace() : asciiFace();

  let rendered: string;
  if (color && unicode) {
    rendered = hokageGradient.multiline(face);
  } else if (color) {
    rendered = chalk.yellow(face);
  } else {
    rendered = face;
  }

  const title = color ? chalk.bold.cyan(HOKAGE_TITLE) : HOKAGE_TITLE;
  const subtitle = color ? chalk.gray(HOKAGE_SUBTITLE) : HOKAGE_SUBTITLE;

  console.log("");
  console.log(rendered);
  console.log("");
  console.log(title);
  console.log(subtitle);
  console.log("");
}
