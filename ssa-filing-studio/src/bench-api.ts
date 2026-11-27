import { BENCH_NOTICE, corpus, findListing, gridRule, gridRules, quoteAuthority, sgaAmount, sgaRuleText } from "./corpus.js";
import { novelNumbers } from "./draft.js";
import { gradeFiling } from "./reflection.js";
import { applyVocational } from "./grids.js";
import { readFacts } from "./facts.js";
import { runSelfTest } from "./selftest.js";
import type { Education, Exertional, ExperienceKind, FilingInput } from "./types.js";

export const MODEL_GUIDE = `SSA Filing Bench — how a model must use this server

This server is a deterministic bench over the Code of Federal Regulations, the medical-vocational rules in 20 CFR Part 404 Subpart P Appendix 2, the adult mental and other listings loaded from Appendix 1, POMS DI 24503.025, DI 24503.030, and DI 25001.001, and the yearly substantial-gainful-activity amounts. It is not a chatbot and it does not grade the way a person would guess.

What the numbers mean
- sequential.outcome is the result the five-step adult rules (or the child rules) produce from facts the filing actually establishes: disabled, not-disabled, or not-determinable.
- filingStrength is this bench's 0–100 index of whether the submission contains the facts those rules require. SSA does not publish a 1–100 grade. Never call filingStrength an SSA score, an approval chance, or a probability.
- If reliable is false, the audit failed. Show the failed checks. Do not present filingStrength as a grade.
- grade_filing runs the LangGraph reflection graph (https://github.com/langchain-ai/langgraphjs/tree/main/examples/reflection): a generate node grades the filing, and a reflect node may only repair missing sentence breaks. The graph stops when the audit passes, when reflect would have to change words, or after 3 iterations. If reflection.stoppedBecause is not "clean", do not present filingStrength as a grade.
- A not-determinable result is incomplete evidence or a missing vocational finding. It is not a denial, except where a step's outcome is explicitly not-disabled.

Hard limits
- Do not invent a diagnosis, a test result, a measurement, a date, a job, or a limitation. The strongest honest filing reorganizes stated facts and leaves blanks where a fact is missing.
- A statement that the person is "disabled," "unable to work," or "limited to sedentary work," with no pounds and no hours, is a reserved issue on claims filed on or after March 27, 2017 (20 CFR 404.1520b(c)(3)). It is not a medical opinion and it does not set residual functional capacity.
- "Legally blind" is not statutory blindness. Title XVI statutory blindness is not a step-1 denial for earnings (20 CFR 416.984).
- Earnings equal to the yearly substantial-gainful-activity amount are not substantial gainful activity. The regulation uses "more than."
- Do not find medical equivalence because a source says an impairment "equals a listing." 20 CFR 404.1526 assigns that finding to the medical or psychological consultant, or at a hearing to the administrative law judge.
- A chiropractor, acupuncturist, naturopath, social worker, or physical therapist is not an acceptable medical source under 20 CFR 404.1502(a). Do not treat that source's findings as establishing a medically determinable impairment.
- Work that started and stopped in fewer than thirty calendar days is not past relevant work. Do not use it as grid work experience.
- Past relevant work also has to have been substantial gainful activity (20 CFR 404.1560(b)(1)). A job that is not shown to be substantial gainful activity does not support a step 4 denial. If calling that work unskilled and calling it no past relevant work would direct different grid results, neither result directs.
- A birth date flags a borderline age only when the person is within six months of the next higher age category, chronological age would direct not disabled, and the higher category would direct disabled (POMS DI 25001.001). The chronological rule stays. An integer age with no birth date does not flag. Read overrides when a birth date replaces an age written in the narrative. The five-year past-work period is measured from the filing date, or from today if none was given. This bench has no date last insured and does not shorten that period.
- For a child under 18 who names both an adult listing and a Part B listing, the Part B listing is tested first.
- Do not tell a client they will be approved, awarded, or denied by SSA. Say what this bench found and cite the authority.

Required sequence
1. Call how_to_use or read ssa://guide before the first filing in a conversation.
2. Before you state what a regulation, listing, POMS section, or grid rule says, call quote_authority or search_authorities and quote the returned text. If the authority is not in the corpus, say so. Do not paraphrase from memory and present it as the regulation.
3. Call grade_filing on the client's words. Read sequential first, then the sentence ledger, then the factors, then the draft.
4. The draft's GAP lines are instructions with blanks. They are not filing text. Do not paste a GAP into a filing as if the fact were known.
5. If you or the user rewrite the filing, call compare_filings. If novelNumbers or inventedClinicalMarkers is not empty, the rewrite added facts. Stop and remove them.
6. Use apply_vocational_rule only for a hypothetical whose age, education, experience, and exertional range are already established. Do not use it to paper over a grade_filing result that says the residual functional capacity is not established.
7. Call self_test if a result looks inconsistent. If self_test fails, stop using the bench and report the failures.

Corpus date
Regulations were taken from the eCFR title 20 issue dated 2026-11-19. Substantial-gainful-activity amounts for years outside the loaded table are not guessed from a nearby year.`;

const CLINICAL_MARKERS = ["mri", "ct scan", "x-ray", "xray", "emg", "eeg", "diagnos", "herniat", "stenosis", "radiculopathy", "fracture", "fusion", "surgery"];

export function inventedClinicalMarkers(original: string, revised: string): string[] {
  const before = original.toLowerCase();
  const after = revised.toLowerCase();
  return CLINICAL_MARKERS.filter((marker) => after.includes(marker) && !before.includes(marker));
}

export async function gradeForModel(input: FilingInput) {
  const report = await gradeFiling(input);
  return {
    howToReadThis: "Lead with sequential.outcome. filingStrength is the bench index, not an SSA score. reflection is the LangGraph generate/reflect trace. If reliable is false or reflection.stoppedBecause is not clean, report the failed audit checks and do not present the number as a grade.",
    ...report,
  };
}

export function weighSentences(input: FilingInput) {
  const { facts } = readFacts(input);
  return {
    notice: BENCH_NOTICE,
    opinionRule: facts.opinionRule,
    filingDate: facts.filingDate,
    sentences: facts.sentences,
    opinions: facts.opinions,
    overrides: facts.overrides,
  };
}

export function quoteForModel(citation: string) {
  const hit = quoteAuthority(citation);
  if (!hit) {
    return {
      found: false,
      citation,
      message: "That authority is not in the loaded corpus. Do not invent its text. Use search_authorities or list_authorities.",
    };
  }
  const truncated = hit.paragraphs.length > 80;
  return {
    found: true,
    truncated,
    ...hit,
    paragraphs: truncated ? hit.paragraphs.slice(0, 80) : hit.paragraphs,
  };
}

export async function listingForModel(id: string, narrative?: string) {
  const record = findListing(id);
  if (!record) return { found: false, id, message: "That listing id is not in the loaded Appendix 1." };
  const graded = narrative ? await gradeFiling({ narrative }) : null;
  return {
    found: true,
    id: record.id,
    title: record.title,
    paragraphs: record.paragraphs.slice(0, 80),
    truncated: record.paragraphs.length > 80,
    evaluation: graded ? graded.listing : null,
    note: graded ? "evaluation is the bench's reading of the narrative against this filing's first named listing, which may differ from the id you passed." : "Pass a narrative to grade_filing for a full sequential result.",
  };
}

export function sgaForModel(year: number, blind: boolean) {
  const row = sgaAmount(year, blind);
  if (!row) {
    return { found: false, year, message: "That year is not in the loaded table. Do not borrow another year's amount." };
  }
  return {
    found: true,
    year: row.year,
    blindMonthly: row.blind,
    nonBlindMonthly: row.nonBlind,
    amountUsed: blind ? row.blind : row.nonBlind,
    blind,
    rule: sgaRuleText(),
    source: row.source,
    comparison: "Employee earnings that average more than this amount ordinarily show substantial gainful activity. Earnings equal to or less than this amount ordinarily show the person has not engaged in substantial gainful activity (20 CFR 404.1574(b)).",
  };
}

export function vocationalForModel(profile: {
  age: number | null;
  education: Education | null;
  directEntry: boolean | null;
  experience: ExperienceKind | null;
  exertional: Exertional;
  fullRange: boolean;
  nonexertionalErosion: boolean;
  veryLittleAdjustment: boolean;
}) {
  return {
    notice: "This applies Appendix 2 to findings you already supplied. It does not read a filing and it does not establish residual functional capacity.",
    result: applyVocational(profile),
  };
}

export function gridRuleForModel(id: string) {
  const rule = gridRule(id);
  if (!rule) return { found: false, id, message: "That rule id is not in the loaded Appendix 2 tables." };
  return { found: true, rule };
}

export function listGridRulesForModel(exertional?: "sedentary" | "light" | "medium") {
  const rules = gridRules().filter((rule) => !exertional || rule.exertional === exertional);
  return { count: rules.length, rules };
}

export async function compareFilings(original: FilingInput, revisedNarrative: string) {
  const revisedInput: FilingInput = { ...original, narrative: revisedNarrative };
  const before = await gradeFiling(original);
  const after = await gradeFiling(revisedInput);
  const numbers = novelNumbers(original.narrative, revisedNarrative);
  const markers = inventedClinicalMarkers(original.narrative, revisedNarrative);
  const clean = numbers.length === 0 && markers.length === 0;
  return {
    useTheRevision: clean,
    novelNumbers: numbers,
    inventedClinicalMarkers: markers,
    instruction: clean
      ? "No new numbers and no new clinical markers were detected. Still read both sequential results before you rely on the rewrite."
      : "The rewrite added numbers or clinical markers that were not in the original. Those are not established facts. Remove them and compare again.",
    original: { reliable: before.reliable, filingStrength: before.filingStrength, sequential: before.sequential, vocational: before.vocational },
    revised: { reliable: after.reliable, filingStrength: after.filingStrength, sequential: after.sequential, vocational: after.vocational },
  };
}

export async function draftForModel(input: FilingInput) {
  const report = await gradeFiling(input);
  return {
    notice: "GAP lines are blanks, not facts. After a person fills a blank, call compare_filings. Do not copy a GAP sentence into the filing.",
    reliable: report.reliable,
    filingStrength: report.filingStrength,
    sequential: report.sequential,
    draft: report.draft,
  };
}

export function listAuthorities() {
  const data = corpus();
  return {
    asOf: data.sections[0]?.asOf ?? null,
    notice: BENCH_NOTICE,
    sectionCount: data.sections.length,
    sections: data.sections.map((section) => ({ id: section.id, heading: section.heading })),
    listingCount: data.listings.length,
    gridRuleCount: data.grids.rules.length,
    poms: data.poms.map((record) => ({ id: record.id, title: record.title })),
    sgaYears: data.sga.amounts.map((amount) => amount.year),
  };
}

export function runBenchSelfTest() {
  return runSelfTest();
}
