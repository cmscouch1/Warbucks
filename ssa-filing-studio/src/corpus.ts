import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface CorpusSection {
  id: string;
  citation: string;
  heading: string;
  source: string;
  asOf: string;
  paragraphs: string[];
}

export interface GridRule {
  id: string;
  table: string;
  exertional: "sedentary" | "light" | "medium";
  age: string;
  education: string;
  experience: string;
  decision: "disabled" | "not-disabled";
  footnotes: string[];
}

export interface ListingRecord {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface PomsRecord {
  id: string;
  title: string;
  source: string;
  asOf: string;
  paragraphs: string[];
}

export interface SgaAmount {
  year: number;
  blind: number;
  nonBlind: number;
  source: string;
}

interface Corpus {
  sections: CorpusSection[];
  grids: {
    citation: string;
    source: string;
    asOf: string;
    prose: string[];
    rules: GridRule[];
  };
  listings: ListingRecord[];
  poms: PomsRecord[];
  sga: { rule: string; amounts: SgaAmount[] };
}

let cached: Corpus | null = null;

function corpusDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "corpus");
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(corpusDir(), name), "utf8")) as T;
}

export function corpus(): Corpus {
  if (cached) return cached;
  cached = {
    sections: readJson<CorpusSection[]>("sections.json"),
    grids: readJson("grids.json"),
    listings: readJson<ListingRecord[]>("listings.json"),
    poms: readJson<PomsRecord[]>("poms.json"),
    sga: readJson("sga.json"),
  };
  return cached;
}

export function sectionText(section: CorpusSection): string {
  return section.paragraphs.join("\n");
}

export function findSection(citation: string): CorpusSection | undefined {
  const id = citation.replace(/^20\s*CFR\s*/i, "").trim().replace(/\(.*$/, "");
  return corpus().sections.find((section) => section.id === id);
}

export function findPoms(id: string): PomsRecord | undefined {
  const wanted = id.replace(/\s+/g, " ").trim().toUpperCase();
  return corpus().poms.find((record) => record.id.toUpperCase() === wanted);
}

export function findListing(id: string): ListingRecord | undefined {
  return corpus().listings.find((listing) => listing.id === id);
}

export function gridRule(id: string): GridRule | undefined {
  return corpus().grids.rules.find((rule) => rule.id === id);
}

export function gridRules(): GridRule[] {
  return corpus().grids.rules;
}

export function gridProse(): string[] {
  return corpus().grids.prose;
}

export function sgaAmount(year: number, blind: boolean): SgaAmount | undefined {
  const row = corpus().sga.amounts.find((amount) => amount.year === year);
  return row;
}

export function sgaRuleText(): string {
  return corpus().sga.rule;
}

export interface QuoteHit {
  kind: "regulation" | "listing" | "grid-rule" | "poms" | "grid-prose";
  citation: string;
  heading: string;
  source: string;
  paragraphs: string[];
}

export function quoteAuthority(citation: string): QuoteHit | null {
  const trimmed = citation.trim();
  const section = findSection(trimmed);
  if (section) {
    return {
      kind: "regulation",
      citation: section.citation,
      heading: section.heading,
      source: section.source,
      paragraphs: section.paragraphs,
    };
  }
  const poms = findPoms(trimmed);
  if (poms) {
    return {
      kind: "poms",
      citation: poms.id,
      heading: poms.title,
      source: poms.source,
      paragraphs: poms.paragraphs.slice(0, 40),
    };
  }
  const listingId = trimmed.replace(/^listing\s*/i, "");
  const listing = findListing(listingId);
  if (listing) {
    return {
      kind: "listing",
      citation: `20 CFR Part 404 Subpart P Appendix 1, listing ${listing.id}`,
      heading: listing.title,
      source: corpus().grids.source.replace("Appendix%202", "Appendix%201"),
      paragraphs: listing.paragraphs,
    };
  }
  const rule = gridRule(trimmed);
  if (rule) {
    return {
      kind: "grid-rule",
      citation: `Appendix 2, Rule ${rule.id}`,
      heading: `${rule.exertional}, ${rule.age}, ${rule.education}, ${rule.experience}`,
      source: corpus().grids.source,
      paragraphs: [
        `Rule ${rule.id} directs a finding of ${rule.decision === "disabled" ? "disabled" : "not disabled"}.`,
        `Age: ${rule.age}. Education: ${rule.education}. Previous work experience: ${rule.experience}.`,
      ],
    };
  }
  return null;
}

export interface SearchHit {
  citation: string;
  paragraph: string;
}

export function searchAuthorities(query: string, limit = 12): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 3) return [];
  const hits: SearchHit[] = [];
  const consider = (citation: string, paragraph: string) => {
    if (hits.length >= limit) return;
    if (paragraph.toLowerCase().includes(needle)) hits.push({ citation, paragraph });
  };
  for (const section of corpus().sections) {
    for (const paragraph of section.paragraphs) consider(section.citation, paragraph);
  }
  for (const paragraph of corpus().grids.prose) consider("Appendix 2", paragraph);
  for (const listing of corpus().listings) {
    for (const paragraph of listing.paragraphs) consider(`listing ${listing.id}`, paragraph);
    if (hits.length >= limit) break;
  }
  for (const record of corpus().poms) {
    for (const paragraph of record.paragraphs) consider(record.id, paragraph);
    if (hits.length >= limit) break;
  }
  return hits.slice(0, limit);
}

export function authorityContains(citation: string, phrase: string): boolean {
  const hit = quoteAuthority(citation);
  if (!hit) return false;
  const haystack = hit.paragraphs.join("\n").toLowerCase();
  return haystack.includes(phrase.toLowerCase());
}

export const BENCH_NOTICE =
  "SSA does not grade a filing from 1 to 100 and does not weigh individual sentences by a published percentage. filingStrength is this bench's index of whether the submission contains the facts the regulations require an adjudicator to consider. sequential.outcome is what those rules do with the facts this filing actually establishes. A statement that the person is disabled, or a bare exertional label such as 'sedentary,' is inherently neither valuable nor persuasive on a claim filed on or after March 27, 2017 (20 CFR 404.1520b(c)(3)). Do not add a medical fact the record does not contain.";
