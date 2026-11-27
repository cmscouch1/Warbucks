export interface SentencePiece {
  text: string;
  separator: string;
}

const ABBREVIATIONS = new Set([
  "dr", "mr", "mrs", "ms", "jr", "sr", "st", "vs", "etc", "no", "fig", "inc", "ltd",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
  "gen", "col", "sgt", "lt", "prof", "ph", "al", "ed", "rev",
]);

function isAbbreviation(word: string): boolean {
  const cleaned = word.replace(/\./g, "").toLowerCase();
  if (ABBREVIATIONS.has(cleaned)) return true;
  return /^[a-z]$/i.test(word);
}

/** Split on sentence boundaries without dropping or adding characters. */
export function splitSentences(input: string): SentencePiece[] {
  const pieces: SentencePiece[] = [];
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char !== "." && char !== "!" && char !== "?" && char !== "\n") continue;
    if (char === ".") {
      const before = input.slice(start, i);
      const word = /([A-Za-z]+)$/.exec(before)?.[1] ?? "";
      if (word && isAbbreviation(word)) continue;
      const next = input[i + 1] ?? "";
      if (/\d$/.test(before) && /\d/.test(next)) continue;
    }
    if (char === "\n") {
      const text = input.slice(start, i);
      let end = i;
      while (end < input.length && input[end] === "\n") end++;
      pieces.push({ text, separator: input.slice(i, end) });
      start = end;
      i = end - 1;
      continue;
    }
    let end = i + 1;
    while (end < input.length && (input[end] === " " || input[end] === "\t")) end++;
    pieces.push({ text: input.slice(start, i + 1), separator: input.slice(i + 1, end) });
    start = end;
    i = end - 1;
  }
  if (start < input.length || pieces.length === 0) {
    pieces.push({ text: input.slice(start), separator: "" });
  }
  return pieces;
}

export function joinSentences(pieces: SentencePiece[]): string {
  return pieces.map((piece) => piece.text + piece.separator).join("");
}
