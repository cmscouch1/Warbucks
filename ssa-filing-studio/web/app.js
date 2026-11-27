const narrative = document.querySelector("#narrative");
const program = document.querySelector("#program");
const filingDate = document.querySelector("#filingDate");
const birthDate = document.querySelector("#birthDate");
const samples = document.querySelector("#samples");
const gradeButton = document.querySelector("#grade");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const notice = document.querySelector("#notice");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function outcomeClass(outcome) {
  if (outcome === "disabled" || outcome === "not-disabled" || outcome === "not-determinable") return outcome;
  return "not-determinable";
}

function outcomeLabel(outcome) {
  if (outcome === "disabled") return "Disabled";
  if (outcome === "not-disabled") return "Not disabled";
  if (outcome === "not-determinable") return "Not determinable";
  if (outcome === "continue") return "Continue";
  return outcome;
}

function render(report) {
  const unreliable = report.reliable ? "" : " unreliable";
  const steps = report.sequential.steps.map((step) => {
    const mark = step.step === report.sequential.decidedAtStep ? " decides" : "";
    return `<li class="${mark}"><strong>Step ${step.step}. ${escapeHtml(step.title)}</strong> — ${escapeHtml(outcomeLabel(step.outcome))}<br>${escapeHtml(step.explanation)} <span class="tag">${escapeHtml(step.citation)}</span></li>`;
  }).join("");
  const sentences = report.sentences.map((sentence) => {
    const reserved = sentence.reservedIssue ? `<br><em>${escapeHtml(sentence.reservedWhy ?? "Reserved issue.")}</em>` : "";
    return `<li><span class="tag">${escapeHtml(sentence.category)}</span>${escapeHtml(sentence.text)}<br><span class="muted">${escapeHtml(sentence.why)}</span>${reserved}</li>`;
  }).join("");
  const factors = report.factors.map((factor) => {
    const score = factor.applicable ? `${factor.earned}/${factor.weight}` : "not applicable";
    return `<li><strong>${escapeHtml(factor.label)}</strong> ${score}<br>${escapeHtml(factor.summary)} <span class="tag">${escapeHtml(factor.citation)}</span></li>`;
  }).join("");
  const gaps = report.draft.gaps.map((gap) => `<p class="gap">GAP (${escapeHtml(gap.citation)}, ${gap.points}): ${escapeHtml(gap.sentenceShape)}</p>`).join("");
  const audit = report.audit.checks.filter((check) => !check.passed).map((check) => `<li>${escapeHtml(check.id)}: ${escapeHtml(check.detail)}</li>`).join("");
  result.innerHTML = `
    <article class="card${unreliable}">
      <p class="outcome ${outcomeClass(report.sequential.outcome)}">${escapeHtml(outcomeLabel(report.sequential.outcome))}</p>
      <p>${escapeHtml(report.sequential.headline)}</p>
      <p class="index">Filing strength index <strong>${report.filingStrength}</strong> of 100. ${report.pointsLeft} points sit in missing facts. This index is not an SSA score.</p>
      ${(report.overrides ?? []).length ? `<ul class="callout">${report.overrides.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : ""}
      ${report.reliable ? "" : `<p><strong>The audit failed.</strong> The number above is not a grade.</p><ul>${audit}</ul>`}
    </article>
    <h2>Sequential evaluation</h2>
    <ol class="steps">${steps}</ol>
    <h2>Listing</h2>
    <p>${escapeHtml(report.listing.explanation)}</p>
    <h2>Vocational rules</h2>
    ${report.vocational.borderline ? `<p class="callout">Borderline age. Chronological rule ${escapeHtml(report.vocational.borderline.chronologicalRuleId ?? "none")} stays. The higher age is ${report.vocational.borderline.higherAge}, ${report.vocational.borderline.daysUntilHigherAge} days away, and rule ${escapeHtml(report.vocational.borderline.higherRuleId ?? "none")} would direct disabled. The category was not moved.</p>` : ""}
    <p>${escapeHtml(report.vocational.explanation)}</p>
    <h2>Sentence ledger</h2>
    <ol class="ledger">${sentences}</ol>
    <h2>How the index was built</h2>
    <ul class="factors">${factors}</ul>
    <h2>Strongest honest draft</h2>
    <p>The sentences below are the filing, regrouped. Each GAP is a blank. Filling it with a fact the record does not contain is not a stronger filing.</p>
    <pre class="gap">${escapeHtml(report.draft.reorganized)}</pre>
    ${gaps}
  `;
}

async function loadSamples() {
  const response = await fetch("/api/samples");
  const body = await response.json();
  for (const sample of body.samples) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = sample.label;
    button.addEventListener("click", () => {
      narrative.value = sample.narrative;
      filingDate.value = sample.filingDate;
      birthDate.value = "";
    });
    samples.append(button);
  }
}

async function weigh() {
  status.textContent = "Weighing.";
  gradeButton.disabled = true;
  try {
    const response = await fetch("/api/grade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        narrative: narrative.value,
        program: program.value,
        filingDate: filingDate.value,
        ...(birthDate.value ? { birthDate: birthDate.value } : {}),
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      result.innerHTML = `<p class="empty">${escapeHtml(body.message ?? "The bench refused to grade this filing.")}</p>`;
      status.textContent = "Not graded.";
      return;
    }
    render(body);
    status.textContent = body.reliable ? "Graded." : "Audit failed.";
  } catch (error) {
    status.textContent = "The request failed.";
    result.innerHTML = `<p class="empty">${escapeHtml(error instanceof Error ? error.message : "The request failed.")}</p>`;
  } finally {
    gradeButton.disabled = false;
  }
}

gradeButton.addEventListener("click", () => { void weigh(); });
notice.textContent = "SSA does not grade a filing from 1 to 100. The index measures whether the submission contains the facts the regulations require. This is not an SSA determination and it is not legal advice.";
void loadSamples();
