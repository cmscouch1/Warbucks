import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  compareFilings,
  draftForModel,
  gradeForModel,
  gridRuleForModel,
  inventedClinicalMarkers,
  listAuthorities,
  listGridRulesForModel,
  listingForModel,
  MODEL_GUIDE,
  quoteForModel,
  runBenchSelfTest,
  sgaForModel,
  vocationalForModel,
  weighSentences,
} from "./bench-api.js";
import { BENCH_NOTICE, searchAuthorities } from "./corpus.js";
import { novelNumbers } from "./draft.js";
import type { FilingInput } from "./types.js";

const SERVER_INSTRUCTIONS = `Deterministic SSA disability filing bench. filingStrength is not an SSA score. sequential.outcome is what the regulations do with facts the text establishes. Never invent a diagnosis, test, measurement, date, job, or limitation. When source documents are available, use grade_complete_record and provide every relevant document in full text with provenance and procedural/work/treatment chronologies; do not reduce the record to a narrative summary. Use grade_filing only for a genuinely narrative-only review. Before stating a rule, call quote_authority. Before keeping a rewrite, call compare_filings and discard it when novelNumbers or inventedClinicalMarkers is not empty. Do not tell a client they will be approved. If reliable is false, show the audit and do not present the number as a grade. Explicitly flag Title II insured-status/DLI, protective-filing, prior-decision, and concurrent-program issues because the current deterministic engine does not adjudicate them. Read ssa://guide.`;

function filingShape(narrative: string) {
  return {
    narrative: z.string().min(1).describe(narrative),
    program: z.enum(["title-ii", "title-xvi"]).optional().describe("title-ii is SSDI. title-xvi is SSI. Earnings do not deny at step 1 for Title XVI statutory blindness (20 CFR 416.984)."),
    filingDate: z.string().optional().describe("YYYY-MM-DD. A date before 2017-03-27 selects 20 CFR 404.1527. Omitting it selects 20 CFR 404.1520c, and the report says so."),
    age: z.number().int().optional().describe("Use only when the record states the age. Do not estimate."),
    birthDate: z.string().optional().describe("YYYY-MM-DD from the record. Used to compute SSA age (attained the day before the birthday) and to flag a borderline age when POMS DI 25001.001's three conditions are met. The chronological category is not moved."),
    education: z.enum(["illiterate", "marginal", "limited", "high-school-or-more"]).optional().describe("illiterate means cannot read or write a simple message. marginal is 6th grade or less. limited is 7th through 11th."),
    directEntryToSkilledWork: z.boolean().optional().describe("True only if the record affirmatively finds that education provides direct entry into skilled work. Omit it when the record is silent."),
    monthlyEarnings: z.number().optional().describe("Average monthly countable earnings. Do not invent this."),
    earningsYear: z.number().int().optional().describe("The year whose substantial-gainful-activity table applies."),
    selfEmployed: z.boolean().optional().describe("True when the work is self-employment. The wage table is then not the test (20 CFR 404.1575)."),
    statutoryBlindness: z.boolean().optional().describe("True only for statutory blindness. Do not set this because someone wrote 'legally blind'."),
    onsetDate: z.string().optional().describe("YYYY-MM-DD alleged onset, if the record states it."),
  };
}

function toFiling(args: {
  narrative: string;
  program?: "title-ii" | "title-xvi";
  filingDate?: string;
  age?: number;
  birthDate?: string;
  education?: "illiterate" | "marginal" | "limited" | "high-school-or-more";
  directEntryToSkilledWork?: boolean;
  monthlyEarnings?: number;
  earningsYear?: number;
  selfEmployed?: boolean;
  statutoryBlindness?: boolean;
  onsetDate?: string;
}): FilingInput {
  return args;
}

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "The bench could not complete that call.";
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "ssa-filing-bench", version: "1.1.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerResource("guide", "ssa://guide", { description: "Operating rules for using this bench. Read this before grading or rewriting a filing.", mimeType: "text/plain" }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/plain", text: MODEL_GUIDE }],
  }));
  server.registerResource("notice", "ssa://notice", { description: "The honesty notice that accompanies every grade.", mimeType: "text/plain" }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/plain", text: BENCH_NOTICE }],
  }));
  server.registerResource("authorities", "ssa://authorities", { description: "Every regulation section, POMS record, listing count, and grid count loaded in this bench.", mimeType: "application/json" }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(listAuthorities(), null, 2) }],
  }));
  server.registerResource(
    "section",
    new ResourceTemplate("ssa://section/{id}", { list: undefined }),
    { description: "Verbatim eCFR section. The id is the section number, such as 404.1520c.", mimeType: "text/plain" },
    async (uri, variables) => {
      const id = String(variables.id ?? "");
      const hit = quoteForModel(id);
      return { contents: [{ uri: uri.href, mimeType: "text/plain", text: JSON.stringify(hit, null, 2) }] };
    },
  );
  server.registerResource(
    "listing",
    new ResourceTemplate("ssa://listing/{id}", { list: undefined }),
    { description: "Verbatim Appendix 1 listing. The id is the listing number, such as 12.04.", mimeType: "text/plain" },
    async (uri, variables) => {
      const id = String(variables.id ?? "");
      return { contents: [{ uri: uri.href, mimeType: "text/plain", text: JSON.stringify(listingForModel(id), null, 2) }] };
    },
  );

  server.registerPrompt(
    "review-filing",
    {
      title: "Review a disability filing",
      description: "Grade a filing and explain the sequential result with quoted authority. Does not rewrite facts.",
      argsSchema: { narrative: z.string().describe("The filing in the client's own words.") },
    },
    ({ narrative }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Review this disability filing with the SSA Filing Bench.\n\nCall grade_filing first. Lead with sequential.outcome and the deciding step's citation. Then explain filingStrength as the bench index, not an SSA score. For every rule you state, call quote_authority and quote the returned sentence. List the sentence ledger categories that cannot legally do what the writer seems to want. Do not invent a fact. Do not say the client will be approved.\n\nFiling:\n${narrative}`,
        },
      }],
    }),
  );

  server.registerPrompt(
    "strengthen-filing",
    {
      title: "Strengthen a filing without inventing facts",
      description: "Draft the strongest honest version, then require compare_filings before any rewrite is kept.",
      argsSchema: { narrative: z.string().describe("The filing in the client's own words.") },
    },
    ({ narrative }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Help strengthen this filing.\n\nCall draft_strongest_filing. Keep every original sentence. Turn each GAP into a question for the client, with the blank still blank. Do not fill a blank from medical knowledge. If the user later supplies a rewritten filing, call compare_filings. If novelNumbers or inventedClinicalMarkers is not empty, reject the rewrite.\n\nFiling:\n${narrative}`,
        },
      }],
    }),
  );

  server.registerPrompt(
    "explain-rule",
    {
      title: "Explain one authority",
      description: "Quote a regulation, listing, POMS section, or grid rule before explaining it.",
      argsSchema: { citation: z.string().describe("A section, listing id, POMS id, or grid rule id.") },
    },
    ({ citation }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Explain ${citation}. Call quote_authority first. If found is false, say the bench does not have that text and do not supply it from memory as if it were the regulation. If found is true, quote the paragraphs that answer the question and then say what an advocate should do with them.`,
        },
      }],
    }),
  );

  server.registerTool("how_to_use", {
    title: "How to use this bench",
    description: "Return the operating rules. Call this before the first grade or rewrite in a conversation. filingStrength is not an SSA score. You must quote_authority before stating a rule and compare_filings before keeping a rewrite.",
    inputSchema: {},
    annotations: readOnly,
  }, async () => json({ guide: MODEL_GUIDE }));

  server.registerTool("grade_filing", {
    title: "Grade a filing",
    description: "Run the sequential evaluation and the filing-strength index on the words given. Returns the deciding step, the sentence ledger, opinion weighing, listing path, vocational rule, the strongest honest draft, and the audit. Do not add facts that are not in the narrative or the structured fields. Do not describe filingStrength as an SSA score or an approval probability. If reliable is false, show the failed audit checks and do not present the number as a grade.",
    inputSchema: filingShape("The filing text only. Do not add a diagnosis, test, measurement, or limitation the client did not state."),
    annotations: readOnly,
  }, async (args) => {
    try {
      return json(gradeForModel(toFiling(args)));
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool("grade_complete_record", {
    title: "Grade a complete SSA evidence record",
    description: "Primary full-record intake for an SSA filing review. Supply the claimant narrative AND every relevant document in full text, with source, author/role, dates, page count, exhibit reference, and submission status. Include prior decisions, medical records, opinion evidence, treatment chronology, work history, function reports, third-party statements, and procedural records. The tool preserves a document manifest and passes the complete text to the existing deterministic evaluator. IMPORTANT: the current deterministic engine does not independently adjudicate Title II insured status/DLI, protective-filing disputes, prior-decision effect, or concurrent Title II/Title XVI eligibility; it flags those as agent-review issues rather than silently treating them as resolved. Never omit a document because it appears duplicative; identify duplicates in metadata and let the reviewing agent assess materiality.",
    inputSchema: {
      claimantNarrative: z.string().optional().describe("Claimant's own complete narrative, verbatim. Do not summarize away details."),
      documents: z.array(z.object({
        documentId: z.string().min(1).describe("Stable unique identifier for this record item."),
        title: z.string().min(1).describe("Document title or descriptive label."),
        documentType: z.string().min(1).describe("For example: treatment note, psychiatric evaluation, medical opinion, ALJ decision, Appeals Council notice, function report, third-party statement, earnings record, work history, or correspondence."),
        sourceName: z.string().optional().describe("Provider, agency, witness, employer, or originating institution."),
        sourceRole: z.string().optional().describe("Author's role/credentials or relationship to claimant; do not infer credentials."),
        documentDate: z.string().optional().describe("Document creation/signature date, if known."),
        periodStart: z.string().optional().describe("Beginning of the period described by the document."),
        periodEnd: z.string().optional().describe("End of the period described by the document."),
        pageCount: z.number().int().nonnegative().optional(),
        exhibitReference: z.string().optional().describe("SSA exhibit/page reference, if assigned."),
        submissionStatus: z.enum(["submitted", "uploaded", "served", "in-record", "not-submitted", "unknown"]).optional(),
        duplicateOf: z.string().optional().describe("Another documentId if this is a duplicate; retain it rather than silently dropping it."),
        fullText: z.string().min(1).describe("Complete extracted/OCR text. Include every page, headings, tables, signatures, and relevant footnotes. Do not replace with an AI summary."),
      })).min(1).describe("All relevant source documents, not merely selected excerpts."),
      proceduralHistory: z.string().optional().describe("Complete procedural chronology, including applications, protective filing dates, determinations, hearings, decisions, appeals, notices, and receipt status."),
      workHistory: z.string().optional().describe("Complete work chronology with employers, duties, dates, hours, earnings, accommodations, subsidies, unsuccessful work attempts, and job demands when known."),
      treatmentChronology: z.string().optional().describe("Longitudinal treatment chronology, including providers, encounters, diagnoses, findings, medication changes, response, adverse effects, gaps, referrals, and attempted contacts."),
      dateLastInsured: z.string().optional().describe("Title II date last insured, if established by an SSA earnings/insured-status record. Do not infer it."),
      protectiveFilingDate: z.string().optional().describe("Protective filing date, kept distinct from application completion/submission/receipt dates."),
      actualFilingDate: z.string().optional().describe("Actual application submission/filing date, if verified."),
      priorDecisionDate: z.string().optional().describe("Date of any prior SSA decision."),
      program: z.enum(["title-ii", "title-xvi"]).optional(),
      filingDate: z.string().optional().describe("Date used for the current application/rule selection only when established."),
      age: z.number().int().optional(),
      birthDate: z.string().optional(),
      education: z.enum(["illiterate", "marginal", "limited", "high-school-or-more"]).optional(),
      directEntryToSkilledWork: z.boolean().optional(),
      monthlyEarnings: z.number().optional(),
      earningsYear: z.number().int().optional(),
      selfEmployed: z.boolean().optional(),
      statutoryBlindness: z.boolean().optional(),
      onsetDate: z.string().optional(),
    },
    annotations: readOnly,
  }, async (args) => {
    try {
      const sections: string[] = [];
      if (args.claimantNarrative) sections.push("CLAIMANT NARRATIVE (verbatim):\\n" + args.claimantNarrative);
      if (args.proceduralHistory) sections.push("PROCEDURAL HISTORY (source supplied; dates/status must be verified):\\n" + args.proceduralHistory);
      if (args.workHistory) sections.push("WORK HISTORY (source supplied; do not infer SGA or PRW from job title alone):\\n" + args.workHistory);
      if (args.treatmentChronology) sections.push("TREATMENT CHRONOLOGY (source supplied; preserve longitudinal sequence):\\n" + args.treatmentChronology);
      for (const doc of args.documents) {
        const metadata = [
          "DOCUMENT " + doc.documentId,
          "Title: " + doc.title,
          "Type: " + doc.documentType,
          "Source: " + (doc.sourceName ?? "not supplied") + " | Role: " + (doc.sourceRole ?? "not supplied"),
          "Document date: " + (doc.documentDate ?? "not supplied"),
          "Period: " + (doc.periodStart ?? "unknown") + " through " + (doc.periodEnd ?? "unknown"),
          "Pages: " + (doc.pageCount ?? "unknown"),
          "SSA exhibit: " + (doc.exhibitReference ?? "not supplied"),
          "Submission status: " + (doc.submissionStatus ?? "unknown"),
          "Duplicate of: " + (doc.duplicateOf ?? "not identified"),
        ].join("\\n");
        sections.push(metadata + "\\nFULL SOURCE TEXT (do not treat metadata as evidence):\\n" + doc.fullText);
      }
      const narrative = sections.join("\\n\\n===== NEXT RECORD ITEM =====\\n\\n");
      const filing = toFiling({
        narrative,
        program: args.program,
        filingDate: args.filingDate,
        age: args.age,
        birthDate: args.birthDate,
        education: args.education,
        directEntryToSkilledWork: args.directEntryToSkilledWork,
        monthlyEarnings: args.monthlyEarnings,
        earningsYear: args.earningsYear,
        selfEmployed: args.selfEmployed,
        statutoryBlindness: args.statutoryBlindness,
        onsetDate: args.onsetDate,
      });
      const report = gradeForModel(filing);
      const unsupported = [];
      if (args.dateLastInsured) unsupported.push("Date last insured supplied but not adjudicated by the current engine; independently analyze Title II insured status and onset before/through the DLI.");
      if (args.protectiveFilingDate || args.actualFilingDate) unsupported.push("Protective filing and actual submission dates are preserved in the intake manifest but not reconciled by the current engine; distinguish protective filing, application completion, submission, and SSA receipt.");
      if (args.priorDecisionDate) unsupported.push("Prior decision supplied but not analyzed for administrative res judicata, reopening, prior findings, or changed circumstances by the current engine.");
      if (!args.program) unsupported.push("Program/title not specified; do not assume Title II, Title XVI, or concurrent eligibility.");
      return json({
        recordIntake: {
          documentCount: args.documents.length,
          documents: args.documents.map(({ fullText, ...metadata }) => ({ ...metadata, characterCount: fullText.length })),
          suppliedSections: {
            claimantNarrative: Boolean(args.claimantNarrative),
            proceduralHistory: Boolean(args.proceduralHistory),
            workHistory: Boolean(args.workHistory),
            treatmentChronology: Boolean(args.treatmentChronology),
          },
          preservedButNotEngineAdjudicated: {
            dateLastInsured: args.dateLastInsured ?? null,
            protectiveFilingDate: args.protectiveFilingDate ?? null,
            actualFilingDate: args.actualFilingDate ?? null,
            priorDecisionDate: args.priorDecisionDate ?? null,
          },
        },
        requiredAgentReview: unsupported,
        deterministicGrade: report,
        instruction: "This is a full-text intake plus the current deterministic bench result, not a substitute for source-by-source legal analysis. The reviewing agent must independently reconcile every document, preserve conflicting accounts, identify missing pages/exhibits and submission/receipt proof, and analyze every item listed in requiredAgentReview. Never describe a supplied document as filed, received, or considered merely because it is present here.",
      });
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool("weigh_sentences", {
    title: "Weigh each sentence",
    description: "Classify every sentence into a 20 CFR 404.1513 evidence category and say what that sentence is legally incompetent to prove. This is the sentence method. It is not a per-word percentage. Objective medical evidence, medical opinion, other medical evidence, and nonmedical evidence do different jobs.",
    inputSchema: filingShape("The filing text to split and classify. The split is lossless."),
    annotations: readOnly,
  }, async (args) => json(weighSentences(toFiling(args))));

  server.registerTool("quote_authority", {
    title: "Quote an authority",
    description: "Return the verbatim loaded text of a regulation section (404.1520c or 20 CFR 404.1520c), a POMS id (DI 25001.001), a listing id (12.04), or a grid rule id (201.09). If found is false, the corpus does not contain it. Do not invent the missing text.",
    inputSchema: { citation: z.string().min(2).describe("Section, POMS id, listing id, or grid rule id.") },
    annotations: readOnly,
  }, async ({ citation }) => json(quoteForModel(citation)));

  server.registerTool("search_authorities", {
    title: "Search the loaded authorities",
    description: "Find verbatim paragraphs in the loaded regulations, listings, Appendix 2 prose, and POMS. Use this to locate a citation before quote_authority. A short query returns nothing.",
    inputSchema: {
      query: z.string().min(3).describe("A phrase of at least 3 characters, such as 'substantial gainful activity' or 'supportability'."),
      limit: z.number().int().min(1).max(20).optional().describe("Maximum hits. Default 8."),
    },
    annotations: readOnly,
  }, async ({ query, limit }) => json({ hits: searchAuthorities(query, limit ?? 8) }));

  server.registerTool("get_listing", {
    title: "Get a listing",
    description: "Return the verbatim Appendix 1 listing. Pass a narrative only when you also want the bench's element-by-element reading. A claimant's own symptom words do not satisfy a listing that requires medical documentation. Equivalence is not an automatic allowance.",
    inputSchema: {
      id: z.string().describe("Listing id, such as 12.04 or 1.15."),
      narrative: z.string().optional().describe("Optional filing text. Omit it to quote the listing only."),
    },
    annotations: readOnly,
  }, async ({ id, narrative }) => json(listingForModel(id, narrative)));

  server.registerTool("get_sga_amount", {
    title: "Get the SGA amount",
    description: "Return the loaded monthly substantial-gainful-activity amount for a year, separately for statutory blindness and for other employees. Earnings equal to the amount are not substantial gainful activity. If the year is missing, do not borrow another year. Self-employment does not use this wage figure.",
    inputSchema: {
      year: z.number().int().describe("Calendar year of the earnings."),
      blind: z.boolean().describe("True only for statutory blindness."),
    },
    annotations: readOnly,
  }, async ({ year, blind }) => json(sgaForModel(year, blind)));

  server.registerTool("apply_vocational_rule", {
    title: "Apply a vocational rule to established findings",
    description: "Apply Appendix 2 to age, education, work experience, and an exertional range that are already established. Use this for hypotheticals. Do not use it when grade_filing says residual functional capacity is not established. A bare label such as 'sedentary' is not an established range. High-school direct entry must be true or false from the record; omit it when the record is silent so the bench will not pick between the 'provides' and 'does not provide' rules. 'None' is not the same work experience as 'unskilled'.",
    inputSchema: {
      age: z.number().int().nullable().describe("Age at the determination, or null if unknown."),
      education: z.enum(["illiterate", "marginal", "limited", "high-school-or-more"]).nullable(),
      directEntry: z.boolean().nullable().describe("Whether high-school education provides direct entry into skilled work. Null means the record is silent."),
      experience: z.enum(["none", "unskilled", "not-transferable", "transferable"]).nullable(),
      exertional: z.enum(["less-than-sedentary", "sedentary", "light", "medium", "heavy", "very-heavy", "unknown"]),
      fullRange: z.boolean().describe("True only when the person can do the full range of that exertional level on a regular and continuing basis."),
      nonexertionalErosion: z.boolean().describe("True when a significant nonexertional limit means a not-disabled grid rule is a framework only."),
      veryLittleAdjustment: z.boolean().describe("True when skills would transfer with very little, if any, vocational adjustment."),
    },
    annotations: readOnly,
  }, async (profile) => json(vocationalForModel(profile)));

  server.registerTool("get_grid_rule", {
    title: "Get one grid rule",
    description: "Return one Appendix 2 rule as loaded, including the decision the table directs. Example ids: 201.01, 201.09, 201.17, 202.09, 203.10, 203.11.",
    inputSchema: { id: z.string().describe("Rule id, such as 201.09.") },
    annotations: readOnly,
  }, async ({ id }) => json(gridRuleForModel(id)));

  server.registerTool("list_grid_rules", {
    title: "List grid rules",
    description: "List the loaded Appendix 2 rules, optionally for one exertional table. Read the decision column from this list. Do not invent a rule id.",
    inputSchema: {
      exertional: z.enum(["sedentary", "light", "medium"]).optional().describe("Omit to list every loaded rule."),
    },
    annotations: readOnly,
  }, async ({ exertional }) => json(listGridRulesForModel(exertional)));

  server.registerTool("draft_strongest_filing", {
    title: "Draft the strongest honest filing",
    description: "Reorganize the filing under the regulatory headings and list GAP sentences for missing facts. A GAP is a blank, not a fact. Do not fill a GAP from medical knowledge. After any human fills a blank, call compare_filings.",
    inputSchema: filingShape("The filing to reorganize. Do not improve the medical facts."),
    annotations: readOnly,
  }, async (args) => {
    try {
      return json(draftForModel(toFiling(args)));
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool("compare_filings", {
    title: "Compare a rewrite to the original",
    description: "Grade the original and a rewrite. novelNumbers lists digits that were not in the original and are not a regulation citation. inventedClinicalMarkers lists clinical words, such as MRI or a diagnosis stem, that the rewrite introduced. If either list is not empty, do not use the rewrite. Reordering the same facts is allowed.",
    inputSchema: {
      ...filingShape("The original filing, before any rewrite."),
      revisedNarrative: z.string().min(1).describe("The rewritten filing. Structured fields from the original are reused and are not a place to smuggle new medical facts."),
    },
    annotations: readOnly,
  }, async (args) => {
    try {
      const { revisedNarrative, ...rest } = args;
      return json(compareFilings(toFiling(rest), revisedNarrative));
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool("flag_invented_facts", {
    title: "Flag invented facts",
    description: "Check a rewrite for new numbers and new clinical markers without re-grading. Use compare_filings when you also need the sequential result. Any hit means the rewrite is not an honest reorganization.",
    inputSchema: {
      original: z.string().min(1),
      revised: z.string().min(1),
    },
    annotations: readOnly,
  }, async ({ original, revised }) => {
    const numbers = novelNumbers(original, revised);
    const markers = inventedClinicalMarkers(original, revised);
    return json({
      clean: numbers.length === 0 && markers.length === 0,
      novelNumbers: numbers,
      inventedClinicalMarkers: markers,
    });
  });

  server.registerTool("list_authorities", {
    title: "List loaded authorities",
    description: "List every regulation section id, POMS id, listing count, grid-rule count, and substantial-gainful-activity year in this bench. Use it to see what quote_authority can return.",
    inputSchema: {},
    annotations: readOnly,
  }, async () => json(listAuthorities()));

  server.registerTool("self_test", {
    title: "Self-test the bench",
    description: "Run the regulatory fixtures: substantial gainful activity boundary, reserved-issue opinions, a 12.04 medical file, grid rule 201.09, Title XVI statutory blindness, and the pre-2017 opinion rule. If passed is false, stop using grades from this server and report failures.",
    inputSchema: {},
    annotations: readOnly,
  }, async () => json(runBenchSelfTest()));

  return server;
}

const entry = process.argv[1] ? resolve(process.argv[1]) : "";
if (entry && fileURLToPath(import.meta.url) === entry) {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("ssa-filing-bench listening on stdio\n");
}
