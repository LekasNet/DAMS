# DAMS for VS Code

Extension and independent TypeScript core for DAMS v0.3. The core uses its own lexer, parser, AST, lazy resolver, evaluator and serializer; it does not depend on VS Code, `eval`, or `JSON.parse`.

## Development

Run `npm install`, `npm test`, then `npm run build`. Open this folder in VS Code and choose **Run DAMS Extension** in Run and Debug (`F5`). The included configuration builds the extension, launches an Extension Development Host, and opens `examples/requests.dams`. `.dams` files receive TextMate syntax highlighting. Commands: **DAMS: Bake Current File**, **Preview Baked Result**, and **Validate Current File**.

To verify diagnostics, open `examples/invalid.dams` in the development window. It deliberately includes division by zero; an error must appear in the editor and in **Problems**. Commands write a detailed trace to **Output → DAMS** and show a confirmation/error notification.

The Baker never alters the source and writes `<name>.baked.dams` only after a diagnostic-free evaluation.

## v0.3 boundaries

The implementation reports diagnostics instead of guessing for explicitly open parts of the draft: string indexing, unsupported conversion categories, and invalid scalar composition. Mixed integral arithmetic retains the left operand's representation; this is the proposal noted as open in the specification and is isolated in `packages/core/src/evaluator.ts`.
