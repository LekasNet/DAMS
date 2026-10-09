import { Diagnostic, Document, Expr, Member, Position, Range } from "./ast";
import { lex, Token, TokenKind } from "./lexer";
const join = (a: Range, b: Range): Range => ({ start: a.start, end: b.end });
export function parse(
  source: string,
  origin?: Position,
): { document: Document; diagnostics: Diagnostic[] } {
  const l = lex(source, origin),
    p = new Parser(l.tokens, l.diagnostics);
  const document = p.document();
  return { document, diagnostics: p.diagnostics };
}
class Parser {
  private i = 0;
  constructor(
    private tokens: Token[],
    public diagnostics: Diagnostic[],
  ) {}
  private get t() {
    return this.tokens[this.i]!;
  }
  private take() {
    return this.tokens[this.i++]!;
  }
  private is(k: TokenKind) {
    return this.t.kind === k;
  }
  private eat(k: TokenKind) {
    if (this.is(k)) return this.take();
    return undefined;
  }
  private err(message: string, range = this.t.range) {
    this.diagnostics.push({ message, range, severity: "error" });
  }
  private skipSeps() {
    while (this.is("newline") || this.is(",")) this.take();
  }
  document(): Document {
    const start = this.t.range.start;
    const members: Member[] = [];
    this.skipSeps();
    while (!this.is("eof")) {
      const m = this.member();
      if (m) members.push(m);
      else this.recover();
      this.skipSeps();
    }
    return {
      kind: "document",
      members,
      range: { start, end: this.t.range.end },
    };
  }
  private recover() {
    this.err("Expected declaration");
    while (
      !this.is("eof") &&
      !this.is("newline") &&
      !this.is(",") &&
      !this.is("}")
    )
      this.take();
  }
  private member(): Member | undefined {
    if (!this.is("id") && !this.is("string")) return;
    const keyToken = this.take();
    const key = {
      text: keyToken.text,
      quoted: keyToken.kind === "string",
      range: keyToken.range,
    };
    let annotation: string | undefined, annotationRange: Range | undefined;
    if (this.eat("(")) {
      if (!this.is("id")) this.err("Expected annotation name");
      else {
        const token = this.take();
        annotation = token.text;
        annotationRange = token.range;
      }
      if (!this.eat(")")) this.err("Expected ')' after annotation");
    }
    if (!this.eat(":")) {
      this.err("Expected ':' after key");
      return;
    }
    while (this.eat("newline")) {}
    const expression = this.expr();
    return {
      key,
      annotation,
      annotationRange,
      expression,
      range: join(keyToken.range, expression.range),
    };
  }
  private expr(): Expr {
    return this.additive();
  }
  private additive(): Expr {
    let e = this.multiply();
    while (this.is("+") || this.is("-")) {
      const op = this.take();
      while (this.eat("newline")) {}
      const r = this.multiply();
      e = {
        kind: "binary",
        op: op.kind as "+" | "-",
        left: e,
        right: r,
        range: join(e.range, r.range),
      };
    }
    return e;
  }
  private multiply(): Expr {
    let e = this.concat();
    while (this.is("*") || this.is("/")) {
      const op = this.take();
      while (this.eat("newline")) {}
      const r = this.concat();
      e = {
        kind: "binary",
        op: op.kind as "*" | "/",
        left: e,
        right: r,
        range: join(e.range, r.range),
      };
    }
    return e;
  }
  private concat(): Expr {
    let e = this.unary();
    while (this.is("&")) {
      this.take();
      while (this.eat("newline")) {}
      const r = this.unary();
      e = {
        kind: "binary",
        op: "&",
        left: e,
        right: r,
        range: join(e.range, r.range),
      };
    }
    return e;
  }
  private unary(): Expr {
    if (this.is("+") || this.is("-")) {
      const t = this.take(),
        e = this.unary();
      return {
        kind: "unary",
        op: t.kind as "+" | "-",
        expression: e,
        range: join(t.range, e.range),
      };
    }
    return this.postfix(this.primary());
  }
  private postfix(base: Expr): Expr {
    let e = base;
    while (true) {
      if (this.eat("[")) {
        let first = this.expr();
        if (this.eat(":")) {
          const end = this.expr();
          const close = this.eat("]");
          if (!close) this.err("Expected ']' after slice");
          e = {
            kind: "index",
            target: e,
            slice: { start: first, end },
            range: { start: e.range.start, end: (close ?? end).range.end },
          };
        } else {
          const close = this.eat("]");
          if (!close) this.err("Expected ']' after index");
          e = {
            kind: "index",
            target: e,
            index: first,
            range: { start: e.range.start, end: (close ?? first).range.end },
          };
        }
        continue;
      }
      if (this.eat(".")) {
        if (!this.is("id")) {
          this.err("Expected path segment after .");
          break;
        }
        const key = this.take();
        e = {
          kind: "access",
          target: e,
          key: key.text,
          keyRange: key.range,
          range: { start: e.range.start, end: key.range.end },
        };
        continue;
      }
      break;
    }
    return e;
  }
  private primary(): Expr {
    const t = this.t;
    if (this.eat("{")) return this.object(t.range);
    if (this.eat("[")) return this.array(t.range);
    if (this.eat("(")) {
      const e = this.expr();
      const close = this.eat(")");
      if (!close) this.err("Expected ')'");
      return {
        ...e,
        range: { start: t.range.start, end: (close ?? e).range.end },
      };
    }
    if (this.is("number")) {
      this.take();
      const lower = t.text.toLowerCase();
      const repr = lower.startsWith("0x")
        ? "hex"
        : lower.startsWith("0b")
          ? "bin"
          : lower.startsWith("0o")
            ? "oct"
            : t.text.includes(".")
              ? "float"
              : "int";
      return {
        kind: "literal",
        value: repr === "float" ? t.text : BigInt(t.text),
        raw: t.text,
        representation: repr,
        range: t.range,
      } as Expr;
    }
    if (this.is("string")) {
      this.take();
      return {
        kind: "literal",
        value: t.text,
        representation: "string",
        range: t.range,
      };
    }
    if (this.is("id")) {
      this.take();
      if (t.text === "true" || t.text === "false")
        return {
          kind: "literal",
          value: t.text === "true",
          representation: "bool",
          range: t.range,
        };
      if (t.text === "null")
        return {
          kind: "literal",
          value: null,
          representation: "null",
          range: t.range,
        };
      if (t.text === "undefined")
        return {
          kind: "literal",
          value: undefined,
          representation: "undefined",
          range: t.range,
        };
      return this.reference(t, false);
    }
    if (this.eat(".")) {
      if (!this.is("id")) {
        this.err("Expected field name after .");
        return {
          kind: "literal",
          value: undefined,
          representation: "undefined",
          range: t.range,
        };
      }
      return this.reference(this.take(), true);
    }
    this.err("Expected expression");
    if (!this.is("eof")) this.take();
    return {
      kind: "literal",
      value: undefined,
      representation: "undefined",
      range: t.range,
    };
  }
  private reference(first: Token, relative: boolean): Expr {
    const parts: (string | { key: string })[] = [first.text];
    let last = first.range;
    while (this.eat(".")) {
      if (!this.is("id")) {
        this.err("Expected path segment");
        break;
      }
      const x = this.take();
      parts.push(x.text);
      last = x.range;
    }
    return {
      kind: "reference",
      relative,
      parts,
      range: relative
        ? {
            start: {
              ...first.range.start,
              column: first.range.start.column - 1,
              offset: first.range.start.offset - 1,
            },
            end: last.end,
          }
        : join(first.range, last),
    };
  }
  private object(start: Range): Expr {
    const members: Member[] = [];
    this.skipSeps();
    while (!this.is("}") && !this.is("eof")) {
      const m = this.member();
      if (m) members.push(m);
      else this.recover();
      if (
        !this.is("}") &&
        !this.is("eof") &&
        !this.is("newline") &&
        !this.is(",")
      )
        this.err("Expected separator between fields");
      this.skipSeps();
    }
    const end = this.eat("}") ?? this.t;
    return {
      kind: "object",
      members,
      range: { start: start.start, end: end.range.end },
    };
  }
  private array(start: Range): Expr {
    const items: Expr[] = [];
    this.skipSeps();
    while (!this.is("]") && !this.is("eof")) {
      items.push(this.expr());
      if (
        !this.is("]") &&
        !this.is("eof") &&
        !this.is("newline") &&
        !this.is(",")
      )
        this.err("Expected separator between array items");
      this.skipSeps();
    }
    const end = this.eat("]") ?? this.t;
    return {
      kind: "array",
      items,
      range: { start: start.start, end: end.range.end },
    };
  }
}
