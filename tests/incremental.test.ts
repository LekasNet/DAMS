import { describe, expect, it } from "vitest";
import { IncrementalAnalyzer } from "../packages/core/src/index";

describe("incremental DAMS analysis", () => {
  it("reparses only a changed root declaration and reuses shifted suffix declarations", () => {
    const analyzer = new IncrementalAnalyzer();
    analyzer.analyze("A: 1\nB: 2\nC: { Value: 3 }");
    const next = analyzer.analyze("A: 100\nB: 2\nC: { Value: 3 }");
    expect(next.parsedFragments).toBe(1);
    expect(next.reusedFragments).toBe(2);
    expect(next.diagnostics).toEqual([]);
    expect(next.evaluator.formatValue(next.value)).toBe("object");
  });
  it("invalidates every transitive consumer of a changed field", () => {
    const analyzer = new IncrementalAnalyzer();
    analyzer.analyze("A: 1\nB: A + 1\nC: B + 1\nStable: 42");
    const next = analyzer.analyze("A: 5\nB: A + 1\nC: B + 1\nStable: 42");
    const c = next.document.members.find((member) => member.key.text === "C")!;
    expect(next.evaluator.formatValue(next.evaluator.getMemberValue(c)!)).toBe(
      "7",
    );
    expect(next.invalidatedFields).toBe(3);
  });
});
