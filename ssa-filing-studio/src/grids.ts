import { gridProse, gridRules, sgaAmount } from "./corpus.js";
import type { Education, Exertional, ExperienceKind, Outcome, VocationalResult } from "./types.js";

export interface VocationalProfile {
  age: number | null;
  education: Education | null;
  directEntry: boolean | null;
  experience: ExperienceKind | null;
  exertional: Exertional;
  fullRange: boolean;
  nonexertionalErosion: boolean;
  veryLittleAdjustment: boolean;
}

const AGE_PREFERENCE = [
  "Closely approaching retirement age",
  "Younger individual age 45-49",
  "Younger individual age 18-44",
  "Advanced age",
  "Closely approaching advanced age",
  "Younger individual",
];

function ageCandidates(age: number): string[] {
  const labels: string[] = [];
  if (age >= 60) labels.push("Closely approaching retirement age");
  if (age >= 45 && age <= 49) labels.push("Younger individual age 45-49");
  if (age >= 18 && age <= 44) labels.push("Younger individual age 18-44");
  if (age >= 55) labels.push("Advanced age");
  if (age >= 50 && age <= 54) labels.push("Closely approaching advanced age");
  if (age >= 18 && age <= 49) labels.push("Younger individual");
  return AGE_PREFERENCE.filter((label) => labels.includes(label));
}

function educationTier(ruleEducation: string, education: Education, directEntry: boolean | null): number | null {
  const text = ruleEducation.toLowerCase();
  const highSchool = text.includes("high school");
  if (education === "high-school-or-more") {
    if (!highSchool) return null;
    if (text.includes("provides for direct entry")) return directEntry === true ? 3 : null;
    if (text.includes("does not provide")) return directEntry === false ? 3 : null;
    return 2;
  }
  if (highSchool) return null;
  const exactIlliterate = text === "illiterate";
  const marginalOrIlliterate = text.includes("marginal or illiterate");
  const notIlliterate = text.includes("not illiterate");
  const limitedExact = text === "limited";
  const limitedOrLess = text.includes("limited or less");
  const limitedOrMarginal = text.includes("limited or marginal");
  if (education === "illiterate") {
    if (notIlliterate) return null;
    if (exactIlliterate) return 4;
    if (marginalOrIlliterate) return 3;
    if (limitedOrLess) return 1;
    return null;
  }
  if (education === "marginal") {
    if (exactIlliterate && !marginalOrIlliterate) return null;
    if (limitedExact) return null;
    if (notIlliterate || limitedOrMarginal || marginalOrIlliterate) return 3;
    if (limitedOrLess) return 1;
    return null;
  }
  if (education === "limited") {
    if (marginalOrIlliterate || exactIlliterate) return null;
    if (limitedExact) return 4;
    if (limitedOrMarginal || notIlliterate) return 3;
    if (limitedOrLess) return 1;
    return null;
  }
  return null;
}

function experienceTier(ruleExperience: string, experience: ExperienceKind): number | null {
  const text = ruleExperience.toLowerCase();
  const transferable = text.includes("transferable") && !text.includes("not transferable");
  const notTransferable = text.includes("not transferable");
  if (experience === "transferable") return transferable ? 3 : null;
  if (experience === "not-transferable") return notTransferable ? 3 : null;
  if (experience === "none") {
    if (text === "none") return 3;
    if (text.includes("unskilled or none")) return 1;
    return null;
  }
  if (experience === "unskilled") {
    if (text === "unskilled") return 3;
    if (text.includes("unskilled or none")) return 1;
    return null;
  }
  return null;
}

function proseHas(phrase: string): boolean {
  return gridProse().some((paragraph) => paragraph.toLowerCase().includes(phrase.toLowerCase()));
}

function notDirected(explanation: string, citations: string[], candidates: VocationalResult["candidates"] = []): VocationalResult {
  return { directed: false, outcome: "not-determinable", ruleId: null, explanation, citations, candidates };
}

export function applyVocational(profile: VocationalProfile): VocationalResult {
  if (profile.exertional === "unknown" || !profile.age || !profile.education || !profile.experience) {
    return notDirected(
      "A grid rule directs a conclusion only when age, education, work experience, and the full exertional range all coincide with the rule (Appendix 2, 200.00(a)). One of those findings is missing.",
      ["20 CFR Part 404 Subpart P Appendix 2"],
    );
  }
  if (profile.exertional === "heavy" || profile.exertional === "very-heavy") {
    if (!profile.fullRange) {
      return notDirected("Heavy or very heavy work is not a full range on this record, so 204.00 does not direct a conclusion.", ["20 CFR Part 404 Subpart P Appendix 2"]);
    }
    if (profile.nonexertionalErosion) {
      return notDirected("Appendix 2, 200.00(e) says the rules may not fully apply where a significant nonexertional limitation remains. 204.00 is only a framework here.", ["20 CFR Part 404 Subpart P Appendix 2"]);
    }
    return {
      directed: true,
      outcome: "not-disabled",
      ruleId: null,
      explanation: "Appendix 2, 204.00 says the capacity for heavy or very heavy work ordinarily is not the basis for a finding of disabled. The person retains substantial work capability at all lesser levels.",
      citations: ["20 CFR Part 404 Subpart P Appendix 2, 204.00"],
      candidates: [],
    };
  }
  if (profile.exertional === "less-than-sedentary" || !profile.fullRange) {
    const sedentary = profile.exertional === "less-than-sedentary"
      ? applyVocational({ ...profile, exertional: "sedentary", fullRange: true, nonexertionalErosion: false })
      : null;
    if (sedentary?.directed && sedentary.outcome === "disabled") {
      return {
        directed: true,
        outcome: "disabled",
        ruleId: sedentary.ruleId,
        explanation: `The full range of sedentary work would already direct disabled under Rule ${sedentary.ruleId}. A narrower residual functional capacity does not create jobs that rule says are unavailable (Appendix 2, 200.00(e)(2)). ${profile.exertional === "less-than-sedentary" ? "The medical limits are below sedentary work." : "The full range of the stated exertional level was not established."}`,
        citations: ["20 CFR Part 404 Subpart P Appendix 2, 200.00(e)(2)"],
        candidates: sedentary.candidates,
      };
    }
    const youngerNote = profile.age < 50 && proseHas("does not necessarily equate with a finding of “disabled.”")
      ? " Appendix 2, 201.00(h)(3) says the inability to perform a full range of sedentary work does not necessarily equate with a finding of disabled."
      : "";
    return notDirected(
      `The residual functional capacity is ${profile.exertional === "less-than-sedentary" ? "less than sedentary" : "not a full exertional range"}. No rule directs a conclusion unless every finding coincides with the rule (Appendix 2, 200.00(a)).${youngerNote}`,
      ["20 CFR Part 404 Subpart P Appendix 2, 200.00(a)"],
      sedentary?.candidates ?? [],
    );
  }

  const table = profile.exertional;
  const rules = gridRules().filter((rule) => rule.exertional === table);
  const ageLabel = ageCandidates(profile.age).find((label) => rules.some((rule) => rule.age === label));
  if (!ageLabel) {
    return notDirected("No medical-vocational rule in this exertional table uses this age category.", ["20 CFR Part 404 Subpart P Appendix 2"]);
  }
  const aged = rules.filter((rule) => rule.age === ageLabel);
  const experienceScored = aged
    .map((rule) => ({ rule, tier: experienceTier(rule.experience, profile.experience as ExperienceKind) }))
    .filter((entry): entry is { rule: typeof aged[number]; tier: number } => entry.tier !== null);
  const bestExperience = Math.max(...experienceScored.map((entry) => entry.tier), 0);
  const experienced = experienceScored.filter((entry) => entry.tier === bestExperience).map((entry) => entry.rule);
  const educationScored = experienced
    .map((rule) => ({ rule, tier: educationTier(rule.education, profile.education as Education, profile.directEntry) }))
    .filter((entry): entry is { rule: typeof experienced[number]; tier: number } => entry.tier !== null);
  if (educationScored.length === 0) {
    return notDirected(
      `No rule for ${ageLabel} and this work experience matches the education finding. Where education is high school or more, a rule that turns on direct entry into skilled work does not apply unless the record makes that finding (Appendix 2, 200.00(a)).`,
      ["20 CFR Part 404 Subpart P Appendix 2, 200.00(a)"],
    );
  }
  const bestEducation = Math.max(...educationScored.map((entry) => entry.tier));
  const matched = educationScored.filter((entry) => entry.tier === bestEducation).map((entry) => entry.rule);
  const candidates = matched.map((rule) => ({
    id: rule.id,
    decision: rule.decision as Outcome,
    age: rule.age,
    education: rule.education,
    experience: rule.experience,
  }));
  if (matched.length !== 1) {
    return notDirected("More than one grid rule matches these findings, so none of them directs a conclusion.", ["20 CFR Part 404 Subpart P Appendix 2, 200.00(a)"], candidates);
  }
  const rule = matched[0];
  if (!rule) return notDirected("No rule matched.", ["20 CFR Part 404 Subpart P Appendix 2"]);
  const needsLittleAdjustment =
    rule.decision === "not-disabled" &&
    profile.experience === "transferable" &&
    ((table === "sedentary" && profile.age >= 55) || (table === "light" && profile.age >= 60));
  if (needsLittleAdjustment && !profile.veryLittleAdjustment) {
    const cite = table === "sedentary" ? "201.00(f)" : "202.00(f)";
    return notDirected(
      `Rule ${rule.id} would direct not disabled only if skills transfer. Appendix 2, ${cite} requires very little, if any, vocational adjustment before skills are found transferable in this age and exertional category. The filing does not make that finding, so the rule does not direct a conclusion.`,
      [`20 CFR Part 404 Subpart P Appendix 2, ${cite}`],
      candidates,
    );
  }
  if (rule.decision === "not-disabled" && profile.nonexertionalErosion) {
    return notDirected(
      `Rule ${rule.id} would direct not disabled on strength limits alone. A significant nonexertional limitation keeps the rule as a framework only (Appendix 2, 200.00(e)(2); 20 CFR 404.1569a). Vocational evidence is required. This bench does not invent job numbers.`,
      ["20 CFR Part 404 Subpart P Appendix 2, 200.00(e)(2)", "20 CFR 404.1569a"],
      candidates,
    );
  }
  return {
    directed: true,
    outcome: rule.decision,
    ruleId: rule.id,
    explanation: `Rule ${rule.id} directs ${rule.decision === "disabled" ? "disabled" : "not disabled"}: ${rule.age}; ${rule.education}; ${rule.experience}. Every finding used here is in the record, and the rule's decision is the decision printed in Appendix 2.`,
    citations: [`20 CFR Part 404 Subpart P Appendix 2, Rule ${rule.id}`],
    candidates,
  };
}

export function sgaThreshold(year: number, blind: boolean): { amount: number; source: string } | null {
  const row = sgaAmount(year, blind);
  if (!row) return null;
  return { amount: blind ? row.blind : row.nonBlind, source: row.source };
}
