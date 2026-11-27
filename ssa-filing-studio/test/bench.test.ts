import { describe, expect, it } from "vitest";
import { compareFilings, quoteForModel, sgaForModel, vocationalForModel } from "../src/bench-api.js";
import { quoteAuthority } from "../src/corpus.js";
import { gradeFiling } from "../src/grade.js";
import { readFacts } from "../src/facts.js";
import { createMcpServer } from "../src/mcp.js";
import { runSelfTest } from "../src/selftest.js";
import { joinSentences, splitSentences } from "../src/sentences.js";

describe("sentence ledger", () => {
  it("keeps every character, including Dr. and listing numbers", () => {
    const text = "Dr. Cho discussed listing 12.04. She stopped.\n\nNext sentence!";
    expect(joinSentences(splitSentences(text))).toBe(text);
  });
});

describe("regulation corpus", () => {
  it("quotes the supportability sentence from the regulation, not a paraphrase", () => {
    const quote = quoteAuthority("20 CFR 404.1520c");
    expect(quote?.paragraphs.join("\n")).toContain("The more relevant the objective medical evidence and supporting explanations");
  });
});

describe("bench", () => {
  it("passes the regulatory self-test", () => {
    const result = runSelfTest();
    expect(result.failures, result.failures.map((failure) => `${failure.name}: ${failure.detail}`).join("\n")).toEqual([]);
  });

  it("does not treat a bare exertional label as a grid fact", () => {
    const report = gradeFiling({
      narrative: "I am 57. I stopped working in 2019. Dr. Lee opined that I am limited to sedentary work.",
      filingDate: "2026-01-15",
    });
    expect(report.vocational.directed).toBe(false);
    expect(report.sequential.outcome).not.toBe("disabled");
  });
});

describe("determination-date controls", () => {
  it("uses the adjudication date rather than the filing date for age and past-work timing", () => {
    const { facts } = readFacts({
      narrative: "I was born on January 1, 1980.",
      filingDate: "2025-01-01",
      determinationDate: "2026-01-01",
      birthDate: "1980-01-01",
    });
    expect(facts.referenceDate).toBe("2026-01-01");
    expect(facts.age).toBe(46);
  });
});

describe("full-record provenance boundaries", () => {
  it("does not leak a medical source attribution into a later lay-witness document", () => {
    const { facts } = readFacts({
      narrative: [
        "DOCUMENT 1",
        "Source: Paula Hays | Role: APN-C",
        "SOURCE PAGE 7 | Original label: 7",
        "She opined that I cannot concentrate for more than 10 minutes.",
        "DOCUMENT 2",
        "Source: Elaine Summers | Role: mother",
        "SOURCE PAGE 3 | Original label: 3",
        "She observed that I avoid stores because I panic.",
      ].join("\n"),
    });
    const opinion = facts.sentences.find((sentence) => sentence.text.startsWith("She opined"));
    const witness = facts.sentences.find((sentence) => sentence.text.startsWith("She observed"));
    expect(opinion?.category).toBe("medical-opinion");
    expect(opinion?.sourceName).toContain("Paula Hays");
    expect(witness?.category).toBe("nonmedical");
    expect(witness?.sourceName).toBeNull();
    expect(opinion?.provenance).toEqual({ documentId: "1", pageNumber: 7, sourceName: "Paula Hays", sourceRole: "APN-C" });
    expect(witness?.provenance).toEqual({ documentId: "2", pageNumber: 3, sourceName: "Elaine Summers", sourceRole: "mother" });
    expect(facts.sentences.filter((sentence) => sentence.citation === "record-metadata").length).toBeGreaterThan(0);
  });
});

describe("tools an LLM calls", () => {
  it("registers the bench as an MCP server", () => {
    const server = createMcpServer();
    expect(server).toBeTruthy();
  });

  it("quotes supportability and the 2026 non-blind SGA amount", () => {
    expect(quoteForModel("404.1520c").found).toBe(true);
    const sga = sgaForModel(2026, false);
    expect(sga.found).toBe(true);
    if (sga.found) expect(sga.amountUsed).toBe(1690);
  });

  it("rejects a rewrite that adds an MRI and a new measurement", () => {
    const compared = compareFilings(
      { narrative: "My back hurts and I stopped working in 2024." },
      "My back hurts and I stopped working in 2024. An MRI showed a herniation. I can lift 10 pounds.",
    );
    expect(compared.useTheRevision).toBe(false);
    expect(compared.novelNumbers).toContain("10");
    expect(compared.inventedClinicalMarkers).toContain("mri");
  });

  it("directs rule 201.09 only for the established sedentary profile", () => {
    const result = vocationalForModel({
      age: 52,
      education: "limited",
      directEntry: null,
      experience: "unskilled",
      exertional: "sedentary",
      fullRange: true,
      nonexertionalErosion: false,
      veryLittleAdjustment: false,
    });
    expect(result.result.ruleId).toBe("201.09");
    expect(result.result.outcome).toBe("disabled");
  });
});
