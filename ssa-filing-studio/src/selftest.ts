import { gradeFiling } from "./grade.js";
import { applyVocational } from "./grids.js";
import { gridRule } from "./corpus.js";
import { joinSentences, splitSentences } from "./sentences.js";
import type { GradeReport } from "./types.js";

export interface SelfTestFailure {
  name: string;
  detail: string;
}

function expect(condition: boolean, detail: string, failures: SelfTestFailure[], name: string): void {
  if (!condition) failures.push({ name, detail });
}

function graded(narrative: string, extra: Parameters<typeof gradeFiling>[0] = { narrative }): GradeReport {
  return gradeFiling({ ...extra, narrative });
}

export function runSelfTest(): { passed: boolean; failures: SelfTestFailure[] } {
  const failures: SelfTestFailure[] = [];

  const sample = "Dr. Cho examined the patient on March 1, 2024. Listing 12.04 is the theory.\nShe explained the limit.";
  expect(joinSentences(splitSentences(sample)) === sample, "Sentence split is not lossless.", failures, "sentences");

  const rule20101 = gridRule("201.01");
  expect(rule20101?.decision === "disabled" && rule20101.age === "Advanced age", "Rule 201.01 was not read as disabled for advanced age.", failures, "grid-201.01");
  const rule20117 = gridRule("201.17");
  expect(rule20117?.decision === "disabled" && rule20117.education === "Illiterate", "Rule 201.17 was not read from the table.", failures, "grid-201.17");
  const rule20118 = gridRule("201.18");
  expect(rule20118?.decision === "not-disabled", "Rule 201.18 should direct not disabled.", failures, "grid-201.18");

  const grid = applyVocational({
    age: 52,
    education: "limited",
    directEntry: null,
    experience: "unskilled",
    exertional: "sedentary",
    fullRange: true,
    nonexertionalErosion: false,
    veryLittleAdjustment: false,
  });
  expect(grid.directed && grid.ruleId === "201.09" && grid.outcome === "disabled", `Expected rule 201.09 disabled, got ${grid.ruleId} ${grid.outcome}. ${grid.explanation}`, failures, "grid-201.09");

  const sga = graded("I am 57 years old. I currently work and earn $3,000 a month.", { narrative: "", filingDate: "2026-06-01" });
  expect(sga.sequential.outcome === "not-disabled" && sga.sequential.decidedAtStep === 1, sga.sequential.headline, failures, "sga-deny");
  expect(sga.reliable, sga.audit.checks.filter((check) => !check.passed).map((check) => `${check.id}: ${check.detail}`).join(" | "), failures, "sga-audit");

  const equal = graded("I am 40 years old. I currently work and earn $1,690 a month.", { narrative: "", filingDate: "2026-06-01" });
  expect(equal.sequential.decidedAtStep !== 1 || equal.sequential.outcome !== "not-disabled", "Earnings equal to the SGA amount were treated as SGA.", failures, "sga-equal");

  const symptoms = graded("I am 60 years old. I stopped working in 2024. My back hurts every day and I cannot sit. I have a 10th grade education.");
  expect(symptoms.sequential.outcome === "not-determinable" && symptoms.sequential.decidedAtStep === 2, symptoms.sequential.headline, failures, "symptom-only");
  expect(!symptoms.draft.reorganized.toLowerCase().includes("degenerative"), "The draft invented a diagnosis.", failures, "no-invented-diagnosis");

  const reserved = graded("Dr. Smith opined that the patient is totally disabled and limited to sedentary work.");
  const support = reserved.factors.find((factor) => factor.id === "supportability");
  expect(support?.earned === 0, `Reserved-issue opinion earned supportability points: ${support?.earned}`, failures, "reserved-issue");

  const blind = graded("I am statutorily blind. I am 40 years old. I currently work and earn $4,000 a month.", { narrative: "", program: "title-xvi", filingDate: "2026-06-01" });
  expect(!(blind.sequential.decidedAtStep === 1 && blind.sequential.outcome === "not-disabled"), blind.sequential.headline, failures, "ssi-blind");

  const listing = graded(`I am 42 years old. I stopped working on March 1, 2023, and I have not worked since. I have a high school education. My past work was an unskilled warehouse job from 2016 to 2023.
Dr. Elena Cho, a board-certified psychiatrist who has treated me monthly since 2019, examined me. On mental status examination she observed depressed mood, diminished interest in almost all activities, appetite disturbance with change in weight, sleep disturbance, observable psychomotor retardation, decreased energy, feelings of guilt and worthlessness, difficulty concentrating or thinking, and thoughts of death. She explained that these findings have persisted for two years and are the objective signs of depression.
She opined that I have a marked limitation in interacting with others and a marked limitation in concentrating, persisting, or maintaining pace, because those examination findings support the limits.
The listing is 12.04. I shop only with help. The symptom is constant. It is worse when I am around people. I take sertraline 100 mg and it causes nausea. I attend therapy. I lie down when it peaks. Because of the symptoms I cannot finish a task. In an eight-hour workday these limits apply.`);
  expect(listing.listing.meets, listing.listing.explanation, failures, "listing-12.04");
  expect(listing.sequential.outcome === "disabled" && listing.sequential.decidedAtStep === 3, listing.sequential.headline, failures, "listing-step");
  expect(listing.reliable, listing.audit.checks.filter((check) => !check.passed).map((check) => `${check.id}: ${check.detail}`).join(" | "), failures, "listing-audit");

  const gridFiling = graded(`I am 52 years old. I stopped working in 2018 and I have not worked since. I have a 9th grade education. The work was unskilled.
Dr. Ortiz, an orthopedist who examined me, opined that I can lift 10 pounds occasionally, sit for 6 hours, and stand or walk for 2 hours in an eight-hour workday. He explained this is based on the MRI of the lumbar spine, which showed nerve-root compression, and the reduced range of motion he measured. The impairment is the lumbar spine. It has lasted since 2018, more than twelve months, and it significantly limits sitting.
I do not claim a mental limit beyond the physical pain. My daily activities are limited. The pain is constant. It is worse when I walk. I take ibuprofen 400 mg. I had physical therapy. I lie down. Because of the pain I cannot lift more.`);
  expect(gridFiling.sequential.outcome === "disabled" && gridFiling.vocational.ruleId === "201.09", `${gridFiling.sequential.headline} rule=${gridFiling.vocational.ruleId} rfc=${gridFiling.sentences.length}`, failures, "rule-201.09-filing");

  const younger = graded(`I am 40 years old with a high school education. I stopped working in 2020. The work was unskilled.
Dr. Ortiz examined me and opined that I can sit for 4 hours and lift 10 pounds occasionally in an eight-hour workday. He explained the limit is based on the MRI of the lumbar spine, which showed nerve-root compression. This has lasted since 2020 and significantly limits sitting.`);
  expect(younger.sequential.outcome !== "disabled", younger.sequential.headline, failures, "less-than-sedentary-younger");

  const oldRule = graded("I am 57 years old. I currently work and earn $3,000 a month.", { narrative: "", filingDate: "2016-06-01" });
  expect(oldRule.reliable, oldRule.audit.checks.filter((check) => !check.passed).map((check) => `${check.id}: ${check.detail}`).join(" | "), failures, "pre-2017-audit");
  const supportability = oldRule.factors.find((factor) => factor.id === "supportability");
  expect(supportability?.citation.includes("404.1527") === true, supportability?.citation ?? "missing", failures, "pre-2017-rule");

  return { passed: failures.length === 0, failures };
}
