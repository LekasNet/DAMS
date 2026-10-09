import { Document, Expr, Member } from "./ast";

/** True only for a final DAMS tree that needs no resolver, evaluator, or annotation. */
export function isBakedDocument(document: Document): boolean {
  const isFinalExpression = (expression: Expr): boolean => {
    if (expression.kind === "literal") return true;
    if (expression.kind === "array")
      return expression.items.every(isFinalExpression);
    if (expression.kind === "object")
      return expression.members.every(isFinalMember);
    return false;
  };
  const isFinalMember = (member: Member): boolean =>
    member.annotation === undefined && isFinalExpression(member.expression);
  return document.members.every(isFinalMember);
}
