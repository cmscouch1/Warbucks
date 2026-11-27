import { authorityContains, BENCH_NOTICE, gridRule } from "./corpus.js";
import { buildDraft } from "./draft.js";
import { evaluateListing } from "./listings.js";
import { evaluateSequential, filingStrength, pointsLeft, scoreFactors } from "./evaluate.js";
import { readFacts } from "./facts.js";
import { joinSentences, splitSentences } from "./sentences.js";
import type { AuditReport, FilingInput, GradeReport } from "./types.js";

function audit(input: FilingInput, report: Omit<GradeReport, "audit" | "reliable" | "reflection">, rebuilt: string): AuditReport {
  const checks = [];
  const narrative = input.narrative ?? "";
  const rejoined = joinSentences(splitSentences(narrative));
  checks.push({ id: "sentences-lossless", passed: rejoined === narrative, detail: rejoined === narrative ? "Every character of the filing is in the sentence ledger." : "The sentence split dropped or added characters." });
  const weights = report.factors.reduce((sum, factor) => sum + factor.weight, 0);
  checks.push({ id: "weights-100", passed: weights === 100, detail: `Factor weights sum to ${weights}.` });
  const recomputed = filingStrength(report.factors);
  checks.push({
    id: "score-recomputes",
    passed: report.filingStrength === recomputed,
    detail: `Reported ${report.filingStrength}, recomputed ${recomputed}.`,
  });
  const inRange = report.filingStrength !== null && report.filingStrength >= 0 && report.filingStrength <= 100;
  checks.push({ id: "score-range", passed: inRange, detail: "Filing strength is an integer from 0 to 100." });
  for (const factor of report.factors) {
    if (!factor.applicable) continue;
    if (factor.id === "rfc" || factor.id === "domains") continue;
    const found = authorityContains(factor.citation, factor.anchor);
    checks.push({ id: `anchor-${factor.id}`, passed: found, detail: found ? `${factor.citation} contains the anchor.` : `${factor.citation} does not contain “${factor.anchor}”.` });
  }
  const decided = report.sequential.decidedAtStep;
  const deciding = report.sequential.steps.find((item) => item.step === decided);
  const outcomeAgrees = decided === null || (deciding !== undefined && (deciding.outcome === report.sequential.outcome || (deciding.outcome === "continue" && report.sequential.outcome === "not-determinable")));
  checks.push({ id: "step-agrees", passed: outcomeAgrees, detail: outcomeAgrees ? "The deciding step matches the outcome." : "The deciding step does not match the outcome." });
  if (report.sequential.outcome === "disabled" && report.sequential.decidedAtStep === 3) {
    const ok = report.listing.meets && report.listing.testedPath;
    checks.push({ id: "listing-allowance", passed: ok, detail: ok ? "The step 3 allowance uses a tested listing path." : "A step 3 allowance was made without a tested listing path." });
  }
  if (report.vocational.ruleId) {
    const printed = gridRule(report.vocational.ruleId);
    const agrees = printed !== undefined && (!report.vocational.directed || printed.decision === report.vocational.outcome);
    checks.push({
      id: "grid-rule-named",
      passed: agrees,
      detail: agrees ? `Rule ${report.vocational.ruleId} in the corpus agrees with this result.` : `Rule ${report.vocational.ruleId} does not agree with the vocational outcome.`,
    });
  }
  if (report.vocational.borderline) {
    const stayed = report.vocational.outcome === "not-disabled" && report.vocational.ruleId === report.vocational.borderline.chronologicalRuleId;
    checks.push({
      id: "borderline-not-moved",
      passed: stayed,
      detail: stayed ? "The chronological grid rule was kept." : "The borderline flag moved the age category.",
    });
  }
  checks.push({ id: "no-fabricated-numbers", passed: report.draft.fabricationCheck.passed, detail: report.draft.fabricationCheck.passed ? "The gap sentences add no new numbers." : `New numbers in the gaps: ${report.draft.fabricationCheck.novelNumbers.join(", ")}.` });
  const rebuiltSame = rebuilt === narrative;
  checks.push({ id: "read-back", passed: rebuiltSame, detail: rebuiltSame ? "The fact reader saw the full filing." : "The fact reader did not see the same filing text." });
  return { ok: checks.every((check) => check.passed), healed: false, healNotes: [], checks };
}

export function gradeOnce(input: FilingInput): Omit<GradeReport, "reflection"> {
  const { facts, piecesJoin } = readFacts(input);
  const listing = evaluateListing(facts);
  const { sequential, vocational } = evaluateSequential(facts, listing);
  const factors = scoreFactors(facts, listing);
  const strength = filingStrength(factors);
  const draft = buildDraft(input.narrative ?? "", facts, factors, listing, sequential);
  const partial = {
    notice: BENCH_NOTICE,
    filingStrength: strength,
    pointsLeft: pointsLeft(factors),
    sequential,
    listing,
    vocational,
    factors,
    sentences: facts.sentences,
    opinions: facts.opinions,
    overrides: facts.overrides,
    draft,
  };
  const reportAudit = audit(input, partial, piecesJoin);
  return { reliable: reportAudit.ok, ...partial, audit: reportAudit };
}
