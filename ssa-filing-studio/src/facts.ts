import { findListing } from "./corpus.js";
import { joinSentences, splitSentences } from "./sentences.js";
import type {
  Education,
  EvidenceCategory,
  ExperienceKind,
  Facts,
  FilingInput,
  Limit,
  SourceOpinion,
  SymptomKey,
  WeighedSentence,
  WorkFact,
} from "./types.js";

const OBJECTIVE =
  /\b(mri|ct scan|cat scan|x-ray|xray|radiograph|emg|nerve conduction|eeg|ecg|ekg|spirometry|fev\s?1|a1c|hemoglobin a1c|ejection fraction|laboratory|blood test|biopsy|range of motion|straight[- ]leg|phq-9|gad-7|wais|wisc|full[- ]scale iq|mental status examination|on examination|imaging (?:showed|shows|revealed|demonstrated))\b/i;

const MEDICAL_SOURCE =
  /\b(dr\.?|doctor|physician|psychiatrist|psychologist|rheumatologist|neurologist|orthoped(?:ic|ist)|cardiologist|pulmonologist|oncologist|surgeon|nurse practitioner|\bnp\b|aprn|physician assistant|pa-c|podiatrist|optometrist|audiologist|pediatrician)\b/i;

/** 20 CFR 404.1502(a) does not list these practitioners. "Dr." in front of the name does not make them an acceptable medical source. */
const NOT_ACCEPTABLE_SOURCE =
  /\b(chiropract(?:or|ic)|acupuncturist|naturopath|homeopath|licensed clinical social worker|\blcsw\b|physical therapist|massage therapist)\b/i;

const FUNCTION_WORD =
  /\b(sit(?:ting)?|stand(?:ing)?|walk(?:ing)?|lift(?:ing)?|carry(?:ing)?|reach(?:ing)?|handl(?:e|ing)|stoop(?:ing)?|crouch(?:ing)?|kneel(?:ing)?|crawl(?:ing)?|climb(?:ing)?|concentrat(?:e|ing|ion)|persist(?:ence|ing)?|pace|interact(?:ing)?|remember(?:ing)?|understand(?:ing)?|adapt(?:ing)?|off[- ]task|absen(?:t|ces))\b/i;

const PRIOR_ADMIN =
  /\b(state agency|disability determination services|\bdds\b|medical consultant|psychological consultant|prior administrative|at the initial level)\b/i;

const OTHER_MEDICAL =
  /\b(diagnos(?:is|ed)|prescrib(?:ed|es)|hospitali[sz]ed|surgery|physical therapy|treated with|treatment with|prognosis|clinical findings)\b/i;

const RESERVED_PATTERNS: { pattern: RegExp; why: string }[] = [
  { pattern: /\b(?:totally |permanently )?disabled\b/i, why: "20 CFR 404.1520b(c)(3)(i): a statement that you are or are not disabled is reserved to the Commissioner." },
  { pattern: /\b(?:unable to work|able to work|(?:cannot|can't|can not) work)\b(?!\s+overhead)/i, why: "20 CFR 404.1520b(c)(3)(i): a statement that you are able or unable to work, or to perform regular and continuing work, is reserved to the Commissioner." },
  { pattern: /\bmeets (?:or equals |or medically equals )?(?:a |the )?listing\b/i, why: "20 CFR 404.1520b(c)(3)(iv): a statement that an impairment meets or equals a listing is reserved to the Commissioner." },
  { pattern: /\blimited to (?:less than )?(?:sedentary|light|medium|heavy|very heavy) work\b/i, why: "20 CFR 404.1520b(c)(3)(v): an exertional label, rather than a description of functional abilities, is reserved to the Commissioner." },
  { pattern: /\bresidual functional capacity (?:is|of) (?:sedentary|light|medium|heavy)\b/i, why: "20 CFR 404.1520b(c)(3)(v): an exertional label is reserved to the Commissioner." },
];

const SYMPTOM_CHECKS: { key: SymptomKey; pattern: RegExp }[] = [
  { key: "daily-activities", pattern: /\b(daily activities|activities of daily living|\badls?\b|shopping|bathing|dressing|cooking|chores|household)\b/i },
  { key: "location-duration-frequency-intensity", pattern: /\b(every day|all day|constant|hours a day|times a (?:day|week)|severe|intensity|burning|sharp|throbbing|10\/10)\b/i },
  { key: "precipitating-aggravating", pattern: /\b(worse when|aggravat|trigger|brings on|precipitat)\b/i },
  { key: "medication", pattern: /\b(\d+\s*mg|medication|medicine|prescribed|side effect|i take|takes)\b/i },
  { key: "other-treatment", pattern: /\b(therapy|injection|surgery|counseling|physical therapy)\b/i },
  { key: "measures", pattern: /\b(lie down|lying down|recliner|ice pack|\bice\b|\bheat\b|prop (?:up|my)|change position)\b/i },
  { key: "other-factors", pattern: /\b(because of (?:the )?(?:pain|symptoms|fatigue)|due to (?:the )?(?:pain|fatigue|symptoms))\b/i },
];

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

function emptySymptoms(): Record<SymptomKey, boolean> {
  return {
    "daily-activities": false,
    "location-duration-frequency-intensity": false,
    "precipitating-aggravating": false,
    medication: false,
    "other-treatment": false,
    measures: false,
    "other-factors": false,
  };
}

function reservedHit(text: string): string | null {
  for (const entry of RESERVED_PATTERNS) {
    if (entry.pattern.test(text)) return entry.why;
  }
  return null;
}

function sourceName(text: string): string | null {
  const named = /\b(?:Dr\.?|Doctor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/.exec(text);
  if (named) return `Dr. ${named[1]}`;
  const role = /\b(psychiatrist|psychologist|rheumatologist|neurologist|orthopedist|cardiologist|surgeon)\b/i.exec(text);
  if (role) return role[1].toLowerCase();
  return null;
}

function classify(text: string, carriedSource: string | null): {
  category: EvidenceCategory;
  citation: string;
  why: string;
  tags: string[];
} {
  const tags: string[] = [];
  if (/\b(years old|year-old|grade|high school|college|ged|worked as|job|employ(?:ed|ment)?|unemployed|earn(?:ing|ings|s)?|work(?:ing|ed)?)\b/i.test(text)) tags.push("vocational-fact");
  if (FUNCTION_WORD.test(text)) tags.push("function");
  if (OBJECTIVE.test(text)) tags.push("objective-language");
  const medical = MEDICAL_SOURCE.test(text) || carriedSource !== null;
  if (PRIOR_ADMIN.test(text)) {
    return {
      category: "prior-administrative",
      citation: "20 CFR 404.1513(a)(5)",
      why: "The sentence uses the vocabulary of a prior administrative medical finding. Those findings are weighed under 20 CFR 404.1520c together with medical opinions, at the source level.",
      tags,
    };
  }
  if (medical && FUNCTION_WORD.test(text) && /\b(opine[sd]?|opinion|restricted|limited to|can |cannot|can't|unable|no more than|residual functional|able to)\b/i.test(text)) {
    return {
      category: "medical-opinion",
      citation: "20 CFR 404.1513(a)(2)",
      why: "A medical source states what the person can still do, or states an impairment-related limitation in a work ability listed in 20 CFR 404.1513(a)(2).",
      tags,
    };
  }
  if (OBJECTIVE.test(text)) {
    return {
      category: "objective-medical",
      citation: "20 CFR 404.1502(f)",
      why: "Objective medical evidence means signs, laboratory findings, or both. A diagnosis, a symptom, or a medical opinion does not itself establish a medically determinable impairment (20 CFR 404.1521).",
      tags,
    };
  }
  if (OTHER_MEDICAL.test(text) || (medical && !FUNCTION_WORD.test(text))) {
    return {
      category: "other-medical",
      citation: "20 CFR 404.1513(a)(3)",
      why: "This is evidence from a medical source that is not objective medical evidence and not a statement of functional ability: diagnosis, treatment, history, or prognosis.",
      tags,
    };
  }
  if (/\b(i |my |i'm |i am )\b/i.test(text) || /\b(pain|fatigue|hurt|anxious|depress)\b/i.test(text)) {
    return {
      category: "nonmedical",
      citation: "20 CFR 404.1513(a)(4)",
      why: "A statement from the claimant or another nonmedical source. It is evidence, and 20 CFR 404.1520c(d) does not weigh it with the medical-opinion factors. It cannot establish a medically determinable impairment (20 CFR 404.1521).",
      tags,
    };
  }
  if (tags.includes("vocational-fact")) {
    return {
      category: "vocational",
      citation: "20 CFR 404.1560",
      why: "The sentence is about age, education, or work, the vocational factors used at steps 4 and 5.",
      tags,
    };
  }
  return {
    category: "unclassified",
    citation: "20 CFR 404.1513(a)",
    why: "The sentence does not match a defined evidence category. It is still in the ledger so nothing in the filing is dropped.",
    tags,
  };
}

function hoursOf(value: number, unit: string): number {
  return /minute/i.test(unit) ? value / 60 : value;
}

function limitsIn(text: string, sentenceIndex: number): Limit[] {
  const limits: Limit[] = [];
  const normalized = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\b/gi, (word) => {
    const number = WORD_NUMBERS[word.toLowerCase()];
    return number === undefined ? word : String(number);
  });
  const add = (fn: Limit["fn"], amount: number, unit: Limit["unit"]) => {
    limits.push({ fn, amount, unit, sentenceIndex });
  };
  for (const match of normalized.matchAll(/(\d+(?:\.\d+)?)\s*pounds?\s*(occasionally|frequent(?:ly)?)/gi)) {
    const amount = Number(match[1]);
    add(/freq/i.test(match[2] ?? "") ? "lift-frequent" : "lift-occasional", amount, "pounds");
  }
  for (const match of normalized.matchAll(/(occasional(?:ly)?|frequent(?:ly)?)\s+(?:lifting|lift|carrying|carry)(?:\s+of)?\s+(\d+(?:\.\d+)?)\s*pounds?/gi)) {
    const amount = Number(match[2]);
    add(/freq/i.test(match[1] ?? "") ? "lift-frequent" : "lift-occasional", amount, "pounds");
  }
  if (!limits.some((limit) => limit.fn.startsWith("lift"))) {
    const bare = /(?:lift|lifting|carry|carrying)(?:\s+\w+){0,4}?\s(\d+(?:\.\d+)?)\s*pounds?/i.exec(normalized);
    if (bare) add("lift-occasional", Number(bare[1]), "pounds");
  }
  const combined = /(?:stand(?:ing)?|walk(?:ing)?)\s+(?:or|and)\s+(?:stand(?:ing)?|walk(?:ing)?)\s+(?:for\s+)?(?:about\s+|approximately\s+|no more than\s+|up to\s+)?(\d+(?:\.\d+)?)\s*(hours|minutes)/i.exec(normalized);
  if (combined?.[1] && combined[2]) add("stand-walk", hoursOf(Number(combined[1]), combined[2]), "hours");
  const sit = /(?:cannot|can't|unable to|no more than|up to|about|approximately|for)?[^.]{0,24}\b(?:sit|sitting)\b[^.]{0,24}?(\d+(?:\.\d+)?)\s*(hours|minutes)/i.exec(normalized);
  if (sit?.[1] && sit[2]) add("sit", hoursOf(Number(sit[1]), sit[2]), "hours");
  if (!limits.some((limit) => limit.fn === "stand-walk")) {
    const stand = /\b(?:stand(?:ing)?|walk(?:ing)?)\b[^.]{0,24}?(\d+(?:\.\d+)?)\s*(hours|minutes)/i.exec(normalized);
    if (stand?.[1] && stand[2]) add("stand-walk", hoursOf(Number(stand[1]), stand[2]), "hours");
  }
  return limits;
}

function educationFromText(text: string): Education | null {
  if (/\b(illiterate|cannot read|can't read|unable to read or write)\b/i.test(text)) return "illiterate";
  if (/\b(high school|ged|college|bachelor|associate degree|university)\b/i.test(text)) return "high-school-or-more";
  const grade = /\b(\d{1,2})(?:st|nd|rd|th)\s+grade\b/i.exec(text);
  if (grade?.[1]) {
    const year = Number(grade[1]);
    if (year <= 6) return "marginal";
    if (year <= 11) return "limited";
    return "high-school-or-more";
  }
  return null;
}

function ageFromText(text: string): number | null {
  const match = /\b(?:i am|i'm|age(?: of)?|aged)\s+(\d{1,3})\b/i.exec(text) ?? /\b(\d{1,3})\s*-?\s*years?\s*old\b/i.exec(text);
  if (!match?.[1]) return null;
  const age = Number(match[1]);
  return age >= 1 && age <= 120 ? age : null;
}

function earningsFromText(text: string): number | null {
  const match = /\$\s*([\d,]+)(?:\.\d+)?/.exec(text);
  if (!match?.[1]) return null;
  return Number(match[1].replace(/,/g, ""));
}

function isoDate(value: string | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function yearsBetween(startYear: number, endIso: string): number {
  return Number(endIso.slice(0, 4)) - startYear;
}

export function readFacts(input: FilingInput): { facts: Facts; piecesJoin: string } {
  const narrative = input.narrative ?? "";
  const pieces = splitSentences(narrative);
  const weighed: WeighedSentence[] = [];
  let carried: string | null = null;
  let carriedNonAms = false;
  pieces.forEach((piece, index) => {
    const text = piece.text.trim();
    if (!text) return;
    const named = sourceName(text);
    if (named) {
      carried = named;
      carriedNonAms = NOT_ACCEPTABLE_SOURCE.test(text);
    } else if (NOT_ACCEPTABLE_SOURCE.test(text)) {
      carriedNonAms = true;
    }
    const continuesMedical =
      /^(she|he|the doctor|the psychiatrist)\b/i.test(text) ||
      OBJECTIVE.test(text) ||
      /\b(opined|opinion|explained|examination|observed)\b/i.test(text);
    const usedSource = named ?? (continuesMedical ? carried : null);
    const fromNonAms = NOT_ACCEPTABLE_SOURCE.test(text) || (usedSource !== null && usedSource === carried && carriedNonAms);
    const classified = classify(text, fromNonAms ? null : usedSource);
    if (fromNonAms) classified.tags.push("non-ams");
    const reservedWhy = reservedHit(text);
    const incompetent: string[] = [];
    if (classified.category === "nonmedical") {
      incompetent.push("Cannot establish a medically determinable impairment (20 CFR 404.1521).");
      incompetent.push("Not weighed under the supportability and consistency factors (20 CFR 404.1520c(d)).");
    }
    if (classified.category === "other-medical") {
      incompetent.push("A diagnosis or treatment note is not objective medical evidence and does not establish an impairment (20 CFR 404.1521).");
    }
    if (fromNonAms) {
      incompetent.push("This source is not an acceptable medical source under 20 CFR 404.1502(a). Findings from that source do not establish a medically determinable impairment (20 CFR 404.1521).");
    }
    if (reservedWhy) {
      incompetent.push(reservedWhy);
    }
    weighed.push({
      index,
      text,
      category: classified.category,
      citation: classified.citation,
      why: classified.why,
      reservedIssue: reservedWhy !== null,
      reservedWhy,
      sourceName: usedSource,
      tags: classified.tags,
      legallyIncompetentFor: incompetent,
    });
  });

  const filingDate = isoDate(input.filingDate);
  const referenceDate = filingDate ?? new Date().toISOString().slice(0, 10);
  const overrides: string[] = [];
  const opinionRule = filingDate !== null && filingDate < "2017-03-27" ? "404.1527" : "404.1520c";

  let age = input.age ?? null;
  if (input.age !== undefined) overrides.push("Age was taken from the structured field rather than the narrative.");
  if (age === null) {
    for (const sentence of weighed) {
      const found = ageFromText(sentence.text);
      if (found !== null) {
        age = found;
        break;
      }
    }
  }

  let education = input.education ?? null;
  if (input.education) overrides.push("Education was taken from the structured field.");
  if (!education) {
    for (const sentence of weighed) {
      const found = educationFromText(sentence.text);
      if (found) {
        education = found;
        break;
      }
    }
  }

  let directEntry: boolean | null = input.directEntryToSkilledWork ?? null;
  if (input.directEntryToSkilledWork !== undefined) overrides.push("Direct entry into skilled work was taken from the structured field.");
  if (directEntry === null) {
    const joined = weighed.map((sentence) => sentence.text).join(" ");
    if (/provides for direct entry|direct entry into skilled/i.test(joined)) directEntry = true;
    if (/does not provide for direct entry|no direct entry/i.test(joined)) directEntry = false;
  }

  let monthlyEarnings = input.monthlyEarnings ?? null;
  if (input.monthlyEarnings !== undefined) overrides.push("Monthly earnings were taken from the structured field.");
  if (monthlyEarnings === null) {
    for (const sentence of weighed) {
      if (/\b(month|monthly)\b/i.test(sentence.text) || /\$/.test(sentence.text)) {
        const found = earningsFromText(sentence.text);
        if (found !== null) {
          monthlyEarnings = found;
          break;
        }
      }
    }
  }

  const textAll = weighed.map((sentence) => sentence.text).join("\n");
  const stopped = /\b(stopped working|have not worked|haven't worked|not working|unemployed|no longer work)\b/i.test(textAll);
  const workingWords = /\b(i currently work|i am working|i work|currently earn|i earn)\b/i.test(textAll);
  let workingNow: boolean | null = stopped && !workingWords ? false : workingWords && !stopped ? true : stopped && workingWords ? null : null;
  if (monthlyEarnings !== null && monthlyEarnings > 0 && workingNow === null && !stopped) workingNow = true;
  if (/\bnever worked\b|\bno (?:past )?work experience\b/i.test(textAll)) workingNow = false;
  if (workingNow === null && age !== null && age < 18 && monthlyEarnings === null && !/\b(employ|job|earn|wage)\b/i.test(textAll)) workingNow = false;

  const selfEmployed = input.selfEmployed === true || /\bself[- ]employed\b|\bmy business\b/i.test(textAll);
  const statutoryBlindness = input.statutoryBlindness === true || /\bstatutor(?:y|ily) blind/i.test(textAll);
  const subsidyOrIrweUnresolved = /\b(subsid(?:y|ized)|impairment-related work expense|\birwe\b)\b/i.test(textAll);
  const unsuccessfulWorkAttempt =
    workingNow === false &&
    (/\bunsuccessful work attempt\b/i.test(textAll) ||
      (/\b(had to stop|stopped because|forced to stop)\b/i.test(textAll) && /\b([1-6]\s+months?|a few months)\b/i.test(textAll)));

  let earningsYear = input.earningsYear ?? (filingDate ? Number(filingDate.slice(0, 4)) : null);
  const yearInText = /\bin (20\d{2})\b/.exec(textAll);
  if (earningsYear === null && yearInText?.[1]) earningsYear = Number(yearInText[1]);
  if (earningsYear === null && monthlyEarnings !== null) earningsYear = Number(referenceDate.slice(0, 4));

  const onset = isoDate(input.onsetDate);
  let yearsSinceOnset: number | null = null;
  if (onset) yearsSinceOnset = yearsBetween(Number(onset.slice(0, 4)), referenceDate);
  const since = /\bsince (?:january |february |march |april |may |june |july |august |september |october |november |december )?(20\d{2})\b/i.exec(textAll);
  if (yearsSinceOnset === null && since?.[1]) yearsSinceOnset = yearsBetween(Number(since[1]), referenceDate);

  let duration: Facts["duration"] = "unknown";
  if (/\b(expected to result in death|terminal|end of life)\b/i.test(textAll)) duration = "met";
  else if (yearsSinceOnset !== null && yearsSinceOnset >= 1) duration = "met";
  else if (/\b(at least (?:12|twelve) months|for (?:12|twelve) months|for (?:two|2) years|for years)\b/i.test(textAll)) duration = "met";
  else if (/\b(resolved|recovered|ended after|lasted only|only lasted)\b/i.test(textAll) && /\b([1-9]|ten|eleven|three|four|five|six)\s+months?\b/i.test(textAll) && !/\b(12|twelve) months\b/i.test(textAll)) duration = "not-met";

  const amsNamed = weighed.some((sentence) => MEDICAL_SOURCE.test(sentence.text) && sentence.category !== "nonmedical" && !sentence.tags.includes("non-ams"));
  const objectiveFinding = weighed.some((sentence) => sentence.category === "objective-medical" && !sentence.tags.includes("non-ams"));
  const objectiveTied = objectiveFinding && /\b(back|spine|lumbar|cervical|knee|hip|shoulder|heart|lung|depression|anxiety|ptsd|bipolar|diabetes|seizure)\b/i.test(textAll);
  const diagnosisCount = weighed.filter((sentence) => /\bdiagnos/i.test(sentence.text) || sentence.category === "other-medical").length;
  const combinationAddressed = /\b(combination|combined effect|together)\b/i.test(textAll);

  const significant = /\b(cannot|can't|unable|marked limitation|extreme limitation|significantly limits|difficulty)\b/i.test(textAll);
  const onlyMild = /\b(mild|slight|minimal)\b/i.test(textAll) && !significant;
  const multipleImpairments = diagnosisCount >= 2 || /\b(both|two|multiple|several) impairments\b/i.test(textAll);
  const mildCombinationOpen = onlyMild && multipleImpairments && !combinationAddressed;
  const severe: Facts["severe"] = significant ? "yes" : onlyMild && !mildCombinationOpen ? "no" : "unknown";

  const foundListingIds = [...new Set(
    [...textAll.matchAll(/\b(\d{1,3}\.\d{2})\b/g)]
      .map((match) => match[1] ?? "")
      .filter((id) => id && findListing(id)),
  )];
  const withCriteria = foundListingIds.filter((id) => findListing(id)?.paragraphs.some((paragraph) => /satisfied by/i.test(paragraph)) ?? false);
  const listingIds = [...withCriteria, ...foundListingIds.filter((id) => !withCriteria.includes(id))];
  const equivalenceAlleged = /\b(medically equals|medical equivalence|equals (?:a |the )?listing)\b/i.test(textAll);

  const bySource = new Map<string, WeighedSentence[]>();
  for (const sentence of weighed) {
    if (!sentence.sourceName) continue;
    if (sentence.category !== "medical-opinion" && sentence.category !== "objective-medical" && sentence.category !== "other-medical" && sentence.category !== "prior-administrative") {
      continue;
    }
    const list = bySource.get(sentence.sourceName) ?? [];
    list.push(sentence);
    bySource.set(sentence.sourceName, list);
  }
  const opinions: SourceOpinion[] = [];
  for (const [name, sentences] of bySource) {
    const blob = sentences.map((sentence) => sentence.text).join(" ");
    const opinionSentences = sentences.filter((sentence) => sentence.category === "medical-opinion" || sentence.category === "prior-administrative");
    const functional = opinionSentences.filter((sentence) => sentence.tags.includes("function") && !isReservedOnly(sentence.text));
    const limits = functional.flatMap((sentence) => limitsIn(sentence.text, sentence.index));
    const reservedOnly = opinionSentences.length > 0 && functional.length === 0 && opinionSentences.every((sentence) => sentence.reservedIssue);
    if (sentences.every((sentence) => sentence.tags.includes("non-ams"))) continue;
    if (functional.length === 0 && !reservedOnly) continue;
    opinions.push({
      name,
      specialty: /\b(psychiatrist|psychologist|rheumatologist|neurologist|orthoped|cardiologist|board-certified|specialist)\b/i.test(blob),
      treating: /\b(treat(?:ed|ing|s)|monthly|weekly|for \d+ years|since 20\d{2})\b/i.test(blob),
      examining: /\b(examin(?:ed|ation)|mental status examination)\b/i.test(blob),
      familiar: /\b(familiar with|reviewed the (?:record|file)|disability program)\b/i.test(blob),
      explanation: /\b(because|based on|due to|explained|secondary to|as a result)\b/i.test(blob),
      ownObjective: sentences.some((sentence) => sentence.category === "objective-medical" || sentence.tags.includes("objective-language")),
      limits,
      reservedOnly,
      priorAdministrative: sentences.some((sentence) => sentence.category === "prior-administrative"),
    });
  }

  const medicalConflict = conflictAmong(opinions);
  const nonmedicalConflict = conflictWithClaimant(opinions, weighed);
  const rfc = assessRfc(opinions, medicalConflict);

  const symptomFactors = emptySymptoms();
  for (const sentence of weighed) {
    for (const check of SYMPTOM_CHECKS) {
      if (check.pattern.test(sentence.text)) symptomFactors[check.key] = true;
    }
  }
  const symptomAlleged = /\b(pain|fatigue|hurt|anxiety|depress|shortness of breath|weakness|nervousness|symptom)\b/i.test(textAll);
  const symptomLinked = symptomAlleged && objectiveFinding && /\b(because of|due to|from (?:the|my)|related to|caused by)\b/i.test(textAll);

  const physicalAlleged = /\b(back|spine|knee|hip|shoulder|lift|sit|walk|heart|lung|pain|arm|leg|hand)\b/i.test(textAll);
  const mentalAlleged = /\b(depress|anxiety|ptsd|bipolar|psych|concentrat|hallucin|trauma)\b/i.test(textAll);
  const mentalAreas = [
    /\b(understand|remember|apply information|carrying out instructions)\b/i,
    /\b(interact|co-?workers|supervision|the public)\b/i,
    /\b(concentrat|persist|pace|stay on task)\b/i,
    /\b(adapt|manage oneself|changes in (?:a |the )?routine|work pressure)\b/i,
  ].filter((pattern) => pattern.test(textAll)).length;

  const work = readWork(weighed, referenceDate);
  const neverWorked = /\bnever worked\b|\bno (?:past )?(?:relevant )?work (?:experience|history)\b|\bno past relevant work\b/i.test(textAll);
  const confirmedPrw = work.filter((job) => job.withinFiveYears === true && !job.underThirtyDays && job.skill !== null);
  const experience = experienceOf(work, neverWorked, textAll);
  const veryLittleAdjustment = /\bvery little(?:, if any,)? vocational adjustment\b|\bno vocational adjustment\b|\bsame industry\b/i.test(textAll);
  const medicalBlob = weighed
    .filter((sentence) => sentence.category === "medical-opinion" || sentence.category === "objective-medical" || sentence.category === "prior-administrative")
    .map((sentence) => sentence.text)
    .join(" ");
  const nonexertionalErosion =
    /\b(never|cannot|unable to) (stoop|crouch|kneel|crawl|climb|reach overhead|balance)\b/i.test(medicalBlob) ||
    /\b(marked|extreme) limitation\b/i.test(medicalBlob) ||
    /\b(off[- ]task|absent more than|would miss)\b/i.test(medicalBlob);

  const arduousMatch = /\b(\d{2})\s+years\b[^.]{0,80}\barduous\b|\barduous\b[^.]{0,80}\b(\d{2})\s+years\b/i.exec(textAll);
  const arduousYears = arduousMatch ? Number(arduousMatch[1] ?? arduousMatch[2]) : null;
  const cannotDoArduousWork = /\bcannot (?:do|perform) (?:that|this|the) work\b|\bno longer able\b/i.test(textAll);

  const childDomains = readChildDomains(weighed);

  const facts: Facts = {
    sentences: weighed,
    program: input.program ?? "title-ii",
    filingDate,
    referenceDate,
    opinionRule,
    age,
    birthDate: isoDate(input.birthDate),
    education,
    directEntry,
    monthlyEarnings,
    earningsYear,
    selfEmployed,
    subsidyOrIrweUnresolved,
    unsuccessfulWorkAttempt,
    workingNow,
    statutoryBlindness,
    duration,
    yearsSinceOnset,
    amsNamed,
    objectiveFinding,
    objectiveTied,
    diagnosisCount,
    combinationAddressed,
    mildCombinationOpen,
    severe,
    listingIds,
    equivalenceAlleged,
    opinions,
    medicalConflict,
    nonmedicalConflict,
    symptomAlleged,
    symptomLinked,
    symptomFactors,
    physicalAlleged,
    mentalAlleged,
    rfc,
    functionFlags: {
      sit: rfc.sit !== null || /\bsit(?:ting)?\b/i.test(textAll),
      standWalk: rfc.standWalk !== null || /\bstand(?:ing)?\b|\bwalk(?:ing)?\b/i.test(textAll),
      lift: rfc.liftOccasional !== null || /\blift/i.test(textAll),
      postural: /\b(stoop|crouch|kneel|crawl|climb|reach|handl)/i.test(textAll),
      mentalAreas,
      workday: /\b(eight-hour|8-hour|workday|work day|in a work)\b/i.test(textAll),
    },
    work,
    confirmedPrw,
    neverWorked,
    experience,
    veryLittleAdjustment,
    nonexertionalErosion,
    arduousYears,
    cannotDoArduousWork,
    childDomains,
    overrides,
  };
  return { facts, piecesJoin: joinSentences(pieces) };
}

function isReservedOnly(text: string): boolean {
  return reservedHit(text) !== null && !/\d+\s*pounds\b|\d+\s*hours?\b/i.test(text);
}

function amountOf(opinion: SourceOpinion, fn: Limit["fn"]): number | null {
  const found = opinion.limits.find((limit) => limit.fn === fn);
  return found ? found.amount : null;
}

function conflictAmong(opinions: SourceOpinion[]): string | null {
  const fns: Limit["fn"][] = ["lift-occasional", "sit", "stand-walk"];
  for (const fn of fns) {
    const values = opinions.map((opinion) => amountOf(opinion, fn)).filter((value): value is number => value !== null);
    if (values.length >= 2 && Math.max(...values) - Math.min(...values) > 0.25) {
      return `Medical sources disagree about ${fn}: ${values.join(" and ")}. 20 CFR 404.1520b(b) says inconsistent evidence has to be considered, and a residual functional capacity is not established while the conflict is unresolved.`;
    }
  }
  return null;
}

function conflictWithClaimant(opinions: SourceOpinion[], sentences: WeighedSentence[]): string | null {
  const claimantLift = sentences
    .filter((sentence) => sentence.category === "nonmedical")
    .flatMap((sentence) => limitsIn(sentence.text, sentence.index))
    .find((limit) => limit.fn === "lift-occasional");
  const medical = opinions.map((opinion) => amountOf(opinion, "lift-occasional")).find((value) => value !== null);
  if (claimantLift && medical !== undefined && Math.abs(claimantLift.amount - medical) > 5) {
    return `A nonmedical statement says ${claimantLift.amount} pounds and a medical opinion says ${medical} pounds. Consistency under 20 CFR 404.1520c(c)(2) includes evidence from nonmedical sources.`;
  }
  return null;
}

function assessRfc(opinions: SourceOpinion[], conflict: string | null): Facts["rfc"] {
  const usable = opinions.filter((opinion) => !opinion.reservedOnly && opinion.limits.length > 0);
  if (conflict || usable.length === 0) {
    return {
      established: false,
      exertional: "unknown",
      fullRange: false,
      why: conflict ?? "No medical source has stated functional abilities in pounds or hours. An exertional label such as sedentary is not a residual functional capacity (20 CFR 404.1520b(c)(3)(v)).",
      sit: null,
      standWalk: null,
      liftOccasional: null,
      liftFrequent: null,
    };
  }
  const opinion = usable[0];
  if (!opinion) {
    return { established: false, exertional: "unknown", fullRange: false, why: "No usable medical opinion.", sit: null, standWalk: null, liftOccasional: null, liftFrequent: null };
  }
  const sit = amountOf(opinion, "sit");
  const standWalk = amountOf(opinion, "stand-walk");
  const liftOccasional = amountOf(opinion, "lift-occasional");
  const liftFrequent = amountOf(opinion, "lift-frequent");
  const assessed = exertionalFromLimits(liftOccasional, liftFrequent, sit, standWalk);
  return {
    established: assessed.exertional !== "unknown",
    exertional: assessed.exertional,
    fullRange: assessed.fullRange,
    why: assessed.why,
    sit,
    standWalk,
    liftOccasional,
    liftFrequent,
  };
}

export function exertionalFromLimits(
  liftOccasional: number | null,
  liftFrequent: number | null,
  sit: number | null,
  standWalk: number | null,
): { exertional: Facts["rfc"]["exertional"]; fullRange: boolean; why: string } {
  if (liftOccasional === null && sit === null && standWalk === null) {
    return { exertional: "unknown", fullRange: false, why: "The medical opinion does not state lift, sit, or stand/walk in numbers." };
  }
  const canLift = (pounds: number) => liftOccasional !== null && liftOccasional >= pounds;
  const sedentaryBase = canLift(10) && (sit === null || sit >= 6) && (standWalk === null || standWalk >= 2);
  const missingSedentaryDetail = canLift(10) && (sit === null || standWalk === null);
  if (liftOccasional !== null && liftOccasional < 10) {
    return { exertional: "less-than-sedentary", fullRange: false, why: "The medical opinion limits lifting to less than 10 pounds. That is below sedentary work, which involves lifting no more than 10 pounds at a time (20 CFR 404.1567(a))." };
  }
  if (sit !== null && sit < 6 && (liftOccasional === null || liftOccasional <= 10)) {
    return { exertional: "less-than-sedentary", fullRange: false, why: "Sitting is below about six hours. POMS DI 25001.001 describes sedentary work as sitting about six hours and standing or walking about two hours in an eight-hour workday. Appendix 2, 201.00(h)(3) says less than a full range of sedentary work is not automatically a finding of disabled." };
  }
  if (standWalk !== null && standWalk < 2 && (liftOccasional === null || liftOccasional <= 10)) {
    return { exertional: "less-than-sedentary", fullRange: false, why: "Standing and walking are below about two hours, so the full range of sedentary work described in POMS DI 25001.001 is not established." };
  }
  if (canLift(100) && (liftFrequent === null || liftFrequent >= 50) && (standWalk === null || standWalk >= 6)) {
    const full = liftFrequent !== null && standWalk !== null && liftFrequent >= 50 && standWalk >= 6;
    return { exertional: full && liftOccasional !== null && liftOccasional > 100 ? "very-heavy" : "heavy", fullRange: full, why: full ? "The limits meet heavy work: lifting no more than 100 pounds with frequent lifting of up to 50 pounds (20 CFR 404.1567(d)), and standing or walking of about six hours." : "Lifting is in the heavy range, but frequent lifting or standing and walking was not both stated, so the full range is not established." };
  }
  if (canLift(50) && (standWalk === null || standWalk >= 6)) {
    const full = liftFrequent !== null && liftFrequent >= 25 && standWalk !== null && standWalk >= 6;
    return { exertional: "medium", fullRange: full, why: full ? "The limits meet medium work: lifting no more than 50 pounds with frequent lifting of up to 25 pounds (20 CFR 404.1567(c)), and standing or walking of about six hours." : "Lifting reaches the medium occasional amount, but frequent lifting of 25 pounds or standing and walking of about six hours was not both stated (20 CFR 404.1567(c)). The grid does not direct a conclusion unless the full range is established (Appendix 2, 200.00(a))." };
  }
  if (canLift(20) && (standWalk === null || standWalk >= 6)) {
    const full = liftFrequent !== null && liftFrequent >= 10 && standWalk !== null && standWalk >= 6;
    return { exertional: "light", fullRange: full, why: full ? "The limits meet light work: lifting no more than 20 pounds with frequent lifting of up to 10 pounds (20 CFR 404.1567(b)), and standing or walking of about six hours." : "Lifting reaches 20 pounds, but the full light range also needs frequent lifting of 10 pounds and about six hours of standing or walking (20 CFR 404.1567(b)). Those were not both stated." };
  }
  if (canLift(20) && standWalk !== null && standWalk < 6 && sit !== null && sit >= 6) {
    return { exertional: "sedentary", fullRange: standWalk >= 2, why: "Lifting reaches 20 pounds, but standing and walking are below the about-six-hours that light work requires. Sitting and the 10-pound sedentary lift are present, so the highest full exertional range established is sedentary (20 CFR 404.1567(a); POMS DI 25001.001)." };
  }
  if (sedentaryBase && !missingSedentaryDetail && liftOccasional !== null && liftOccasional <= 10) {
    return { exertional: "sedentary", fullRange: true, why: "The opinion states lifting 10 pounds, sitting about six hours, and standing or walking about two hours. That is the full range of sedentary work (20 CFR 404.1567(a); POMS DI 25001.001)." };
  }
  if (canLift(10) && liftOccasional !== null && liftOccasional <= 10) {
    return { exertional: "sedentary", fullRange: false, why: "Lifting is at the sedentary amount, but sitting and standing or walking were not both stated in hours, so the full range of sedentary work is not established and a grid rule does not direct a conclusion (Appendix 2, 200.00(a))." };
  }
  return { exertional: "unknown", fullRange: false, why: "The stated limits do not line up with a full exertional range in 20 CFR 404.1567." };
}

function readWork(sentences: WeighedSentence[], referenceDate: string): WorkFact[] {
  const jobs: WorkFact[] = [];
  for (const sentence of sentences) {
    const title = /\b(?:worked as|job as|work as|employed as|was an?)\s+(?:an?\s+)?([a-z][a-z ]{2,40}?)(?:\.|,| from| for| until)/i.exec(sentence.text);
    if (!title && !/\b(warehouse|cashier|laborer|carpenter|nurse|driver|clerk|miner)\b/i.test(sentence.text)) continue;
    const range = /\b(20\d{2})\b[^\d]{0,12}\b(20\d{2})\b/.exec(sentence.text);
    const start = range?.[1] ?? null;
    const end = range?.[2] ?? null;
    let calendarDays: number | null = null;
    let underThirty = false;
    const daySpan = /\b(?:for|lasted)\s+(\d{1,3})\s+days?\b/i.exec(sentence.text);
    if (daySpan?.[1]) {
      calendarDays = Number(daySpan[1]);
      underThirty = calendarDays < 30;
    }
    const refYear = Number(referenceDate.slice(0, 4));
    const withinFiveYears = end ? refYear - Number(end) <= 5 && refYear - Number(end) >= 0 : null;
    const lift = /(\d+)\s*pounds?/i.exec(sentence.text);
    let skill: WorkFact["skill"] = null;
    if (/\bunskilled\b|\bsvp\s*[12]\b/i.test(sentence.text)) skill = "unskilled";
    else if (/\bsemi[- ]?skilled\b|\bsvp\s*[34]\b/i.test(sentence.text)) skill = "semiskilled";
    else if (/\bskilled\b/i.test(sentence.text)) skill = "skilled";
    jobs.push({
      title: title?.[1]?.trim() ?? sentence.text.slice(0, 80),
      start,
      end,
      calendarDays,
      withinFiveYears,
      underThirtyDays: underThirty,
      liftPounds: lift?.[1] ? Number(lift[1]) : null,
      skill,
      sentenceIndex: sentence.index,
    });
  }
  return jobs;
}

function onlyBriefWork(text: string): boolean {
  const sentences = text.split(/\n|(?<=\.)\s+/);
  const briefSentence = (sentence: string) => {
    if (!/\b(?:job|work|employment)\b/i.test(sentence)) return false;
    const day = /\blasted\s+(\d{1,3})\s+days?\b/i.exec(sentence);
    return day?.[1] !== undefined && Number(day[1]) < 30;
  };
  if (!sentences.some(briefSentence)) return false;
  const longerWork = sentences.some((sentence) => /\b(20\d{2})\b[^\d]{0,20}\b(20\d{2})\b/.test(sentence) || (/\b(?:job|work)\b/i.test(sentence) && /\bunskilled\b/i.test(sentence) && !briefSentence(sentence)));
  return !longerWork;
}

function experienceOf(work: WorkFact[], neverWorked: boolean, text: string): ExperienceKind | null {
  if (neverWorked || (work.length === 0 && /\bno past relevant work\b/i.test(text))) return "none";
  if (/\bskills? (?:are |were )?not transferable\b|\bno transferable skills\b/i.test(text)) return "not-transferable";
  if (/\bskills? (?:are |were )?transferable\b/i.test(text) && !/\bnot transferable\b/i.test(text)) return "transferable";
  const durable = work.filter((job) => !job.underThirtyDays);
  const skillText = text.replace(/direct entry into skilled work/gi, "");
  if (durable.some((job) => job.skill === "skilled" || job.skill === "semiskilled") || (/\bskilled work\b/i.test(skillText) && !onlyBriefWork(skillText))) {
    return null;
  }
  if (durable.some((job) => job.skill === "unskilled")) return "unskilled";
  if (onlyBriefWork(skillText) || (work.length > 0 && durable.length === 0)) return "none";
  if (/\bunskilled\b/i.test(skillText)) return "unskilled";
  return null;
}

const CHILD_DOMAINS = [
  "acquiring and using information",
  "attending and completing tasks",
  "interacting and relating",
  "moving about and manipulating",
  "caring for yourself",
  "health and physical well-being",
] as const;

function readChildDomains(sentences: WeighedSentence[]): Record<string, "extreme" | "marked" | "mentioned" | "absent"> {
  const domains: Record<string, "extreme" | "marked" | "mentioned" | "absent"> = {};
  for (const domain of CHILD_DOMAINS) {
    const medical = sentences.filter((sentence) => sentence.category !== "nonmedical" && sentence.category !== "vocational" && sentence.category !== "unclassified");
    const hit = medical.find((sentence) => sentence.text.toLowerCase().includes(domain.slice(0, 18)));
    if (!hit) {
      domains[domain] = "absent";
      continue;
    }
    if (/extreme/i.test(hit.text)) domains[domain] = "extreme";
    else if (/marked/i.test(hit.text)) domains[domain] = "marked";
    else domains[domain] = "mentioned";
  }
  return domains;
}

export { CHILD_DOMAINS };
