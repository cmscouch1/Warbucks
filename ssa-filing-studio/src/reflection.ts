import { randomUUID } from "node:crypto";
import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { gradeOnce } from "./grade.js";
import type { FilingInput, GradeReport, ReflectionTrace } from "./types.js";

/**
 * The graph in langchain-ai/langgraphjs examples/reflection/reflection.ipynb:
 * START -> generate -> (reflect -> generate) until a check says stop, or 3 iterations.
 * Reflect may only turn semicolon runs into sentences. It cannot change words or the legal result.
 */
export const REFLECTION_ITERATION_LIMIT = 3;

const State = Annotation.Root({
  input: Annotation<FilingInput>(),
  narrative: Annotation<string>(),
  report: Annotation<Omit<GradeReport, "reflection"> | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  iterations: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  healed: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),
});

export function semicolonHeal(narrative: string): string | null {
  if (narrative.includes(".") || !narrative.includes(";")) return null;
  const next = narrative.replace(/;\s+/g, ".\n");
  return next === narrative ? null : next;
}

export function punctuationOnly(before: string, after: string): boolean {
  const fold = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return fold(before) === fold(after);
}

export function reflectionRoute(state: { iterations: number; healed: boolean; narrative: string; reliable: boolean }): "reflect" | typeof END {
  if (state.iterations >= REFLECTION_ITERATION_LIMIT) return END;
  if (state.reliable) return END;
  if (state.healed) return END;
  const next = semicolonHeal(state.narrative);
  if (next && punctuationOnly(state.narrative, next)) return "reflect";
  return END;
}

const generate = (state: typeof State.State) => {
  const report = gradeOnce({ ...state.input, narrative: state.narrative });
  return { report, iterations: state.iterations + 1 };
};

const reflect = (state: typeof State.State) => {
  const next = semicolonHeal(state.narrative);
  if (!next || !punctuationOnly(state.narrative, next)) return { healed: true };
  return { narrative: next, healed: true };
};

const shouldContinue = (state: typeof State.State) => reflectionRoute({
  iterations: state.iterations,
  healed: state.healed,
  narrative: state.narrative,
  reliable: state.report?.reliable ?? false,
});

const checkpointer = new MemorySaver();
const app = new StateGraph(State)
  .addNode("generate", generate)
  .addNode("reflect", reflect)
  .addEdge(START, "generate")
  .addConditionalEdges("generate", shouldContinue)
  .addEdge("reflect", "generate")
  .compile({ checkpointer });

export async function gradeFiling(input: FilingInput): Promise<GradeReport> {
  const narrative = input.narrative ?? "";
  const threadId = randomUUID();
  try {
    const final = await app.invoke(
      { input: { ...input, narrative }, narrative, report: null, iterations: 0, healed: false },
      { configurable: { thread_id: threadId } },
    );
    if (!final.report) throw new Error("The reflection graph ended without a grade.");
    const changed = final.narrative !== narrative;
    const audit = changed
      ? {
          ...final.report.audit,
          healed: true,
          healNotes: [...final.report.audit.healNotes, "The filing had no sentence breaks. The reflect node split it on semicolons and generate ran again."],
        }
      : final.report.audit;
    const reliable = audit.ok;
    const stoppedBecause: ReflectionTrace["stoppedBecause"] = reliable
      ? "clean"
      : final.iterations >= REFLECTION_ITERATION_LIMIT
        ? "iteration-limit"
        : "guardrail";
    const nodes: ReflectionTrace["nodes"] = changed ? ["generate", "reflect", "generate"] : ["generate"];
    return {
      ...final.report,
      reliable,
      audit,
      reflection: {
        nodes,
        iterations: final.iterations,
        stoppedBecause,
        checkpointer: "MemorySaver",
      },
    };
  } finally {
    await checkpointer.deleteThread(threadId);
  }
}
