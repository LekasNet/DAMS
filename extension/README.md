# DAMS for Visual Studio Code

Language support for DAMS v0.3: deterministic data expressions that can be validated and baked into a final, standalone document.

## Features

- Syntax highlighting for `.dams` files.
- Live diagnostics in the editor: syntax, type conversion, duplicate keys, invalid composition, division by zero and cyclic dependencies.
- Inlay hints for inferred types and computed scalar values in Raw documents.
- Completion, Go to Definition, Rename and Document Symbols, including string-key paths such as `Map["Key"].Field`.
- **Preview Baked Result** that updates after each successful evaluation and keeps the last valid output while editing an invalid expression.
- **Bake Current File** to save a standalone `.baked.dams` file.
- Interactive 3D dependency graph with click-to-navigate nodes.

## Editor actions

When an original `.dams` file is active, the editor title bar provides:

- Preview Baked Result
- Bake Current File
- Show Dependency Graph

The same actions are available through the Command Palette under `DAMS:`.

## Raw and Baked documents

A document is **Raw** while it contains annotations, references or expressions. A document with only final literals and collections is **Baked**. Baked files avoid editor-only type and computed-value hints.

## File icon

DAMS contributes a default language icon for `.dams` files. Its display depends on the selected VS Code file icon theme: a theme may override language or extension icons. The extension icon is included for the Extensions view and Marketplace.
