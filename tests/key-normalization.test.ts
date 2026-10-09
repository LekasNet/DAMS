import { describe, expect, it } from "vitest";
import { normalizeObjectKey } from "../extension/src/key-normalization";
describe("string-key Quick Fix", () => {
  it("follows DAMS v0.3 casing rules", () => {
    expect(normalizeObjectKey("Full Name")).toBe("FullName");
    expect(normalizeObjectKey("First name")).toBe("First_name");
    expect(normalizeObjectKey("XML Database")).toBe("XML_Database");
    expect(normalizeObjectKey("Read DID")).toBe("ReadDID");
    expect(normalizeObjectKey("Vehicle speed")).toBe("Vehicle_speed");
    expect(
      normalizeObjectKey("Drop XML Database direction Forever Young"),
    ).toBe("DropXML_Database_directionForeverYoung");
  });
});
