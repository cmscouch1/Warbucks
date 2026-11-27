import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareFilings, gradeForModel, listingForModel, quoteForModel, runBenchSelfTest, sgaForModel } from "./bench-api.js";
import type { FilingInput } from "./types.js";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const selfTest = runBenchSelfTest();

const SAMPLES = [
  {
    id: "working",
    label: "Working over SGA",
    narrative: "I am 57 years old. I currently work and earn $3,000 a month.",
    filingDate: "2026-06-01",
  },
  {
    id: "symptoms",
    label: "Symptoms only",
    narrative: "I am 60 years old. I stopped working in 2024. My back hurts every day and I cannot sit. I have a 10th grade education.",
    filingDate: "2026-06-01",
  },
  {
    id: "listing",
    label: "Listing 12.04 file",
    narrative: `I am 42 years old. I stopped working on March 1, 2023, and I have not worked since. I have a high school education. My past work was an unskilled warehouse job from 2016 to 2023.
Dr. Elena Cho, a board-certified psychiatrist who has treated me monthly since 2019, examined me. On mental status examination she observed depressed mood, diminished interest in almost all activities, appetite disturbance with change in weight, sleep disturbance, observable psychomotor retardation, decreased energy, feelings of guilt and worthlessness, difficulty concentrating or thinking, and thoughts of death. She explained that these findings have persisted for two years and are the objective signs of depression.
She opined that I have a marked limitation in interacting with others and a marked limitation in concentrating, persisting, or maintaining pace, because those examination findings support the limits.
The listing is 12.04. I shop only with help. The symptom is constant. It is worse when I am around people. I take sertraline 100 mg and it causes nausea. I attend therapy. I lie down when it peaks. Because of the symptoms I cannot finish a task. In an eight-hour workday these limits apply.`,
    filingDate: "2026-06-01",
  },
];

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function send(response: ServerResponse, status: number, body: unknown, type = "application/json; charset=utf-8"): void {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  response.end(payload);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("The filing is larger than 1 MB.");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The body must be a JSON object.");
  return parsed as Record<string, unknown>;
}

function filingFrom(body: Record<string, unknown>): FilingInput {
  if (typeof body.narrative !== "string" || body.narrative.trim() === "") throw new Error("A narrative is required.");
  const input: FilingInput = { narrative: body.narrative };
  if (body.program === "title-ii" || body.program === "title-xvi") input.program = body.program;
  if (typeof body.filingDate === "string") input.filingDate = body.filingDate;
  if (typeof body.birthDate === "string") input.birthDate = body.birthDate;
  if (typeof body.onsetDate === "string") input.onsetDate = body.onsetDate;
  if (typeof body.age === "number") input.age = body.age;
  if (body.education === "illiterate" || body.education === "marginal" || body.education === "limited" || body.education === "high-school-or-more") {
    input.education = body.education;
  }
  if (typeof body.directEntryToSkilledWork === "boolean") input.directEntryToSkilledWork = body.directEntryToSkilledWork;
  if (typeof body.monthlyEarnings === "number") input.monthlyEarnings = body.monthlyEarnings;
  if (typeof body.earningsYear === "number") input.earningsYear = body.earningsYear;
  if (body.statutoryBlindness === true) input.statutoryBlindness = true;
  if (body.selfEmployed === true) input.selfEmployed = true;
  return input;
}

export function createApp() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/api/self-test") {
        send(response, selfTest.passed ? 200 : 503, selfTest);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/samples") {
        send(response, 200, { samples: SAMPLES });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/authority") {
        send(response, 200, quoteForModel(url.searchParams.get("citation") ?? ""));
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/listing") {
        send(response, 200, listingForModel(url.searchParams.get("id") ?? ""));
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/sga") {
        const year = Number(url.searchParams.get("year"));
        const blind = url.searchParams.get("blind") === "true";
        send(response, 200, sgaForModel(year, blind));
        return;
      }
      if (request.method === "POST" && (url.pathname === "/api/grade" || url.pathname === "/api/compare")) {
        if (!selfTest.passed) {
          send(response, 503, { reliable: false, message: "The bench failed its own regulatory self-test. No grade is returned.", failures: selfTest.failures });
          return;
        }
        const body = await readJson(request);
        if (url.pathname === "/api/compare") {
          if (typeof body.revisedNarrative !== "string") throw new Error("A revised narrative is required.");
          send(response, 200, compareFilings(filingFrom(body), body.revisedNarrative));
          return;
        }
        send(response, 200, gradeForModel(filingFrom(body)));
        return;
      }
      if (request.method === "GET") {
        const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
        if (requested.includes("..") || requested.includes("\0")) {
          send(response, 404, { message: "Not found." });
          return;
        }
        const path = join(webRoot, requested);
        const file = await readFile(path);
        send(response, 200, file, TYPES[extname(path)] ?? "application/octet-stream");
        return;
      }
      send(response, 404, { message: "Not found." });
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      if (code === "ENOENT") {
        send(response, 404, { message: "Not found." });
        return;
      }
      const message = error instanceof Error ? error.message : "The request failed.";
      const status = message.includes("JSON") || message.includes("narrative") || message.includes("revised") ? 400 : 500;
      send(response, status, { message });
    }
  });
}

const entry = process.argv[1] ? resolve(process.argv[1]) : "";
if (entry && fileURLToPath(import.meta.url) === entry) {
  const port = Number(process.env.PORT ?? 8787);
  createApp().listen(port, () => {
    process.stderr.write(`SSA Filing Bench at http://localhost:${port}\n`);
    if (!selfTest.passed) process.stderr.write("Self-test failed. Grades are refused.\n");
  });
}
