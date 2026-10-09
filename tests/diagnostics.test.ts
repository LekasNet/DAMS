import { describe, expect, it } from "vitest";
import { bake } from "../packages/core/src/index";

describe("DAMS v0.3 diagnostics", () => {
  it("uses an annotation as the target representation for scalar composition", () => {
    const result = bake('C (hex): 10 & 0x22\nD (str): 0x22 & "F190"');
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain("C: 0x0A22");
    expect(result.text).toContain('D: "22F190"');
  });
  it("marks an indirect cycle at the reference that closes it", () => {
    const source = "Data: { A: .B\nB: .C\nC: .A }";
    const cycle = bake(source).diagnostics.find(
      (d) => d.message === "Cyclic dependency",
    );
    expect(cycle?.range.start.offset).toBe(source.lastIndexOf(".A"));
  });
  it("reports duplicate fields and invalid narrowing at exact tokens", () => {
    const source = "Value (int): 3.5\nObject: { A: 1\nA: 2 }";
    const result = bake(source);
    expect(result.diagnostics.map((d) => d.message)).toEqual(
      expect.arrayContaining(["Cannot convert to int", "Duplicate key 'A'"]),
    );
    expect(
      result.diagnostics.find((d) => d.message === "Cannot convert to int")
        ?.range.start.offset,
    ).toBe(source.indexOf("int"));
    expect(
      result.diagnostics.find((d) => d.message === "Duplicate key 'A'")?.range
        .start.offset,
    ).toBe(source.lastIndexOf("A:"));
  });
});
