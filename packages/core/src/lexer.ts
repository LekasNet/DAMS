import { Diagnostic, Position, Range } from "./ast";
export type TokenKind =
  | "id"
  | "string"
  | "number"
  | "newline"
  | "eof"
  | "{"
  | "}"
  | "["
  | "]"
  | "("
  | ")"
  | ":"
  | ","
  | "."
  | "+"
  | "-"
  | "*"
  | "/"
  | "&";
export interface Token {
  kind: TokenKind;
  text: string;
  range: Range;
}
const pos = (offset: number, line: number, column: number): Position => ({
  offset,
  line,
  column,
});
export function lex(
  source: string,
  origin: Position = { offset: 0, line: 0, column: 0 },
): { tokens: Token[]; diagnostics: Diagnostic[] } {
  const tokens: Token[] = [],
    diagnostics: Diagnostic[] = [];
  let i = 0,
    line = origin.line,
    column = origin.column;
  const at = () => pos(origin.offset + i, line, column);
  const advance = () => {
    const c = source[i++]!;
    if (c === "\n") {
      line++;
      column = 0;
    } else column++;
    return c;
  };
  const emit = (kind: TokenKind, text: string, start: Position) =>
    tokens.push({ kind, text, range: { start, end: at() } });
  while (i < source.length) {
    const c = source[i]!;
    if (c === " " || c === "\t" || c === "\r") {
      advance();
      continue;
    }
    if (c === "\n") {
      const s = at();
      advance();
      emit("newline", "\n", s);
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") advance();
      continue;
    }
    const s = at();
    if ("{}[]():,.+-*/&".includes(c)) {
      advance();
      emit(c as TokenKind, c, s);
      continue;
    }
    if (c === '"') {
      advance();
      let value = "";
      let closed = false;
      while (i < source.length) {
        const x = advance();
        if (x === '"') {
          closed = true;
          break;
        }
        if (x === "\n") {
          break;
        }
        if (x === "\\" && i < source.length) {
          const n = source[i]!;
          if (n === '"' || n === "\\") {
            advance();
            value += n;
          } else value += "\\";
        } else value += x;
      }
      if (!closed)
        diagnostics.push({
          message: "Unterminated string",
          range: { start: s, end: at() },
          severity: "error",
        });
      emit("string", value, s);
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let t = "";
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i]!))
        t += advance();
      emit("id", t, s);
      continue;
    }
    if (/[0-9]/.test(c)) {
      let t = "";
      if (c === "0" && /[xXbBoO]/.test(source[i + 1] ?? "")) {
        t += advance() + advance();
        const base =
          t[1]!.toLowerCase() === "x"
            ? "[0-9A-Fa-f]"
            : t[1]!.toLowerCase() === "b"
              ? "[01]"
              : "[0-7]";
        const re = new RegExp(base);
        while (i < source.length && re.test(source[i]!)) t += advance();
      } else {
        while (i < source.length && /[0-9]/.test(source[i]!)) t += advance();
        if (source[i] === "." && /[0-9]/.test(source[i + 1] ?? "")) {
          t += advance();
          while (i < source.length && /[0-9]/.test(source[i]!)) t += advance();
        }
      }
      emit("number", t, s);
      continue;
    }
    advance();
    diagnostics.push({
      message: `Unexpected character ${c}`,
      range: { start: s, end: at() },
      severity: "error",
    });
  }
  const e = at();
  tokens.push({ kind: "eof", text: "", range: { start: e, end: e } });
  return { tokens, diagnostics };
}
