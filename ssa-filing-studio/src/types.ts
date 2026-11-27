export type Program = "title-ii" | "title-xvi";

export type Education = "illiterate" | "marginal" | "limited" | "high-school-or-more";

export type ExperienceKind = "none" | "unskilled" | "not-transferable" | "transferable";

export type Exertional =
  | "less-than-sedentary"
  | "sedentary"
  | "light"
  | "medium"
  | "heavy"
  | "very-heavy"
  | "unknown";

export type Outcome = "disabled" | "not-disabled" | "not-determinable";

export type EvidenceCategory =
  | "objective-medical"
  | "medical-opinion"
  | "other-medical"
  | "nonmedical"
  | "prior-administrative"
  | "vocational"
  | "unclassified";

export type OpinionRule = "404.1520c" | "404.1527";

export interface FilingInput {
  narrative: string;
  program?: Program;
  filingDate?: string;
  /** Date of determination/hearing used for attained age and the five-year past-work window. */
  determinationDate?: string;
  age?: number;
  birthDate?: string;
  education?: Education;
  /** True only when the record says education provides direct entry into skilled work. */
  directEntryToSkilledWork?: boolean;
  monthlyEarnings?: number;
  earningsYear?: number;
  selfEmployed?: boolean;
  statutoryBlindness?: boolean;
  onsetDate?: string;
}

export interface WeighedSentence {
  index: number;
  text: string;
  category: EvidenceCategory;
  citation: string;
  why: string;
  reservedIssue: boolean;
  reservedWhy: string | null;
  sourceName: string | null;
  provenance: { documentId: string | null; pageNumber: number | null; sourceName: string | null; sourceRole: string | null };
  tags: string[];
  legallyIncompetentFor: string[];
}

export interface Limit {
  fn: "lift-occasional" | "lift-frequent" | "sit" | "stand-walk";
  amount: number;
  unit: "pounds" | "hours";
  sentenceIndex: number;
}

export interface SourceOpinion {
  name: string;
  specialty: boolean;
  treating: boolean;
  examining: boolean;
  familiar: boolean;
  explanation: boolean;
  ownObjective: boolean;
  limits: Limit[];
  reservedOnly: boolean;
  priorAdministrative: boolean;
}

export interface WorkFact {
  title: string;
  start: string | null;
  end: string | null;
  calendarDays: number | null;
  withinFiveYears: boolean | null;
  underThirtyDays: boolean;
  liftPounds: number | null;
  skill: "unskilled" | "semiskilled" | "skilled" | null;
  /** True when this job is described as substantial gainful activity or full-time work. */
  sgaShown: boolean;
  sentenceIndex: number;
}

export type SymptomKey =
  | "daily-activities"
  | "location-duration-frequency-intensity"
  | "precipitating-aggravating"
  | "medication"
  | "other-treatment"
  | "measures"
  | "other-factors";

export interface Facts {
  sentences: WeighedSentence[];
  program: Program;
  filingDate: string | null;
  referenceDate: string;
  opinionRule: OpinionRule;
  age: number | null;
  birthDate: string | null;
  education: Education | null;
  directEntry: boolean | null;
  monthlyEarnings: number | null;
  earningsYear: number | null;
  selfEmployed: boolean;
  subsidyOrIrweUnresolved: boolean;
  unsuccessfulWorkAttempt: boolean;
  /** Work of six months or less that stopped because of the impairment, whether or not the 30-day break is stated. */
  workAttemptDescribed: boolean;
  /** True when past work is described as substantial gainful activity or full-time work. */
  pastWorkSgaShown: boolean;
  workingNow: boolean | null;
  statutoryBlindness: boolean;
  duration: "met" | "not-met" | "unknown";
  yearsSinceOnset: number | null;
  amsNamed: boolean;
  objectiveFinding: boolean;
  objectiveTied: boolean;
  diagnosisCount: number;
  combinationAddressed: boolean;
  mildCombinationOpen: boolean;
  severe: "yes" | "no" | "unknown";
  listingIds: string[];
  equivalenceAlleged: boolean;
  opinions: SourceOpinion[];
  medicalConflict: string | null;
  nonmedicalConflict: string | null;
  symptomAlleged: boolean;
  symptomLinked: boolean;
  symptomFactors: Record<SymptomKey, boolean>;
  physicalAlleged: boolean;
  mentalAlleged: boolean;
  rfc: {
    established: boolean;
    exertional: Exertional;
    fullRange: boolean;
    why: string;
    sit: number | null;
    standWalk: number | null;
    liftOccasional: number | null;
    liftFrequent: number | null;
  };
  functionFlags: {
    sit: boolean;
    standWalk: boolean;
    lift: boolean;
    postural: boolean;
    mentalAreas: number;
    workday: boolean;
  };
  work: WorkFact[];
  confirmedPrw: WorkFact[];
  neverWorked: boolean;
  experience: ExperienceKind | null;
  veryLittleAdjustment: boolean;
  nonexertionalErosion: boolean;
  arduousYears: number | null;
  cannotDoArduousWork: boolean;
  childDomains: Record<string, "extreme" | "marked" | "mentioned" | "absent">;
  overrides: string[];
}

export interface StepResult {
  step: 1 | 2 | 3 | 4 | 5;
  title: string;
  reached: boolean;
  outcome: Outcome | "continue";
  citation: string;
  explanation: string;
}

export interface SequentialResult {
  outcome: Outcome;
  decidedAtStep: 1 | 2 | 3 | 4 | 5 | null;
  headline: string;
  steps: StepResult[];
}

export interface ListingElement {
  id: string;
  text: string;
  met: boolean;
  matchedSentence: number | null;
}

export interface ListingResult {
  id: string | null;
  inCorpus: boolean;
  testedPath: boolean;
  meets: boolean;
  path: string | null;
  explanation: string;
  criteria: string;
  lettersAddressed: number;
  lettersTotal: number;
  elements: ListingElement[];
}

export interface BorderlineAge {
  daysUntilHigherAge: number;
  higherAge: number;
  higherRuleId: string | null;
  chronologicalRuleId: string | null;
}

export interface VocationalResult {
  directed: boolean;
  outcome: Outcome;
  ruleId: string | null;
  explanation: string;
  citations: string[];
  candidates: { id: string; decision: Outcome; age: string; education: string; experience: string }[];
  /** Set only when POMS DI 25001.001's three borderline conditions are met. The chronological rule is not moved. */
  borderline: BorderlineAge | null;
}

export interface FactorCheck {
  id: string;
  label: string;
  earned: number;
  weight: number;
  met: boolean;
  citation: string;
  detail: string;
}

export interface FactorResult {
  id: string;
  label: string;
  weight: number;
  earned: number;
  applicable: boolean;
  citation: string;
  anchor: string;
  summary: string;
  checks: FactorCheck[];
}

export interface Draft {
  reorganized: string;
  gaps: { citation: string; points: number; whatToObtain: string; sentenceShape: string }[];
  fabricationCheck: { novelNumbers: string[]; passed: boolean };
}

export interface AuditCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export interface AuditReport {
  ok: boolean;
  healed: boolean;
  healNotes: string[];
  checks: AuditCheck[];
}

export interface GradeReport {
  reliable: boolean;
  notice: string;
  filingStrength: number | null;
  pointsLeft: number;
  sequential: SequentialResult;
  listing: ListingResult;
  vocational: VocationalResult;
  factors: FactorResult[];
  sentences: WeighedSentence[];
  opinions: SourceOpinion[];
  /** When a birth date or a structured field replaced a number written in the narrative. */
  overrides: string[];
  draft: Draft;
  audit: AuditReport;
}
