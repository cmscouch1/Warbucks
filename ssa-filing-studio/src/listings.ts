import { findListing } from "./corpus.js";
import type { Facts, ListingElement, ListingResult, WeighedSentence } from "./types.js";

const MEDICAL = new Set(["objective-medical", "medical-opinion", "other-medical", "prior-administrative"]);

function medicalSentences(facts: Facts): WeighedSentence[] {
  return facts.sentences.filter((sentence) => MEDICAL.has(sentence.category));
}

function words(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 2);
}

function wordsInOrder(haystack: string, phrase: string): boolean {
  const needed = words(phrase);
  if (needed.length === 0) return false;
  const tokens = words(haystack);
  let from = 0;
  for (const word of needed) {
    const index = tokens.indexOf(word, from);
    if (index < 0 || (from > 0 && index - from > 8)) return false;
    from = index + 1;
  }
  return true;
}

function phraseHit(sentence: string, item: string): boolean {
  const clean = item.replace(/\(see [^)]+\)/gi, "").replace(/[.;]$/, "").trim();
  const alternatives = clean.split(/\s+or\s+/i).map((part) => part.trim()).filter((part) => words(part).length >= 2 || words(part)[0] !== undefined && (words(part)[0]?.length ?? 0) >= 9);
  const phrases = alternatives.length > 0 ? alternatives : [clean];
  return phrases.some((phrase) => wordsInOrder(sentence, phrase));
}

interface Group {
  needed: number;
  items: { id: string; text: string }[];
}

interface LetterBlock {
  letter: string;
  raw: string[];
  groups: Group[];
}

const letterCache = new Map<string, { logic: string | null; letters: LetterBlock[] }>();

function cachedLetters(id: string, paragraphs: string[]): { logic: string | null; letters: LetterBlock[] } {
  const hit = letterCache.get(id);
  if (hit) return hit;
  const parsed = parseLetters(paragraphs);
  letterCache.set(id, parsed);
  return parsed;
}

function parseLetters(paragraphs: string[]): { logic: string | null; letters: LetterBlock[] } {
  const logic = /satisfied by ([^:]+)/i.exec(paragraphs[0] ?? "")?.[1]?.trim() ?? null;
  const letters: LetterBlock[] = [];
  let current: LetterBlock | null = null;
  let group: Group | null = null;
  for (const paragraph of paragraphs.slice(1)) {
    const letter = /^([A-D])\.\s+(.*)$/.exec(paragraph);
    if (letter?.[1] && letter[2]) {
      current = { letter: letter[1], raw: [letter[2]], groups: [] };
      letters.push(current);
      group = null;
      continue;
    }
    if (!current) continue;
    current.raw.push(paragraph);
    const count = /(\d+|one|two|three|four|five|six|seven|eight|nine)\s+or more of the following/i.exec(paragraph);
    if (count?.[1]) {
      const word: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
      const needed = word[count[1].toLowerCase()] ?? Number(count[1]);
      group = { needed, items: [] };
      current.groups.push(group);
      continue;
    }
    const item = /^([a-i]|\d+)\.\s+(.*)$/.exec(paragraph);
    if (item?.[1] && item[2] && group) {
      group.items.push({ id: `${current.letter}${item[1]}`, text: item[2] });
    }
  }
  return { logic, letters };
}

function logicMet(logic: string | null, met: Record<string, boolean>): { value: boolean; path: string } | null {
  if (!logic) return null;
  const text = logic.toLowerCase().replace(/\s+/g, " ");
  if (text.includes("a and b") && text.includes("a and c")) {
    if (met.A && met.B) return { value: true, path: "A and B" };
    if (met.A && met.C) return { value: true, path: "A and C" };
    return { value: false, path: "A and B, or A and C" };
  }
  if (text.includes("a and b")) return { value: Boolean(met.A && met.B), path: "A and B" };
  if (text.includes("a or b")) return { value: Boolean(met.A || met.B), path: "A or B" };
  return null;
}

const DOMAIN_WORDS = ["understand", "remember", "apply", "interact", "concentrate", "persist", "pace", "adapt", "manage"];

function hasStem(text: string, word: string): boolean {
  const stems = word.endsWith("e") ? [word, word.slice(0, -1)] : [word];
  return stems.some((stem) => new RegExp(`\\b${stem}\\w*`, "i").test(text));
}

function paragraphB(block: LetterBlock, medical: WeighedSentence[]): { met: boolean; elements: ListingElement[] } {
  const standard = block.raw.join(" ").toLowerCase().includes("extreme limitation of one") && block.raw.join(" ").toLowerCase().includes("marked limitation of two");
  const domains = block.raw.filter((line) => /^\d+\.\s+/.test(line));
  const elements: ListingElement[] = [];
  const levels = new Map<string, "extreme" | "marked">();
  for (const domain of domains) {
    const keyword = DOMAIN_WORDS.find((word) => hasStem(domain, word));
    const hit = medical.find((sentence) => {
      if (!keyword || !hasStem(sentence.text, keyword)) return false;
      return /\bextreme limitation\b|\bextremely limited\b/i.test(sentence.text) || /\bmarked limitation\b|\bmarkedly limited\b/i.test(sentence.text);
    });
    const level = hit && /\bextreme/i.test(hit.text) ? "extreme" : hit ? "marked" : null;
    if (keyword && level) levels.set(keyword, level);
    elements.push({
      id: `B ${domain.slice(0, 12)}`,
      text: domain,
      met: hit !== undefined,
      matchedSentence: hit?.index ?? null,
    });
  }
  const extremes = [...levels.values()].filter((level) => level === "extreme").length;
  const markeds = [...levels.values()].filter((level) => level === "marked").length;
  return { met: standard && (extremes >= 1 || markeds >= 2), elements };
}

function listingAgeFits(title: string, age: number | null): boolean {
  if (age === null) return true;
  const fromBirth = /from birth to attainment of age (\d+)/i.exec(title);
  if (fromBirth?.[1] && age >= Number(fromBirth[1])) return false;
  const range = /age (\d+) to attainment of age (\d+)/i.exec(title);
  if (range?.[1] && range[2] && (age < Number(range[1]) || age >= Number(range[2]))) return false;
  return true;
}

function applicableListingId(facts: Facts): string | null {
  const fitting = facts.listingIds.find((candidate) => {
    const record = findListing(candidate);
    return record !== undefined && listingAgeFits(record.title, facts.age);
  });
  return fitting ?? facts.listingIds[0] ?? null;
}

export function evaluateListing(facts: Facts): ListingResult {
  const id = applicableListingId(facts);
  if (!id) {
    return {
      id: null,
      inCorpus: false,
      testedPath: false,
      meets: false,
      path: null,
      explanation: "The filing does not name a listing that is in Appendix 1. Step 3 is not met. Naming the listing and addressing each lettered criterion is what lets an adjudicator decide step 3.",
      criteria: "",
      lettersAddressed: 0,
      lettersTotal: 0,
      elements: [],
    };
  }
  const record = findListing(id);
  if (record && !listingAgeFits(record.title, facts.age)) {
    return {
      id,
      inCorpus: true,
      testedPath: false,
      meets: false,
      path: null,
      explanation: `Listing ${id} is limited by its title to an age group this person is outside. The title says: ${record.title}. This bench will not find that the listing is met.`,
      criteria: "",
      lettersAddressed: 0,
      lettersTotal: 0,
      elements: [],
    };
  }
  if (!record) {
    return {
      id,
      inCorpus: false,
      testedPath: false,
      meets: false,
      path: null,
      explanation: `Listing ${id} is not in the Appendix 1 text loaded in this bench, so no meets-listing finding is made.`,
      criteria: "",
      lettersAddressed: 0,
      lettersTotal: 0,
      elements: [],
    };
  }
  const parsed = cachedLetters(id, record.paragraphs);
  const medical = medicalSentences(facts);
  const letterMet: Record<string, boolean> = {};
  const elements: ListingElement[] = [];
  let lettersAddressed = 0;
  for (const block of parsed.letters) {
    if (block.letter === "B" && block.raw.join(" ").toLowerCase().includes("extreme limitation of one")) {
      const result = paragraphB(block, medical);
      letterMet.B = result.met;
      elements.push(...result.elements);
      if (result.elements.some((element) => element.met)) lettersAddressed += 1;
      continue;
    }
    let blockMet = false;
    let any = false;
    if (block.groups.length === 0) {
      letterMet[block.letter] = false;
      continue;
    }
    for (const group of block.groups) {
      let hits = 0;
      for (const item of group.items) {
        const match = medical.find((sentence) => phraseHit(sentence.text, item.text));
        const met = match !== undefined;
        if (met) {
          hits += 1;
          any = true;
        }
        elements.push({ id: item.id, text: item.text, met, matchedSentence: match?.index ?? null });
      }
      if (hits >= group.needed) blockMet = true;
    }
    letterMet[block.letter] = blockMet;
    if (any) lettersAddressed += 1;
  }
  const decision = logicMet(parsed.logic, letterMet);
  const criteria = decision ? "" : record.paragraphs.join("\n");
  if (!decision) {
    return {
      id,
      inCorpus: true,
      testedPath: false,
      meets: false,
      path: null,
      explanation: `Listing ${id} is quoted from Appendix 1. Its logical structure is not one of the tested paths (A and B, A or B, or A and B or A and C, with "or more of the following" groups). This bench will not find that the listing is met. The quoted criteria are the checklist.`,
      criteria,
      lettersAddressed,
      lettersTotal: parsed.letters.length,
      elements,
    };
  }
  const meets = decision.value;
  return {
    id,
    inCorpus: true,
    testedPath: true,
    meets,
    path: decision.path,
    explanation: meets
      ? `The medical sentences in this filing satisfy listing ${id} by ${decision.path}. A nonmedical sentence was not counted. Duration is a separate requirement (20 CFR 404.1509).`
      : `Listing ${id} is not satisfied on the tested path (${decision.path}). The element list shows which criteria from the listing text have a matching medical sentence.`,
    criteria,
    lettersAddressed,
    lettersTotal: parsed.letters.length,
    elements,
  };
}
