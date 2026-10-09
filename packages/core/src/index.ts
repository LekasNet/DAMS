import { parse } from "./parser";
import { Evaluator, Value } from "./evaluator";
import { serializeDocument } from "./serializer";
import { Diagnostic } from "./ast";
export * from "./ast";
export type { Value } from "./evaluator";
export { parse } from "./parser";
export { IncrementalAnalyzer } from "./incremental";
export { dependencyEdges } from "./incremental";
export type { IncrementalAnalysis, DependencyEdge } from "./incremental";
export { isBakedDocument } from "./baked";
export function analyze(source: string): {
  document: import("./ast").Document;
  value: Value;
  diagnostics: Diagnostic[];
  evaluator: Evaluator;
} {
  const p = parse(source);
  const evaluator = new Evaluator(p.document);
  const value = evaluator.evaluate();
  return {
    document: p.document,
    value,
    diagnostics: [...p.diagnostics, ...evaluator.diagnostics],
    evaluator,
  };
}
export function bake(source: string): {
  text?: string;
  diagnostics: Diagnostic[];
} {
  const a = analyze(source);
  if (a.diagnostics.some((d) => d.severity === "error"))
    return { diagnostics: a.diagnostics };
  try {
    return {
      text: serializeDocument(a.value, a.evaluator),
      diagnostics: a.diagnostics,
    };
  } catch (e) {
    return {
      diagnostics: [
        ...a.diagnostics,
        {
          message: e instanceof Error ? e.message : String(e),
          range: {
            start: { offset: 0, line: 0, column: 0 },
            end: { offset: 0, line: 0, column: 0 },
          },
          severity: "error",
        },
      ],
    };
  }
}
