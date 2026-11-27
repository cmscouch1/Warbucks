import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = new URL("..", import.meta.url);
const tsx = new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url);

const SEDENTARY = "Dr. Ortiz, an orthopedist who examined me, opined that I can lift 10 pounds occasionally, sit for 6 hours, and stand or walk for 2 hours in an eight-hour workday. He explained this is based on the MRI of the lumbar spine, which showed nerve-root compression, and the reduced range of motion he measured. The impairment is the lumbar spine. It has lasted since 2018, more than twelve months, and it significantly limits sitting.";

const TOOLS = [
  "how_to_use",
  "grade_filing",
  "weigh_sentences",
  "quote_authority",
  "search_authorities",
  "get_listing",
  "get_sga_amount",
  "apply_vocational_rule",
  "get_grid_rule",
  "list_grid_rules",
  "draft_strongest_filing",
  "compare_filings",
  "flag_invented_facts",
  "list_authorities",
  "self_test",
] as const;

type Json = Record<string, unknown>;

function environment(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  return env;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close();
        reject(new Error("The runtime test could not reserve a port."));
        return;
      }
      probe.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function waitForOutput(child: ChildProcess, needle: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timed out waiting for “${needle}”.\n${text}`));
    }, 45_000);
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      text += chunk;
      if (!settled && text.includes(needle)) {
        settled = true;
        clearTimeout(timer);
        resolve(text);
      }
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Process exited ${code} before “${needle}”.\n${text}`));
    });
  });
}

async function post(base: string, path: string, body: unknown): Promise<{ status: number; json: Json }> {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json() as Json;
  return { status: response.status, json };
}

function toolText(result: unknown): Json {
  if (result === null || typeof result !== "object") throw new Error("The tool returned nothing.");
  const record = result as { isError?: boolean; content?: unknown };
  if (!Array.isArray(record.content)) throw new Error("The tool returned no content.");
  const block = record.content.find((item) => {
    return item !== null && typeof item === "object" && "type" in item && item.type === "text" && "text" in item && typeof item.text === "string";
  }) as { text: string } | undefined;
  if (!block) throw new Error("The tool returned no text.");
  if (record.isError) throw new Error(block.text);
  const parsed: unknown = JSON.parse(block.text);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The tool did not return a JSON object.");
  return parsed as Json;
}

function resourceText(result: unknown): string {
  if (result === null || typeof result !== "object" || !("contents" in result) || !Array.isArray(result.contents)) {
    throw new Error("The resource returned no contents.");
  }
  const first: unknown = result.contents[0];
  if (first === null || typeof first !== "object" || !("text" in first) || typeof first.text !== "string") {
    throw new Error("The resource returned no text.");
  }
  return first.text;
}

describe("http runtime", () => {
  let base = "";
  let child: ChildProcess | undefined;

  beforeAll(async () => {
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [tsx.pathname, "src/server.ts"], {
      cwd: root.pathname,
      env: { ...environment(), PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForOutput(child, "SSA Filing Bench");
  }, 60_000);

  afterAll(() => {
    child?.kill("SIGTERM");
  });

  it("serves the desk, the script, and refuses a path that climbs out of web/", async () => {
    const page = await fetch(base);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("The Weighing Room");
    const script = await fetch(`${base}/app.js`);
    expect(script.status).toBe(200);
    expect(await script.text()).toContain("Reflection graph");
    const style = await fetch(`${base}/styles.css`);
    expect(style.status).toBe(200);
    const climb = await fetch(`${base}/%2e%2e/%2e%2e/package.json`);
    expect(climb.status).toBe(404);
    const missing = await fetch(`${base}/no-such-file.html`);
    expect(missing.status).toBe(404);
  });

  it("passes self-test before it will grade, and quotes the loaded authorities", async () => {
    const selfTest = await fetch(`${base}/api/self-test`);
    expect(selfTest.status).toBe(200);
    const selfBody = await selfTest.json() as { passed: boolean; failures: unknown[] };
    expect(selfBody.passed).toBe(true);
    expect(selfBody.failures).toEqual([]);

    const samples = await fetch(`${base}/api/samples`);
    const sampleBody = await samples.json() as { samples: Array<{ id: string; narrative: string; filingDate: string }> };
    expect(sampleBody.samples.map((sample) => sample.id)).toEqual(["working", "symptoms", "listing"]);

    const authority = await fetch(`${base}/api/authority?citation=404.1520c`);
    const authorityBody = await authority.json() as { found: boolean; paragraphs: string[] };
    expect(authorityBody.found).toBe(true);
    expect(authorityBody.paragraphs.join("\n")).toContain("The more relevant the objective medical evidence and supporting explanations");

    const listing = await fetch(`${base}/api/listing?id=12.04`);
    const listingBody = await listing.json() as { found: boolean; id: string };
    expect(listingBody.found).toBe(true);
    expect(listingBody.id).toBe("12.04");

    const sga = await fetch(`${base}/api/sga?year=2026&blind=false`);
    const sgaBody = await sga.json() as { found: boolean; amountUsed: number };
    expect(sgaBody.found).toBe(true);
    expect(sgaBody.amountUsed).toBe(1690);

    const missingYear = await fetch(`${base}/api/sga?year=1990&blind=false`);
    const missingBody = await missingYear.json() as { found: boolean };
    expect(missingBody.found).toBe(false);
  });

  it("grades the samples and the borderline filing through the listening server", async () => {
    const working = await post(base, "/api/grade", {
      narrative: "I am 57 years old. I currently work and earn $3,000 a month.",
      filingDate: "2026-06-01",
    });
    expect(working.status).toBe(200);
    const workingSequential = working.json.sequential as { outcome: string; decidedAtStep: number };
    const workingReflection = working.json.reflection as { stoppedBecause: string; checkpointer: string };
    expect(workingSequential.outcome).toBe("not-disabled");
    expect(workingSequential.decidedAtStep).toBe(1);
    expect(working.json.reliable).toBe(true);
    expect(workingReflection.stoppedBecause).toBe("clean");
    expect(workingReflection.checkpointer).toBe("MemorySaver");
    expect(String(working.json.howToReadThis)).toContain("reflection");

    const equal = await post(base, "/api/grade", {
      narrative: "I am 40 years old. I currently work and earn $1,690 a month.",
      filingDate: "2026-06-01",
    });
    const equalSequential = equal.json.sequential as { outcome: string; decidedAtStep: number };
    expect(equalSequential.decidedAtStep === 1 && equalSequential.outcome === "not-disabled").toBe(false);

    const symptoms = await post(base, "/api/grade", {
      narrative: "I am 60 years old. I stopped working in 2024. My back hurts every day and I cannot sit. I have a 10th grade education.",
      filingDate: "2026-06-01",
    });
    const symptomsSequential = symptoms.json.sequential as { outcome: string; decidedAtStep: number };
    expect(symptomsSequential.outcome).toBe("not-determinable");
    expect(symptomsSequential.decidedAtStep).toBe(2);

    const samples = await fetch(`${base}/api/samples`).then(async (response) => response.json() as Promise<{ samples: Array<{ id: string; narrative: string; filingDate: string }> }>);
    const listingSample = samples.samples.find((sample) => sample.id === "listing");
    const listing = await post(base, "/api/grade", listingSample);
    const listingSequential = listing.json.sequential as { outcome: string; decidedAtStep: number };
    const listingResult = listing.json.listing as { meets: boolean };
    expect(listing.status).toBe(200);
    expect(listingResult.meets).toBe(true);
    expect(listingSequential.outcome).toBe("disabled");
    expect(listingSequential.decidedAtStep).toBe(3);

    const borderline = await post(base, "/api/grade", {
      narrative: `I stopped working in 2018 and I have not worked since. I have a 9th grade education. The past work was full-time unskilled. ${SEDENTARY}`,
      filingDate: "2026-06-01",
      birthDate: "1976-08-15",
    });
    const borderlineVocational = borderline.json.vocational as { outcome: string; ruleId: string; borderline: { chronologicalRuleId: string } | null };
    expect(borderlineVocational.outcome).toBe("not-disabled");
    expect(borderlineVocational.borderline).not.toBeNull();
    expect(borderlineVocational.ruleId).toBe(borderlineVocational.borderline?.chronologicalRuleId);

    const blind = await post(base, "/api/grade", {
      narrative: "I am statutorily blind. I am 40 years old. I currently work and earn $4,000 a month.",
      program: "title-xvi",
      filingDate: "2026-06-01",
    });
    const blindSequential = blind.json.sequential as { outcome: string; decidedAtStep: number };
    expect(blindSequential.decidedAtStep === 1 && blindSequential.outcome === "not-disabled").toBe(false);
  }, 60_000);

  it("rejects a bad request and a rewrite that adds an MRI", async () => {
    const empty = await post(base, "/api/grade", {});
    expect(empty.status).toBe(400);
    const broken = await fetch(`${base}/api/grade`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect(broken.status).toBe(400);
    const compared = await post(base, "/api/compare", {
      narrative: "My back hurts and I stopped working in 2024.",
      revisedNarrative: "My back hurts and I stopped working in 2024. An MRI showed a herniation. I can lift 10 pounds.",
    });
    expect(compared.status).toBe(200);
    expect(compared.json.useTheRevision).toBe(false);
    expect(compared.json.novelNumbers).toContain("10");
    expect(compared.json.inventedClinicalMarkers).toContain("mri");
  });
});

describe("mcp stdio runtime", () => {
  const client = new Client({ name: "ssa-runtime-test", version: "1.0.0" });
  let transport: StdioClientTransport;
  let stderr = "";

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [tsx.pathname, "src/mcp.ts"],
      cwd: root.pathname,
      env: environment(),
      stderr: "pipe",
    });
    transport.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    await client.connect(transport);
  }, 60_000);

  afterAll(async () => {
    await transport.close();
  });

  it("speaks the protocol on stdout and keeps the ready line on stderr", async () => {
    expect(stderr).toContain("ssa-filing-bench listening on stdio");
    expect(stderr).not.toContain("filingStrength");
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([...TOOLS].sort());
    for (const tool of listed.tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
    }
  });

  it("grades a filing and returns the reflection trace", async () => {
    const grade = toolText(await client.callTool({
      name: "grade_filing",
      arguments: {
        narrative: "I am 57 years old. I currently work and earn $3,000 a month.",
        filingDate: "2026-06-01",
      },
    }));
    const sequential = grade.sequential as { outcome: string; decidedAtStep: number };
    const reflection = grade.reflection as { stoppedBecause: string };
    expect(sequential.outcome).toBe("not-disabled");
    expect(sequential.decidedAtStep).toBe(1);
    expect(grade.reliable).toBe(true);
    expect(reflection.stoppedBecause).toBe("clean");
    expect(String(grade.howToReadThis)).toContain("reflection.stoppedBecause");
  });

  it("calls every other tool, resource, and prompt", async () => {
    const guide = toolText(await client.callTool({ name: "how_to_use", arguments: {} }));
    expect(String(guide.guide)).toContain("LangGraph reflection graph");

    const weighed = toolText(await client.callTool({
      name: "weigh_sentences",
      arguments: { narrative: "I am 57 years old. I currently work and earn $3,000 a month." },
    }));
    expect(Array.isArray(weighed.sentences)).toBe(true);
    expect((weighed.sentences as unknown[]).length).toBeGreaterThan(0);

    const quoted = toolText(await client.callTool({ name: "quote_authority", arguments: { citation: "404.1520c" } }));
    expect(quoted.found).toBe(true);
    const missing = toolText(await client.callTool({ name: "quote_authority", arguments: { citation: "SSR 99-9p" } }));
    expect(missing.found).toBe(false);

    const search = toolText(await client.callTool({
      name: "search_authorities",
      arguments: { query: "substantial gainful activity", limit: 3 },
    }));
    expect((search.hits as unknown[]).length).toBeGreaterThan(0);

    const listing = toolText(await client.callTool({ name: "get_listing", arguments: { id: "12.04" } }));
    expect(listing.found).toBe(true);

    const sga = toolText(await client.callTool({ name: "get_sga_amount", arguments: { year: 2026, blind: false } }));
    expect(sga.amountUsed).toBe(1690);
    const borrowed = toolText(await client.callTool({ name: "get_sga_amount", arguments: { year: 1990, blind: false } }));
    expect(borrowed.found).toBe(false);

    const vocational = toolText(await client.callTool({
      name: "apply_vocational_rule",
      arguments: {
        age: 52,
        education: "limited",
        directEntry: null,
        experience: "unskilled",
        exertional: "sedentary",
        fullRange: true,
        nonexertionalErosion: false,
        veryLittleAdjustment: false,
      },
    }));
    const vocationalResult = vocational.result as { ruleId: string; outcome: string };
    expect(vocationalResult.ruleId).toBe("201.09");
    expect(vocationalResult.outcome).toBe("disabled");

    const rule = toolText(await client.callTool({ name: "get_grid_rule", arguments: { id: "201.09" } }));
    expect(rule.found).toBe(true);
    expect((rule.rule as { decision: string }).decision).toBe("disabled");

    const rules = toolText(await client.callTool({ name: "list_grid_rules", arguments: { exertional: "sedentary" } }));
    expect((rules.rules as Array<{ id: string }>).some((item) => item.id === "201.09")).toBe(true);

    const draft = toolText(await client.callTool({
      name: "draft_strongest_filing",
      arguments: { narrative: "I am 60 years old. I stopped working in 2024. My back hurts every day." },
    }));
    expect(String(draft.draft && (draft.draft as { reorganized: string }).reorganized).toLowerCase()).not.toContain("degenerative");

    const compared = toolText(await client.callTool({
      name: "compare_filings",
      arguments: {
        narrative: "My back hurts and I stopped working in 2024.",
        revisedNarrative: "My back hurts and I stopped working in 2024. An MRI showed a herniation. I can lift 10 pounds.",
      },
    }));
    expect(compared.useTheRevision).toBe(false);

    const flagged = toolText(await client.callTool({
      name: "flag_invented_facts",
      arguments: {
        original: "My back hurts and I stopped working in 2024.",
        revised: "My back hurts and I stopped working in 2024. An MRI showed a herniation.",
      },
    }));
    expect(flagged.clean).toBe(false);
    expect(flagged.inventedClinicalMarkers).toContain("mri");

    const authorities = toolText(await client.callTool({ name: "list_authorities", arguments: {} }));
    expect(authorities.sectionCount).toBe(58);
    expect(authorities.listingCount).toBe(266);
    expect(authorities.gridRuleCount).toBe(82);

    const selfTest = toolText(await client.callTool({ name: "self_test", arguments: {} }));
    expect(selfTest.passed).toBe(true);
    expect(selfTest.failures).toEqual([]);

    const guideResource = await client.readResource({ uri: "ssa://guide" });
    expect(resourceText(guideResource)).toContain("filingStrength");
    const notice = await client.readResource({ uri: "ssa://notice" });
    expect(resourceText(notice)).toContain("does not grade a filing from 1 to 100");
    const section = await client.readResource({ uri: "ssa://section/404.1520c" });
    expect(resourceText(section)).toContain("404.1520c");
    const listingResource = await client.readResource({ uri: "ssa://listing/12.04" });
    expect(resourceText(listingResource)).toContain("12.04");

    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name).sort()).toEqual(["explain-rule", "review-filing", "strengthen-filing"]);
    const review = await client.getPrompt({ name: "review-filing", arguments: { narrative: "I stopped working in 2024." } });
    expect(review.messages[0]?.content).toMatchObject({ type: "text" });
    const explain = await client.getPrompt({ name: "explain-rule", arguments: { citation: "404.1520" } });
    const explainText = explain.messages[0]?.content;
    expect(explainText && "text" in explainText ? explainText.text : "").toContain("404.1520");
  }, 90_000);
});
