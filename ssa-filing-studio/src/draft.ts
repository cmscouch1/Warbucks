import type { Draft, FactorResult, Facts, ListingResult, SequentialResult } from "./types.js";

const ALLOWED_NUMBERS = new Set(["20", "404", "416", "1509", "1513", "1520", "1521", "1522", "1523", "1525", "1529", "1545", "1560", "1562", "1563", "1564", "1567", "1568", "1569", "1574", "1575", "926", "984"]);

function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d+/g)].map((match) => match[0] ?? "");
}

export function novelNumbers(original: string, revised: string): string[] {
  const allowed = new Set(numbersIn(original));
  for (const number of ALLOWED_NUMBERS) allowed.add(number);
  const found = new Set<string>();
  for (const number of numbersIn(revised)) {
    if (!allowed.has(number)) found.add(number);
  }
  return [...found];
}

function plainOutcome(outcome: string): string {
  if (outcome === "not-disabled") return "not disabled";
  if (outcome === "not-determinable") return "not determinable";
  return outcome;
}

const FACTORS_REACHED: Record<1 | 2 | 3 | 4 | 5, readonly string[]> = {
  1: ["sga"],
  2: ["sga", "mdi", "severity"],
  3: ["sga", "mdi", "severity", "listing", "supportability", "consistency", "other-factors", "symptoms", "domains"],
  4: ["sga", "mdi", "severity", "listing", "supportability", "consistency", "other-factors", "symptoms", "domains", "rfc", "prw"],
  5: ["sga", "mdi", "severity", "listing", "supportability", "consistency", "other-factors", "symptoms", "domains", "rfc", "prw", "vocational"],
};

export function buildDraft(narrative: string, facts: Facts, factors: FactorResult[], listing: ListingResult, sequential: SequentialResult): Draft {
  const reached = sequential.outcome === "not-determinable" || sequential.decidedAtStep === null ? null : FACTORS_REACHED[sequential.decidedAtStep];
  const openFactors = reached === null ? factors : factors.filter((factor) => reached.includes(factor.id));
  const gaps: Draft["gaps"] = [];
  for (const factor of openFactors) {
    if (!factor.applicable) continue;
    for (const check of factor.checks) {
      if (check.earned >= check.weight) continue;
      gaps.push({
        citation: check.citation,
        points: check.weight - check.earned,
        whatToObtain: check.detail,
        sentenceShape: sentenceShape(check.id, listing.id),
      });
    }
  }
  const groups: Record<string, string[]> = {
    "Work": [],
    "Objective medical evidence": [],
    "Other medical evidence": [],
    "Medical opinions": [],
    "Symptoms and daily limits, from the person": [],
    "Work history": [],
  };
  for (const sentence of facts.sentences) {
    const line = sentence.text.trim();
    if (sentence.category === "vocational") groups["Work history"]?.push(line);
    else if (sentence.category === "objective-medical") groups["Objective medical evidence"]?.push(line);
    else if (sentence.category === "medical-opinion" || sentence.category === "prior-administrative") groups["Medical opinions"]?.push(line);
    else if (sentence.category === "other-medical") groups["Other medical evidence"]?.push(line);
    else if (sentence.tags.includes("vocational-fact")) groups["Work"]?.push(line);
    else groups["Symptoms and daily limits, from the person"]?.push(line);
  }
  const decisionNote = reached === null
    ? "The sequential result is not yet decided, so every missing fact that can move it is listed."
    : `The sequential result is already ${plainOutcome(sequential.outcome)} at step ${sequential.decidedAtStep}. Only facts that step still uses are listed. Later steps were not reached.`;
  const reorganized = [
    "REORGANIZED FROM STATEMENTS ALREADY IN THE FILING",
    "No medical fact has been added. A line that begins with GAP is not part of the filing. It is the sentence the record still needs, with the fact left blank.",
    decisionNote,
    "",
    ...Object.entries(groups).flatMap(([heading, lines]) => lines.length === 0 ? [] : [`## ${heading}`, ...lines, ""]),
    ...(gaps.length === 0 ? [] : ["## Still missing", ...gaps.map((gap) => `GAP (${gap.citation}, ${gap.points} index point${gap.points === 1 ? "" : "s"}): ${gap.sentenceShape}`)]),
  ].join("\n");
  const gapText = gaps.map((gap) => gap.sentenceShape).join("\n");
  const invented = novelNumbers(narrative, gapText).filter((number) => !ALLOWED_NUMBERS.has(number));
  return {
    reorganized,
    gaps,
    fabricationCheck: { novelNumbers: invented, passed: invented.length === 0 },
  };
}

function sentenceShape(checkId: string, listingId: string | null): string {
  switch (checkId) {
    case "status":
      return "State whether the person is working now, and the month the work stopped.";
    case "amount":
      return "State the average monthly earnings, or state that the work was self-employment so 20 CFR 404.1575 applies.";
    case "source":
      return "[Acceptable medical source, name and credential] examined or treated the person.";
    case "objective":
      return "[Acceptable medical source] recorded this sign or laboratory finding on [date]: [quote the report]. A diagnosis line does not replace this.";
    case "tied":
      return "The finding above is the objective evidence of [the impairment].";
    case "severe":
      return "Because of that finding, the person is significantly limited in [sitting, standing, walking, lifting, or a mental work ability].";
    case "duration":
      return "This limitation began on [date] and has lasted, or is expected to last, at least twelve months, or it is expected to result in death.";
    case "combination":
      return "The impairments together significantly limit [function]. Consider the combined effect, 20 CFR 404.1523.";
    case "named":
      return listingId ? `The listing already named is ${listingId}. Address each letter of its criteria with medical evidence.` : "Name the listing in the Listing of Impairments that the medical evidence is being measured against.";
    case "criteria":
      return "For each unmet letter of the listing, quote the criterion and the medical sentence that meets it. Do not count the claimant's symptom statement as medical documentation.";
    case "own-objective":
      return "[Source] relies on [the sign or laboratory finding that source recorded], not only on the claimant's report.";
    case "explanation":
      return "[Source] explains the limit: it is based on [finding], and therefore the person can [function] for [amount]. Do not substitute the words disabled or sedentary.";
    case "medical":
      return "The other medical evidence in the file [agrees or the conflict is explained].";
    case "nonmedical":
      return "Where a statement from the person gives a different number for the same function, explain the difference. Do not leave both numbers unresolved.";
    case "relationship":
      return "[Source] has treated the person since [date], seen the person [how often], and examined [what].";
    case "specialty":
      return "[Source] is a [specialty] and the opinion is about that specialty.";
    case "familiar":
      return "[Source] reviewed [the other records] and is familiar with the disability program's need for functional limits.";
    case "link":
      return "The impairment shown by the objective findings could reasonably produce [the symptom]. 20 CFR 404.1529(b).";
    case "daily":
      return "On a typical day the person [does or cannot do these activities].";
    case "intensity":
      return "The symptom is located at [place], lasts [how long], occurs [how often], and is [how intense].";
    case "precipitating":
      return "The symptom starts or gets worse when [activity or condition].";
    case "medication":
      return "The person takes [name] [dose]. It [helps or does not help]. The side effect is [effect].";
    case "treatment":
      return "Other treatment has been [therapy, injection, or surgery], and the result was [result].";
    case "measures":
      return "To relieve the symptom the person [lies down, changes position, uses ice or heat].";
    case "other":
      return "Because of the symptom, the person cannot [specific work activity].";
    case "sit":
      return "In an eight-hour workday the person can sit for [hours].";
    case "stand":
      return "In an eight-hour workday the person can stand and walk, combined, for [hours].";
    case "lift":
      return "The person can lift [pounds] occasionally and [pounds] frequently.";
    case "postural":
      return "The person can [stoop, crouch, reach, or handle] [occasionally, frequently, or never].";
    case "mental":
      return "State the limits in understanding and remembering, interacting, concentrating and persisting, and adapting. Use marked or extreme only if a medical source says so.";
    case "workday":
      return "State the limits for an eight-hour workday, five days a week, or an equivalent schedule. Do not use only the word sedentary, light, or disabled.";
    case "job":
      return "The past work was [job], or the person has no past relevant work.";
    case "when":
      return "The job started on [date] and ended on [date]. Work that started and stopped in fewer than thirty calendar days is not past relevant work.";
    case "demands":
      return "As actually performed, the job required lifting [pounds], sitting [hours], and standing or walking [hours].";
    case "age":
      return "The person is [age] years old. Age is the age at the decision, 20 CFR 404.1563.";
    case "education":
      return "Education is [cannot read or write a simple message, or the highest grade, or high school or more]. Say whether recent education provides direct entry into skilled work.";
    case "skill":
      return "The work was unskilled, or the skills [are or are not] transferable. For a person of advanced age who is limited to sedentary work, say whether transfer would require very little vocational adjustment.";
    default:
      return "Add the fact this element asks for, from the person or the medical source who has it. Do not invent it.";
  }
}
