import { gradeFiling } from "./grade.js";
import { readFacts } from "./facts.js";
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

  const briefNarrative = `I am 55 years old. I stopped working in 2024. I have a 9th grade education. My only job lasted 10 days and was unskilled.
Dr. Ortiz, an orthopedist who examined me, opined that I can lift 50 pounds occasionally and 25 pounds frequently, and stand or walk for 6 hours in an eight-hour workday. He explained this from the MRI of the lumbar spine, which showed nerve-root compression. It has lasted since 2018 and significantly limits lifting.`;
  const briefJob = graded(briefNarrative, { narrative: "", filingDate: "2026-06-01" });
  const briefFacts = readFacts({ narrative: briefNarrative, filingDate: "2026-06-01" }).facts;
  expect(briefFacts.experience === "none", `A 10-day job was treated as work experience: ${briefFacts.experience}`, failures, "brief-work-experience");
  expect(briefJob.sequential.outcome === "disabled" && briefJob.vocational.ruleId !== "203.11", `${briefJob.sequential.headline} rule=${briefJob.vocational.ruleId}`, failures, "brief-work-grid");
  expect(briefJob.sequential.headline.includes("404.1562(b)") || briefJob.vocational.ruleId === "203.10", briefJob.sequential.headline, failures, "brief-work-authority");

  const flare = readFacts({ narrative: "I am 55. I stopped working in 2019. The past work was unskilled warehouse work from 2005 to 2019. A headache lasted 10 days. I have a 9th grade education." }).facts;
  expect(flare.experience === "unskilled", `A short symptom wiped out work experience: ${flare.experience}`, failures, "flare-not-brief-work");

  const entryNarrative = `I am 55 years old. I stopped working in 2019. I have a high school education that does not provide for direct entry into skilled work. The past work was unskilled.
Dr. Ortiz examined me and opined that I can lift 10 pounds occasionally, sit for 6 hours, and stand or walk for 2 hours in an eight-hour workday. He explained the MRI of the lumbar spine showed nerve-root compression. This has lasted since 2018 and significantly limits sitting.`;
  const entryFacts = readFacts({ narrative: entryNarrative }).facts;
  expect(entryFacts.experience === "unskilled" && entryFacts.directEntry === false, `experience=${entryFacts.experience} directEntry=${String(entryFacts.directEntry)}`, failures, "direct-entry-not-skill");

  const chiro = readFacts({ narrative: "I am 60. I stopped working in 2022. Dr. Bones, a chiropractor, examined me. The x-ray of the lumbar spine showed degeneration. It has lasted since 2020 and significantly limits sitting." }).facts;
  expect(chiro.amsNamed === false && chiro.objectiveFinding === false, `ams=${chiro.amsNamed} objective=${chiro.objectiveFinding}`, failures, "chiropractor-not-ams");

  const mild = graded("I am 60. I stopped working in 2020. Dr. Ortiz examined me. The MRI of the lumbar spine showed degeneration and the x-ray of the knee showed narrowing. Both impairments are mild. I have had them since 2019.");
  expect(mild.sequential.outcome !== "not-disabled", mild.sequential.headline, failures, "two-mild-combination");

  const therapy = readFacts({ narrative: "I am 60. I stopped working in 2024. Dr. Ortiz examined me. The MRI of the lumbar spine showed nerve-root compression. I attended physical therapy for 6 months. It significantly limits sitting." }).facts;
  expect(therapy.duration !== "not-met", `Treatment length was treated as the duration of the impairment: ${therapy.duration}`, failures, "therapy-months");

  const child = graded("The child is 10 years old and has not attended school since 2023. Dr. Patel, a pediatrician who examined the child, recorded an extreme limitation in acquiring and using information on examination. She explained the finding. It has lasted for two years.");
  expect(child.sequential.outcome === "disabled" && child.vocational.ruleId === null, `${child.sequential.headline} rule=${child.vocational.ruleId}`, failures, "child-domain");

  const equals = graded("I am 50. I stopped working in 2020. Dr. Cho opined that my impairment medically equals listing 12.04. It has lasted for twelve months and significantly limits concentrating.");
  expect(!(equals.listing.meets || (equals.sequential.outcome === "disabled" && equals.sequential.decidedAtStep === 3)), equals.sequential.headline, failures, "no-equivalence");
  expect(equals.sequential.steps.some((item) => item.explanation.includes("404.1526")), "Equivalence was not handed back to 20 CFR 404.1526.", failures, "equivalence-citation");

  const sedentaryOpinion = "Dr. Ortiz, an orthopedist who examined me, opined that I can lift 10 pounds occasionally, sit for 6 hours, and stand or walk for 2 hours in an eight-hour workday. He explained this is based on the MRI of the lumbar spine, which showed nerve-root compression, and the reduced range of motion he measured. The impairment is the lumbar spine. It has lasted since 2018, more than twelve months, and it significantly limits sitting.";
  const cashier = graded(`I am 55 years old. I stopped working in 2024. I have a 9th grade education. I worked as a cashier from 2022 to 2024, lifted 5 pounds, and the work was unskilled. ${sedentaryOpinion}`, { narrative: "", filingDate: "2026-06-01" });
  expect(cashier.sequential.decidedAtStep !== 4, cashier.sequential.headline, failures, "prw-without-sga-not-step4");
  expect(cashier.sequential.outcome === "disabled" && cashier.sequential.decidedAtStep === 5, `${cashier.sequential.headline} rule=${cashier.vocational.ruleId}`, failures, "prw-without-sga-grid");

  const cashierSga = graded(`I am 40 years old. I stopped working in 2024. I have a high school education. I worked as a cashier full-time from 2022 to 2024, lifted 5 pounds, and the work was unskilled. ${sedentaryOpinion}`, { narrative: "", filingDate: "2026-06-01" });
  expect(cashierSga.sequential.decidedAtStep === 4 && cashierSga.sequential.outcome === "not-disabled", cashierSga.sequential.headline, failures, "prw-with-sga-step4");

  const mediumOpinion = "Dr. Ortiz, an orthopedist who examined me, opined that I can lift 50 pounds occasionally and 25 pounds frequently, and stand or walk for 6 hours in an eight-hour workday. He explained this from the MRI of the lumbar spine, which showed nerve-root compression. It has lasted since 2018 and significantly limits lifting.";
  const mediumSplit = graded(`I am 55 years old. I stopped working in 2019. I have a 9th grade education. The past work was unskilled. ${mediumOpinion}`, { narrative: "", filingDate: "2026-06-01" });
  expect(mediumSplit.sequential.outcome === "not-determinable" && mediumSplit.vocational.explanation.includes("404.1560"), mediumSplit.vocational.explanation, failures, "unskilled-without-sga-disagrees");
  const mediumShown = graded(`I am 55 years old. I stopped working in 2019. I have a 9th grade education. The past work was full-time unskilled. ${mediumOpinion}`, { narrative: "", filingDate: "2026-06-01" });
  expect(mediumShown.sequential.outcome === "not-disabled" && mediumShown.vocational.ruleId === "203.11", `${mediumShown.sequential.headline} rule=${mediumShown.vocational.ruleId}`, failures, "unskilled-sga-shown");

  const borderline = graded(`I stopped working in 2018 and I have not worked since. I have a 9th grade education. The past work was full-time unskilled. ${sedentaryOpinion}`, { narrative: "", filingDate: "2026-06-01", birthDate: "1976-08-15" });
  expect(borderline.sequential.outcome === "not-disabled" && borderline.vocational.borderline !== null, `${borderline.sequential.headline} borderline=${JSON.stringify(borderline.vocational.borderline)} age-note`, failures, "borderline-flag");
  expect(borderline.vocational.ruleId === borderline.vocational.borderline?.chronologicalRuleId, borderline.vocational.explanation, failures, "borderline-not-moved");

  const farBirth = graded(`I stopped working in 2018 and I have not worked since. I have a 9th grade education. The past work was full-time unskilled. ${sedentaryOpinion}`, { narrative: "", filingDate: "2026-06-01", birthDate: "1970-01-15" });
  expect(farBirth.vocational.borderline === null, farBirth.vocational.explanation, failures, "borderline-not-near");

  const integerAge = graded(`I am 49 years old. I stopped working in 2018 and I have not worked since. I have a 9th grade education. The past work was full-time unskilled. ${sedentaryOpinion}`, { narrative: "", filingDate: "2026-06-01" });
  expect(integerAge.vocational.borderline === null, "An integer age flagged a borderline issue without a birth date.", failures, "borderline-needs-birth-date");

  const childListing = graded("The child is 12 years old. The listings discussed are 12.04 and 112.04. The child has not worked.");
  expect(childListing.listing.id === "112.04", `Child listing used ${childListing.listing.id}`, failures, "child-part-b-first");
  const adultListing = graded("I am 40 years old. I stopped working in 2020. The listings discussed are 12.04 and 112.04.");
  expect(adultListing.listing.id === "12.04", `Adult listing used ${adultListing.listing.id}`, failures, "adult-listing-order");

  const attempt = graded("I am 60. I stopped working in 2024. I had to stop after 3 months because of the impairment. Dr. Ortiz examined me. The MRI of the lumbar spine showed nerve-root compression. It has lasted since 2019 and significantly limits sitting.");
  const step1 = attempt.sequential.steps.find((item) => item.step === 1);
  expect(step1?.explanation.includes("404.1574(c)") === true && attempt.sequential.decidedAtStep !== 1, step1?.explanation ?? "missing step 1", failures, "uwa-break-missing");

  const tooYoung = graded("The child is 2 years old. Listing 112.04. The child has not worked.");
  expect(tooYoung.listing.meets === false && tooYoung.listing.explanation.includes("age group"), tooYoung.listing.explanation, failures, "listing-age-band");
  const attained = readFacts({ narrative: "I stopped working in 2018. I have a 9th grade education.", filingDate: "2026-08-14", birthDate: "1976-08-15" }).facts;
  expect(attained.age === 50, `Age on the day before the birthday was ${attained.age}`, failures, "age-day-before-birthday");
  const overridden = readFacts({ narrative: "I am 40. I stopped working in 2018.", filingDate: "2026-06-01", birthDate: "1976-08-15" }).facts;
  expect(overridden.age === 49, `Stated age was kept over the birth date: ${overridden.age}`, failures, "birth-date-overrides-stated-age");
  const overriddenReport = graded("I am 40. I stopped working in 2018.", { narrative: "", filingDate: "2026-06-01", birthDate: "1976-08-15" });
  expect(overriddenReport.overrides.some((note) => note.includes("birth date")), overriddenReport.overrides.join(" | "), failures, "override-is-reported");
  const impossible = readFacts({ narrative: "I stopped working in 2018.", filingDate: "2026-06-01", birthDate: "2026-02-31" }).facts;
  expect(impossible.birthDate === null && impossible.age === null, `Impossible birth date was used: ${impossible.birthDate} age=${impossible.age}`, failures, "impossible-birth-date");

  return { passed: failures.length === 0, failures };
}
