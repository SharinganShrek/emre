import type { SatWord } from "./types";

let wordList: SatWord[] | null = null;
let wordByLower: Map<string, SatWord> | null = null;

/** Lazy-load the full word list (~1.2MB) on first lookup. */
export function getSatWords(): SatWord[] {
  if (!wordList) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    wordList = (require("./words.json") as { words: SatWord[] }).words;
  }
  return wordList;
}

export function getWordMap(): Map<string, SatWord> {
  if (!wordByLower) {
    wordByLower = new Map(
      getSatWords().map((w) => [w.word.toLowerCase(), w] as const),
    );
  }
  return wordByLower;
}
