import { sgaRuleText } from "./corpus.js";
import { borderlineWindow } from "./facts.js";
import type { Facts, ListingResult } from "./types.js";
import { applyVocational, sgaThreshold, type VocationalProfile } from "./grids.js";
import type { FactorResult, Outcome, SequentialResult, StepResult, VocationalResult } from "./types.js";

function step(partial: StepResult): StepResult {
  return partial;
}

function dollars(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

function finish(outcome: Outcome, decidedAtStep: SequentialResult["decidedAtStep"], headline: string, steps: StepResult[]): SequentialResult {
  return { outcome, decidedAtStep, headline, steps };
}

function profileOf(facts: Facts, exertional: VocationalProfile["exertional"], fullRange: boolean): VocationalProfile {
  return {
    age: facts.age,
    education: facts.education,
    directEntry: facts.directEntry,
    experience: facts.experience,
    exertional,
    fullRange,
    nonexertionalErosion: facts.nonexertionalErosion,
    veryLittleAdjustment: facts.veryLittleAdjustment,
  };
}

function experienceWords(experience: Facts["experience"]): string {
  if (experience === "not-transferable") return "not transferable";
  return experience ?? "unstated";
}

export function evaluateVocational(facts: Facts): VocationalResult {
  const profile = profileOf(facts, facts.rfc.exertional, facts.rfc.fullRange);
  let result = applyVocational(profile);
  if (!facts.pastWorkSgaShown && facts.experience !== null && facts.experience !== "none" && result.directed) {
    const withoutThatWork = applyVocational({ ...profile, experience: "none" });
    if (withoutThatWork.outcome !== result.outcome || withoutThatWork.directed !== result.directed) {
      const stated = result.ruleId ? `Rule ${result.ruleId} would direct ${result.outcome === "disabled" ? "disabled" : "not disabled"}` : "The stated experience would direct a conclusion";
      const asNone = withoutThatWork.directed
        ? `Treating the work as not past relevant work would direct ${withoutThatWork.outcome === "disabled" ? "disabled" : "not disabled"} under Rule ${withoutThatWork.ruleId}`
        : "Treating the work as not past relevant work would not direct a conclusion";
      result = {
        directed: false,
        outcome: "not-determinable",
        ruleId: null,
        explanation: `The filing describes the work as ${experienceWords(facts.experience)}, but it does not show that work was substantial gainful activity. 20 CFR 404.1560(b)(1) defines past relevant work as work that was substantial gainful activity. ${stated}. ${asNone}. Those results do not agree, so neither directs.`,
        citations: ["20 CFR 404.1560(b)"],
        candidates: [...result.candidates, ...withoutThatWork.candidates],
        borderline: null,
      };
    }
  }
  return flagBorderline(facts, result);
}

function flagBorderline(facts: Facts, chronological: VocationalResult): VocationalResult {
  if (!facts.birthDate || facts.age === null || !chronological.directed || chronological.outcome !== "not-disabled") {
    return { ...chronological, borderline: null };
  }
  const window = borderlineWindow(facts.birthDate, facts.referenceDate, facts.age);
  if (!window) return { ...chronological, borderline: null };
  const higher = applyVocational(profileOf({ ...facts, age: window.higherAge }, facts.rfc.exertional, facts.rfc.fullRange));
  if (!higher.directed || higher.outcome !== "disabled") return { ...chronological, borderline: null };
  const note = ` Borderline age under POMS DI 25001.001: the person attains age ${window.higherAge} in ${window.daysUntil} days. A borderline issue exists when the person is a few days to a few months from the next higher age category, use of the higher category would direct disabled, and use of chronological age would direct not disabled. Rule ${chronological.ruleId} is the chronological result. Rule ${higher.ruleId} is the higher-age result. This bench does not move the category. The flag uses six months because the POMS states no fixed cutoff.`;
  return {
    ...chronological,
    explanation: `${chronological.explanation}${note}`,
    candidates: [...chronological.candidates, ...higher.candidates],
    borderline: {
      daysUntilHigherAge: window.daysUntil,
      higherAge: window.higherAge,
      higherRuleId: higher.ruleId,
      chronologicalRuleId: chronological.ruleId,
    },
  };
}

function childEquivalence(facts: Facts): { met: boolean; detail: string } {
  const values = Object.values(facts.childDomains);
  const extremes = values.filter((value) => value === "extreme").length;
  const markeds = values.filter((value) => value === "marked").length;
  if (extremes >= 1 || markeds >= 2) {
    return { met: true, detail: "Medical evidence describes an extreme limitation in one domain, or a marked limitation in two domains (20 CFR 416.926a)." };
  }
  return { met: false, detail: "Functional equivalence for a child requires an extreme limitation in one of the six domains, or a marked limitation in two (20 CFR 416.926a). This filing does not establish that." };
}

export function evaluateSequential(facts: Facts, listing: ListingResult): { sequential: SequentialResult; vocational: VocationalResult } {
  const steps: StepResult[] = [];
  const blindSsi = facts.program === "title-xvi" && facts.statutoryBlindness;

  if (facts.workingNow === null) {
    steps.push(step({
      step: 1,
      title: "Substantial gainful activity",
      reached: true,
      outcome: "not-determinable",
      citation: "20 CFR 404.1520(b)",
      explanation: "Step 1 asks whether the person is doing substantial gainful activity. This filing does not say whether the person is working.",
    }));
    return { sequential: finish("not-determinable", 1, "Not determinable at step 1. The filing does not say whether the person is working. 20 CFR 404.1520(b).", steps), vocational: blankVocational() };
  }

  if (blindSsi) {
    steps.push(step({
      step: 1,
      title: "Substantial gainful activity",
      reached: true,
      outcome: "continue",
      citation: "20 CFR 416.984",
      explanation: "This is a Title XVI statutory-blindness claim. 20 CFR 416.984 says there is no requirement that the person be unable to work. Earnings are an income-and-resources question, not a step 1 denial. This bench does not apply the SSI income rules.",
    }));
  } else if (facts.workingNow && facts.selfEmployed) {
    steps.push(step({
      step: 1,
      title: "Substantial gainful activity",
      reached: true,
      outcome: "not-determinable",
      citation: "20 CFR 404.1575",
      explanation: "The person is self-employed. Countable employee wages are not the test. 20 CFR 404.1575 uses the three tests or the countable-income test. This filing does not resolve those tests.",
    }));
    return { sequential: finish("not-determinable", 1, "Not determinable at step 1. Self-employment is tested under 20 CFR 404.1575, not by a wage amount alone.", steps), vocational: blankVocational() };
  } else if (facts.workingNow) {
    if (facts.monthlyEarnings === null || facts.earningsYear === null) {
      steps.push(step({
        step: 1,
        title: "Substantial gainful activity",
        reached: true,
        outcome: "not-determinable",
        citation: "20 CFR 404.1574(b)",
        explanation: "The person is working, but monthly earnings or the year of the work are missing. The comparison is whether earnings average more than that year's SGA amount.",
      }));
      return { sequential: finish("not-determinable", 1, "Not determinable at step 1. Working is stated, and the monthly earnings or the year are not.", steps), vocational: blankVocational() };
    }
    const threshold = sgaThreshold(facts.earningsYear, facts.statutoryBlindness);
    if (!threshold) {
      steps.push(step({
        step: 1,
        title: "Substantial gainful activity",
        reached: true,
        outcome: "not-determinable",
        citation: "20 CFR 404.1574(b)(2)",
        explanation: `This bench does not have a sourced SGA amount for ${facts.earningsYear}. It will not borrow another year's figure.`,
      }));
      return { sequential: finish("not-determinable", 1, `Not determinable at step 1. No sourced SGA amount is loaded for ${facts.earningsYear}.`, steps), vocational: blankVocational() };
    }
    if (facts.subsidyOrIrweUnresolved && facts.monthlyEarnings > threshold.amount) {
      steps.push(step({
        step: 1,
        title: "Substantial gainful activity",
        reached: true,
        outcome: "not-determinable",
        citation: "20 CFR 404.1574(b)(1)",
        explanation: `Gross earnings are above ${dollars(threshold.amount)}, but the filing mentions a subsidy or impairment-related work expenses without the amount. Countable earnings are gross earnings minus those amounts.`,
      }));
      return { sequential: finish("not-determinable", 1, "Not determinable at step 1. Subsidy or impairment-related work expenses are mentioned and not quantified. 20 CFR 404.1574(b)(1).", steps), vocational: blankVocational() };
    }
    if (facts.monthlyEarnings > threshold.amount) {
      const who = facts.statutoryBlindness ? "blind" : "non-blind";
      steps.push(step({
        step: 1,
        title: "Substantial gainful activity",
        reached: true,
        outcome: "not-disabled",
        citation: "20 CFR 404.1520(b)",
        explanation: `Monthly earnings of ${dollars(facts.monthlyEarnings)} average more than the ${facts.earningsYear} ${who} SGA amount of ${dollars(threshold.amount)} (${threshold.source}). Earnings that average more than the amount ordinarily show SGA. ${sgaRuleText()}`,
      }));
      return {
        sequential: finish(
          "not-disabled",
          1,
          `Not disabled at step 1. ${dollars(facts.monthlyEarnings)} a month is more than the ${facts.earningsYear} ${who} SGA amount of ${dollars(threshold.amount)}. 20 CFR 404.1520(b); 20 CFR 404.1574(b)(2).`,
          steps,
        ),
        vocational: blankVocational(),
      };
    }
    steps.push(step({
      step: 1,
      title: "Substantial gainful activity",
      reached: true,
      outcome: "continue",
      citation: "20 CFR 404.1574(b)(3)",
      explanation: `Monthly earnings of ${dollars(facts.monthlyEarnings)} are equal to or less than the ${facts.earningsYear} amount of ${dollars(threshold.amount)}. 20 CFR 404.1574(b)(3) says those earnings ordinarily show that the person has not engaged in substantial gainful activity. The evaluation continues. Earnings at or below SGA are not themselves a finding of disability.`,
    }));
  } else {
    let explanation = "The filing says the person is not working. Step 1 does not direct a denial.";
    if (facts.unsuccessfulWorkAttempt) {
      explanation += " The filing also describes an unsuccessful work attempt and a break of at least 30 days. 20 CFR 404.1574(c) says that attempt does not show the ability to do substantial gainful activity. The person is not working now, so step 1 continues either way.";
    } else if (facts.workAttemptDescribed) {
      explanation += " The filing describes work of six months or less that stopped because of the impairment, but it does not state the significant break of at least 30 consecutive days that 20 CFR 404.1574(c) requires before that work is an unsuccessful work attempt. Step 1 still continues because the person is not working now.";
    }
    steps.push(step({
      step: 1,
      title: "Substantial gainful activity",
      reached: true,
      outcome: "continue",
      citation: facts.unsuccessfulWorkAttempt || facts.workAttemptDescribed ? "20 CFR 404.1574(c)" : "20 CFR 404.1520(b)",
      explanation,
    }));
  }

  if (!facts.objectiveFinding || !facts.amsNamed) {
    steps.push(step({
      step: 2,
      title: "Severe medically determinable impairment",
      reached: true,
      outcome: "not-determinable",
      citation: "20 CFR 404.1521",
      explanation: `A medically determinable impairment must be shown by objective medical evidence — signs, laboratory findings, or both — from an acceptable medical source. A symptom, a diagnosis, or a medical opinion does not establish it. The missing evidence is a development problem under 20 CFR 404.1520b, not a finding of not disabled.${facts.equivalenceAlleged ? " A statement that an impairment equals a listing does not establish medical equivalence. 20 CFR 404.1526 assigns that finding to the state-agency medical or psychological consultant, or at a hearing to the administrative law judge. This bench does not make it." : ""}`,
    }));
    return {
      sequential: finish("not-determinable", 2, "Not determinable at step 2. Objective medical evidence from an acceptable medical source is missing, so no medically determinable impairment is established. 20 CFR 404.1521.", steps),
      vocational: blankVocational(),
    };
  }
  if (facts.duration === "not-met") {
    steps.push(step({
      step: 2,
      title: "Severe medically determinable impairment",
      reached: true,
      outcome: "not-disabled",
      citation: "20 CFR 404.1509",
      explanation: "The impairment has neither lasted nor been expected to last for a continuous period of at least 12 months, and it is not expected to result in death.",
    }));
    return { sequential: finish("not-disabled", 2, "Not disabled at step 2. The duration requirement is not met. 20 CFR 404.1509; 20 CFR 404.1520(a)(4)(ii).", steps), vocational: blankVocational() };
  }
  if (facts.severe === "no") {
    steps.push(step({
      step: 2,
      title: "Severe medically determinable impairment",
      reached: true,
      outcome: "not-disabled",
      citation: "20 CFR 404.1520(c)",
      explanation: "The only severity language in the filing is mild, slight, or minimal, with no significant limit on a basic work activity. An impairment that does not significantly limit basic work activities is not severe.",
    }));
    return { sequential: finish("not-disabled", 2, "Not disabled at step 2. The impairment is not described as severe. 20 CFR 404.1520(c).", steps), vocational: blankVocational() };
  }
  if (facts.severe !== "yes" || facts.duration !== "met") {
    const missing = facts.mildCombinationOpen
      ? "whether the combined effect of the mild impairments significantly limits a basic work activity"
      : facts.severe !== "yes" ? "whether a basic work activity is significantly limited" : "whether the impairment has lasted or is expected to last at least 12 months";
    const citation = facts.mildCombinationOpen ? "20 CFR 404.1523" : "20 CFR 404.1520(c)";
    steps.push(step({
      step: 2,
      title: "Severe medically determinable impairment",
      reached: true,
      outcome: "not-determinable",
      citation,
      explanation: `Objective medical evidence is present. The filing still does not establish ${missing}.`,
    }));
    return { sequential: finish("not-determinable", 2, `Not determinable at step 2. The record does not establish ${missing}.`, steps), vocational: blankVocational() };
  }
  steps.push(step({
    step: 2,
    title: "Severe medically determinable impairment",
    reached: true,
    outcome: "continue",
    citation: "20 CFR 404.1520(c)",
    explanation: "Objective medical evidence from an acceptable medical source is present, a basic work activity is significantly limited, and the duration requirement is met. The impairment is severe. The evaluation continues.",
  }));

  if (facts.age !== null && facts.age < 18) {
    const equivalence = childEquivalence(facts);
    if (listing.meets || equivalence.met) {
      steps.push(step({
        step: 3,
        title: "Child listing or functional equivalence",
        reached: true,
        outcome: "disabled",
        citation: "20 CFR 416.924",
        explanation: listing.meets ? listing.explanation : equivalence.detail,
      }));
      return { sequential: finish("disabled", 3, `Disabled at step 3 under the child standard. ${listing.meets ? listing.explanation : equivalence.detail}`, steps), vocational: blankVocational() };
    }
    steps.push(step({
      step: 3,
      title: "Child listing or functional equivalence",
      reached: true,
      outcome: "not-determinable",
      citation: "20 CFR 416.926a",
      explanation: `${listing.explanation} ${equivalence.detail} Adult grid rules are not used for a person under 18.`,
    }));
    return { sequential: finish("not-determinable", 3, "Not determinable at step 3. The child listing is not met and functional equivalence is not established. 20 CFR 416.924; 20 CFR 416.926a.", steps), vocational: blankVocational() };
  }

  if (listing.meets) {
    steps.push(step({
      step: 3,
      title: "Listing of Impairments",
      reached: true,
      outcome: "disabled",
      citation: "20 CFR 404.1520(d)",
      explanation: listing.explanation,
    }));
    return { sequential: finish("disabled", 3, `Disabled at step 3. Listing ${listing.id} is met on path ${listing.path}, and the 12-month duration requirement is met. 20 CFR 404.1520(d).`, steps), vocational: blankVocational() };
  }
  steps.push(step({
    step: 3,
    title: "Listing of Impairments",
    reached: true,
    outcome: "continue",
    citation: "20 CFR 404.1525",
    explanation: facts.equivalenceAlleged
      ? `${listing.explanation} The filing says an impairment equals a listing. That statement does not establish medical equivalence. 20 CFR 404.1526 assigns the equivalence finding to the state-agency medical or psychological consultant, or at a hearing to the administrative law judge. This bench does not make it.`
      : listing.explanation,
  }));

  const profileHit = medicalVocationalProfile(facts);
  if (profileHit) {
    steps.push(step({
      step: 4,
      title: "Past relevant work",
      reached: true,
      outcome: "continue",
      citation: "20 CFR 404.1562",
      explanation: "A medical-vocational profile in 20 CFR 404.1562 applies, so past relevant work does not have to be compared with a residual functional capacity.",
    }));
    steps.push(step({
      step: 5,
      title: "Adjustment to other work",
      reached: true,
      outcome: "disabled",
      citation: profileHit.citation,
      explanation: profileHit.explanation,
    }));
    return { sequential: finish("disabled", 5, profileHit.headline, steps), vocational: blankVocational() };
  }

  if (facts.confirmedPrw.length > 0 && facts.rfc.established && facts.rfc.exertional !== "unknown" && facts.rfc.exertional !== "less-than-sedentary") {
    const canDo = facts.confirmedPrw.some((job) => job.liftPounds !== null && exertionalRank(facts.rfc.exertional) >= rankFromLift(job.liftPounds));
    if (canDo) {
      steps.push(step({
        step: 4,
        title: "Past relevant work",
        reached: true,
        outcome: "not-disabled",
        citation: "20 CFR 404.1560(b)",
        explanation: "The established residual functional capacity covers the lifting demands the filing gives for past relevant work as actually performed. A person who can do past relevant work as actually performed is not disabled.",
      }));
      return { sequential: finish("not-disabled", 4, "Not disabled at step 4. The residual functional capacity covers past relevant work as actually performed. 20 CFR 404.1560(b).", steps), vocational: blankVocational() };
    }
  }
  const recentSkilled = facts.work.filter((job) => job.withinFiveYears === true && !job.underThirtyDays && job.skill !== null);
  const missingSga = recentSkilled.filter((job) => !job.sgaShown);
  const noPrw = facts.confirmedPrw.length === 0
    ? missingSga.length > 0
      ? "A job is described within the five-year period, with a skill level, and it did not start and stop in fewer than 30 calendar days. The filing does not show that the job was substantial gainful activity. 20 CFR 404.1560(b)(1) defines past relevant work as work that was substantial gainful activity and that lasted long enough to learn. Step 4 does not find that the person can do that job. The evaluation goes to step 5. The five-year period here is measured from the filing date, or from today if no filing date was given, as a stand-in for the future determination date. This bench has no date last insured, so it does not shorten that period."
      : "No job in the filing is established as past relevant work: work within the five-year period that was substantial gainful activity, that was stated as unskilled, semiskilled, or skilled, and that did not start and stop in fewer than 30 calendar days (20 CFR 404.1560(b)(1)). The evaluation goes to step 5. The five-year period here is measured from the filing date, or from today if no filing date was given, as a stand-in for the future determination date. This bench has no date last insured, so it does not shorten that period."
    : "Past work as actually performed exceeds the residual functional capacity, or the demands were not stated. Work as generally performed in the national economy is not in this filing. 20 CFR 404.1520(h) allows the evaluation to go on to step 5.";
  steps.push(step({
    step: 4,
    title: "Past relevant work",
    reached: true,
    outcome: "continue",
    citation: missingSga.length > 0 && facts.confirmedPrw.length === 0 ? "20 CFR 404.1560(b)" : "20 CFR 404.1520(h)",
    explanation: noPrw,
  }));

  const vocational = evaluateVocational(facts);
  steps.push(step({
    step: 5,
    title: "Adjustment to other work",
    reached: true,
    outcome: vocational.outcome,
    citation: vocational.citations[0] ?? "20 CFR 404.1560(c)",
    explanation: vocational.explanation,
  }));
  const headline = vocational.directed
    ? `${vocational.outcome === "disabled" ? "Disabled" : "Not disabled"} at step 5. ${vocational.explanation}`
    : `Not determinable at step 5. ${vocational.explanation}`;
  return { sequential: finish(vocational.outcome, 5, headline, steps), vocational };
}

function blankVocational(): VocationalResult {
  return { directed: false, outcome: "not-determinable", ruleId: null, explanation: "The vocational rules were not reached.", citations: [], candidates: [], borderline: null };
}

function medicalVocationalProfile(facts: Facts): { citation: string; explanation: string; headline: string } | null {
  const mdi = facts.objectiveFinding && facts.amsNamed && facts.severe === "yes" && facts.duration === "met";
  const limitedOrLess = facts.education === "illiterate" || facts.education === "marginal" || facts.education === "limited";
  if (mdi && facts.age !== null && facts.age >= 55 && limitedOrLess && (facts.neverWorked || facts.experience === "none")) {
    return {
      citation: "20 CFR 404.1562(b)",
      explanation: "The person is at least 55, has a limited education or less, has no past relevant work, and has a severe medically determinable impairment that meets the duration requirement. 20 CFR 404.1562(b) directs disabled. A residual functional capacity is not required.",
      headline: "Disabled at step 5 under the no-work profile in 20 CFR 404.1562(b).",
    };
  }
  const marginalOrLess = facts.education === "illiterate" || facts.education === "marginal";
  if (mdi && facts.workingNow === false && marginalOrLess && facts.arduousYears !== null && facts.arduousYears >= 35 && facts.cannotDoArduousWork && facts.experience !== "transferable") {
    return {
      citation: "20 CFR 404.1562(a)",
      explanation: "The filing states at least 35 years of arduous unskilled work, a marginal education or less, and that the person can no longer do that work because of a severe impairment. 20 CFR 404.1562(a) directs disabled.",
      headline: "Disabled at step 5 under the arduous-work profile in 20 CFR 404.1562(a).",
    };
  }
  return null;
}

function exertionalRank(level: string): number {
  switch (level) {
    case "less-than-sedentary": return 0;
    case "sedentary": return 1;
    case "light": return 2;
    case "medium": return 3;
    case "heavy": return 4;
    case "very-heavy": return 5;
    default: return -1;
  }
}

function rankFromLift(pounds: number): number {
  if (pounds > 100) return 5;
  if (pounds > 50) return 4;
  if (pounds > 20) return 3;
  if (pounds > 10) return 2;
  return 1;
}

interface CheckSpec {
  id: string;
  label: string;
  weight: number;
  met: boolean;
  citation: string;
  detail: string;
}

function factor(id: string, label: string, citation: string, anchor: string, applicable: boolean, checks: CheckSpec[]): FactorResult {
  const weight = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = applicable ? checks.reduce((sum, check) => sum + (check.met ? check.weight : 0), 0) : 0;
  const metCount = checks.filter((check) => check.met).length;
  return {
    id,
    label,
    weight,
    earned,
    applicable,
    citation,
    anchor,
    summary: applicable ? `${metCount} of ${checks.length} elements of ${citation} are in the filing.` : `${label} does not apply to this filing, so its points are taken out of the index and the rest are scaled to 100.`,
    checks: checks.map((check) => ({ ...check, earned: check.met ? check.weight : 0 })),
  };
}

export function scoreFactors(facts: Facts, listing: ListingResult): FactorResult[] {
  const functionalOpinion = facts.opinions.some((opinion) => !opinion.reservedOnly && (opinion.limits.length > 0 || opinion.explanation));
  const best = facts.opinions.find((opinion) => !opinion.reservedOnly) ?? null;
  const listingPoints = listing.meets ? 6 : listing.lettersTotal === 0 ? 0 : Math.round((6 * listing.lettersAddressed) / listing.lettersTotal);
  const symptomChecks: CheckSpec[] = [
    { id: "link", label: "Symptom linked to a medically determinable impairment", weight: 3, met: facts.symptomLinked, citation: "20 CFR 404.1529(b)", detail: "There must be objective medical evidence of an impairment that could reasonably produce the symptom." },
    { id: "daily", label: "Daily activities", weight: 1, met: facts.symptomFactors["daily-activities"], citation: "20 CFR 404.1529(c)(3)(i)", detail: "Daily activities are addressed." },
    { id: "intensity", label: "Location, duration, frequency, and intensity", weight: 1, met: facts.symptomFactors["location-duration-frequency-intensity"], citation: "20 CFR 404.1529(c)(3)(ii)", detail: "Location, duration, frequency, or intensity is addressed." },
    { id: "precipitating", label: "Precipitating and aggravating factors", weight: 1, met: facts.symptomFactors["precipitating-aggravating"], citation: "20 CFR 404.1529(c)(3)(iii)", detail: "What brings the symptom on or makes it worse is addressed." },
    { id: "medication", label: "Medication", weight: 1, met: facts.symptomFactors.medication, citation: "20 CFR 404.1529(c)(3)(iv)", detail: "Type, dosage, effectiveness, or side effects are addressed." },
    { id: "treatment", label: "Treatment other than medication", weight: 1, met: facts.symptomFactors["other-treatment"], citation: "20 CFR 404.1529(c)(3)(v)", detail: "Other treatment is addressed." },
    { id: "measures", label: "Measures used to relieve symptoms", weight: 1, met: facts.symptomFactors.measures, citation: "20 CFR 404.1529(c)(3)(vi)", detail: "Measures such as lying down, ice, or heat are addressed." },
    { id: "other", label: "Other symptom factors", weight: 1, met: facts.symptomFactors["other-factors"], citation: "20 CFR 404.1529(c)(3)(vii)", detail: "Another factor about how symptoms limit function is addressed." },
  ];
  const physical = facts.physicalAlleged || !facts.mentalAlleged;
  const mental = facts.mentalAlleged || !facts.physicalAlleged;
  const rfcChecks: CheckSpec[] = [];
  if (physical) {
    rfcChecks.push(
      { id: "sit", label: "Sitting", weight: 2, met: facts.functionFlags.sit, citation: "20 CFR 404.1545(b)", detail: "Sitting is addressed in functional terms." },
      { id: "stand", label: "Standing or walking", weight: 2, met: facts.functionFlags.standWalk, citation: "20 CFR 404.1545(b)", detail: "Standing or walking is addressed." },
      { id: "lift", label: "Lifting or carrying", weight: 2, met: facts.functionFlags.lift, citation: "20 CFR 404.1545(b)", detail: "Lifting or carrying is addressed." },
      { id: "postural", label: "Postural or manipulative", weight: 1, met: facts.functionFlags.postural, citation: "20 CFR 404.1545(b)", detail: "A postural or manipulative function is addressed." },
    );
  }
  if (mental) {
    rfcChecks.push({ id: "mental", label: "Mental work functions", weight: 2, met: facts.functionFlags.mentalAreas >= 2, citation: "20 CFR 404.1545(c)", detail: "At least two mental work abilities, or the paragraph B areas, are addressed." });
  }
  rfcChecks.push({ id: "workday", label: "Regular and continuing basis", weight: 1, met: facts.functionFlags.workday, citation: "20 CFR 404.1545(b)", detail: "The limits are stated for a workday, not as an undefined label." });
  const rfcWeight = rfcChecks.reduce((sum, check) => sum + check.weight, 0);
  const rfcEarned = rfcChecks.reduce((sum, check) => sum + (check.met ? check.weight : 0), 0);
  const scaledRfc = rfcWeight === 0 ? 0 : Math.round((10 * rfcEarned) / rfcWeight);
  const child = facts.age !== null && facts.age < 18;
  const domainEntries = Object.entries(facts.childDomains);
  const modern = facts.opinionRule === "404.1520c";
  const support = modern
    ? { citation: "20 CFR 404.1520c(c)(1)", anchor: "The more relevant the objective medical evidence and supporting explanations" }
    : { citation: "20 CFR 404.1527(c)(3)", anchor: "The more a medical source presents relevant evidence to support a medical opinion" };
  const consistency = modern
    ? { citation: "20 CFR 404.1520c(c)(2)", anchor: "The more consistent a medical opinion" }
    : { citation: "20 CFR 404.1527(c)(4)", anchor: "the more consistent a medical opinion is with the record as a whole" };
  const relationship = modern
    ? { citation: "20 CFR 404.1520c(c)(3)", anchor: "Relationship with the claimant" }
    : { citation: "20 CFR 404.1527(c)(2)", anchor: "Treatment relationship" };
  const specialty = { citation: modern ? "20 CFR 404.1520c(c)(4)" : "20 CFR 404.1527(c)(5)" };
  const familiar = { citation: modern ? "20 CFR 404.1520c(c)(5)" : "20 CFR 404.1527(c)(6)" };

  const factors: FactorResult[] = [
    factor("sga", "Work and substantial gainful activity", "20 CFR 404.1520(b)", "If you are working and the work you are doing is substantial gainful activity", true, [
      { id: "status", label: "Work status", weight: 3, met: facts.workingNow !== null, citation: "20 CFR 404.1520(b)", detail: facts.workingNow === null ? "The filing does not say whether the person is working." : "Work status is stated." },
      { id: "amount", label: "Earnings or a reason wages are not the test", weight: 3, met: facts.workingNow === false || facts.monthlyEarnings !== null || facts.selfEmployed, citation: "20 CFR 404.1574(b)", detail: "Either the person is not working, monthly earnings are stated, or self-employment is identified so the wage test is not misused." },
    ]),
    factor("mdi", "Medically determinable impairment", "20 CFR 404.1521", "must be established by objective medical evidence from an acceptable medical source", true, [
      { id: "source", label: "Acceptable medical source", weight: 4, met: facts.amsNamed, citation: "20 CFR 404.1502(a)", detail: facts.amsNamed ? "An acceptable medical source is named." : "No acceptable medical source is named." },
      { id: "objective", label: "Sign or laboratory finding", weight: 7, met: facts.objectiveFinding, citation: "20 CFR 404.1502(f)", detail: facts.objectiveFinding ? "A sign or laboratory finding is stated." : "There is no sign or laboratory finding. A diagnosis is not enough." },
      { id: "tied", label: "Finding tied to the impairment", weight: 3, met: facts.objectiveTied, citation: "20 CFR 404.1521", detail: facts.objectiveTied ? "The finding is tied to a body system or condition named in the filing." : "The objective finding is not tied to the alleged impairment." },
    ]),
    factor("severity", "Severity and duration", "20 CFR 404.1520(c)", "significantly limits your physical or mental ability to do basic work activities", true, [
      { id: "severe", label: "Effect on basic work activities", weight: 4, met: facts.severe !== "unknown", citation: "20 CFR 404.1522", detail: facts.severe === "unknown" ? "The filing does not say how a basic work activity is limited." : `Severity is addressed: ${facts.severe}.` },
      { id: "duration", label: "Duration", weight: 4, met: facts.duration !== "unknown", citation: "20 CFR 404.1509", detail: facts.duration === "unknown" ? "The 12-month duration requirement is not addressed." : `Duration is ${facts.duration === "met" ? "met" : "not met"}.` },
      { id: "combination", label: "Combined effect", weight: 2, met: facts.diagnosisCount < 2 || facts.combinationAddressed, citation: "20 CFR 404.1523", detail: facts.diagnosisCount < 2 ? "One impairment is alleged, so combination is not a separate hole." : facts.combinationAddressed ? "The combined effect is addressed." : "More than one impairment is alleged and the combined effect is not addressed." },
    ]),
    factor("listing", "Listing theory", "20 CFR 404.1525", "the Listing of Impairments", true, [
      { id: "named", label: "A listing in Appendix 1 is named", weight: 4, met: listing.inCorpus, citation: "20 CFR 404.1520(d)", detail: listing.id ? `Listing ${listing.id} ${listing.inCorpus ? "is" : "is not"} in the loaded Appendix 1.` : "No listing is named." },
      { id: "criteria", label: "Lettered criteria addressed by medical evidence", weight: 6, met: listing.meets || listingPoints === 6, citation: "20 CFR 404.1525", detail: listing.explanation },
    ]),
    factor("supportability", "Supportability", support.citation, support.anchor, true, [
      { id: "own-objective", label: "The source's own objective evidence", weight: 7, met: Boolean(best?.ownObjective), citation: support.citation, detail: best?.ownObjective ? `${best.name} presents objective evidence with the opinion.` : "No medical opinion is tied to that source's own signs or laboratory findings." },
      { id: "explanation", label: "The source's explanation", weight: 7, met: Boolean(best?.explanation), citation: support.citation, detail: best?.explanation ? `${best.name} explains the opinion.` : "No medical opinion explains why. A conclusory 'disabled' or 'sedentary' is not this explanation (20 CFR 404.1520b(c)(3))." },
    ]),
    factor("consistency", "Consistency", consistency.citation, consistency.anchor, true, [
      { id: "medical", label: "Consistent with other medical evidence", weight: 7, met: functionalOpinion && facts.medicalConflict === null && facts.objectiveFinding, citation: consistency.citation, detail: facts.medicalConflict ?? (functionalOpinion && facts.objectiveFinding ? "The opinion is not contradicted by other medical evidence in the filing." : "There is no functional medical opinion to compare, or no other medical evidence.") },
      { id: "nonmedical", label: "No unresolved conflict with nonmedical evidence", weight: 7, met: functionalOpinion && facts.nonmedicalConflict === null, citation: consistency.citation, detail: facts.nonmedicalConflict ?? (functionalOpinion ? "No nonmedical statement conflicts with the opinion on the same function." : "There is no functional medical opinion.") },
    ]),
    factor("other-factors", "Relationship, specialization, and other factors", relationship.citation, relationship.anchor, true, [
      { id: "relationship", label: "Treatment or examining relationship", weight: 2, met: facts.opinions.some((opinion) => opinion.treating || opinion.examining), citation: relationship.citation, detail: "Length, frequency, purpose, extent, or an examination is stated. These factors are not the most important ones." },
      { id: "specialty", label: "Specialization", weight: 2, met: facts.opinions.some((opinion) => opinion.specialty), citation: specialty.citation, detail: "A specialty is stated." },
      { id: "familiar", label: "Familiarity with the record or the program", weight: 2, met: facts.opinions.some((opinion) => opinion.familiar), citation: familiar.citation, detail: "Familiarity with the other evidence or with the disability program is stated." },
    ]),
    factor("symptoms", "Symptoms", "20 CFR 404.1529(c)(3)", "Your daily activities", facts.symptomAlleged, symptomChecks),
    {
      id: "rfc",
      label: "Function-by-function residual functional capacity",
      weight: 10,
      earned: scaledRfc,
      applicable: true,
      citation: "20 CFR 404.1545",
      anchor: "your residual functional capacity",
      summary: `Function-by-function elements are scored only for the kind of impairment alleged, then scaled to 10. ${scaledRfc} of 10.`,
      checks: rfcChecks.map((check) => ({ ...check, earned: check.met ? check.weight : 0 })),
    },
  ];

  if (child) {
    factors.push(factor("domains", "Child functional domains", "20 CFR 416.926a", "Acquiring and using information", true, domainEntries.map(([domain, level]) => ({
      id: domain,
      label: domain,
      weight: 1,
      met: level !== "absent",
      citation: "20 CFR 416.926a",
      detail: level === "absent" ? "This domain is not addressed." : `This domain is ${level}.`,
    }))));
  } else {
    factors.push(
      factor("prw", "Past relevant work", "20 CFR 404.1560", "past relevant work", true, [
        { id: "job", label: "Work identified, or none", weight: 1, met: facts.neverWorked || facts.work.length > 0, citation: "20 CFR 404.1560(b)", detail: facts.neverWorked ? "The filing says there is no past work." : facts.work.length > 0 ? "A job is identified." : "No job is identified." },
        { id: "when", label: "When the work happened", weight: 1, met: facts.neverWorked || facts.work.some((job) => job.end !== null || job.calendarDays !== null), citation: "20 CFR 404.1560(b)(1)", detail: "Dates, or a statement of no past work, let the five-year and 30-day rules be applied." },
        { id: "demands", label: "How the work was performed", weight: 1, met: facts.neverWorked || facts.work.some((job) => job.liftPounds !== null), citation: "20 CFR 404.1560(b)", detail: "The actual demands, such as pounds lifted, are what step 4 compares with residual functional capacity." },
      ]),
      factor("vocational", "Age, education, and skill", "20 CFR 404.1563", "Your age", true, [
        { id: "age", label: "Age", weight: 1, met: facts.age !== null, citation: "20 CFR 404.1563", detail: facts.age === null ? "Age is not stated." : `Age ${facts.age} is stated.` },
        { id: "education", label: "Education", weight: 1, met: facts.education !== null, citation: "20 CFR 404.1564", detail: facts.education === null ? "Education is not stated as illiteracy, a grade, or high school or more." : `Education is ${facts.education}.` },
        { id: "skill", label: "Skill or no work", weight: 1, met: facts.experience !== null, citation: "20 CFR 404.1568", detail: facts.experience === null ? "Skill level and transferability are not both resolved." : `Work experience for the grid is ${facts.experience}.` },
      ]),
    );
  }

  const listingFactor = factors.find((item) => item.id === "listing");
  if (listingFactor) {
    const criteria = listingFactor.checks.find((check) => check.id === "criteria");
    if (criteria) criteria.earned = listingPoints;
    listingFactor.earned = (listing.inCorpus ? 4 : 0) + listingPoints;
  }

  const weight = factors.reduce((sum, item) => sum + item.weight, 0);
  if (weight !== 100) {
    throw new Error(`Filing-strength weights sum to ${weight}, not 100.`);
  }
  return factors;
}

export function filingStrength(factors: FactorResult[]): number {
  const applicable = factors.filter((item) => item.applicable);
  const weight = applicable.reduce((sum, item) => sum + item.weight, 0);
  const earned = applicable.reduce((sum, item) => sum + item.earned, 0);
  if (weight <= 0) return 0;
  return Math.round((earned * 100) / weight);
}

export function pointsLeft(factors: FactorResult[]): number {
  return 100 - filingStrength(factors);
}
