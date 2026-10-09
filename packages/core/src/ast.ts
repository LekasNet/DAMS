export interface Position { offset: number; line: number; column: number }
export interface Range { start: Position; end: Position }
export interface Diagnostic { message: string; range: Range; severity: 'error' | 'warning' }
export type Key = { text: string; quoted: boolean; range: Range };
export interface Document { kind: 'document'; members: Member[]; range: Range }
export interface Member { key: Key; annotation?: string; annotationRange?: Range; expression: Expr; range: Range }
export type Expr = LiteralExpr | ObjectExpr | ArrayExpr | ReferenceExpr | BinaryExpr | UnaryExpr | IndexExpr | MemberAccessExpr;
export interface Base { range: Range }
export interface LiteralExpr extends Base { kind: 'literal'; value: string | bigint | boolean | null | undefined; raw?: string; representation: 'string'|'int'|'float'|'hex'|'bin'|'oct'|'bool'|'null'|'undefined' }
export interface ObjectExpr extends Base { kind: 'object'; members: Member[] }
export interface ArrayExpr extends Base { kind: 'array'; items: Expr[] }
export interface ReferenceExpr extends Base { kind: 'reference'; relative: boolean; parts: (string | { key: string })[] }
export interface BinaryExpr extends Base { kind: 'binary'; op: '+'|'-'|'*'|'/'|'&'; left: Expr; right: Expr }
export interface UnaryExpr extends Base { kind: 'unary'; op: '+'|'-'; expression: Expr }
export interface IndexExpr extends Base { kind: 'index'; target: Expr; index?: Expr; slice?: { start: Expr; end: Expr } }
export interface MemberAccessExpr extends Base { kind: 'access'; target: Expr; key: string; keyRange: Range }
