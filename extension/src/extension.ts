import * as vscode from "vscode";
import {
  analyze,
  bake,
  dependencyEdges,
  Document,
  Expr,
  Member,
  IncrementalAnalyzer,
  isBakedDocument,
} from "../../packages/core/src/index";
import { normalizeObjectKey } from "./key-normalization";
import { languageProviders } from "./language-features";
const collection = vscode.languages.createDiagnosticCollection("dams");
const previewScheme = "dams-baked";
const previewContents = new Map<string, string>();
const previewUris = new Map<string, vscode.Uri>();
const previewChanges = new vscode.EventEmitter<vscode.Uri>();
const analysisCache = new Map<
  string,
  {
    version: number;
    analysis: ReturnType<typeof analyze>;
    analyzer: IncrementalAnalyzer;
  }
>();
const range = (r: {
  start: { line: number; column: number };
  end: { line: number; column: number };
}) => new vscode.Range(r.start.line, r.start.column, r.end.line, r.end.column);
type KeySuggestion = { member: Member; replacement: string };
type GraphNode = { id: string; label: string; error: boolean };
function graphMembers(
  document: Document,
  diagnostics: ReturnType<typeof analyze>["diagnostics"],
): { nodes: GraphNode[]; ranges: Map<string, vscode.Range> } {
  const nodes: GraphNode[] = [];
  const ranges = new Map<string, vscode.Range>();
  const visit = (members: Member[], parent = "") =>
    members.forEach((member) => {
      const id = parent ? `${parent}.${member.key.text}` : member.key.text;
      const memberRange = range(member.range);
      nodes.push({
        id,
        label: id,
        error: diagnostics.some(
          (diagnostic) =>
            diagnostic.severity === "error" &&
            range(diagnostic.range).intersection(memberRange),
        ),
      });
      ranges.set(id, range(member.key.range));
      if (member.expression.kind === "object")
        visit(member.expression.members, id);
    });
  visit(document.members);
  return { nodes, ranges };
}
function graphHtml(panel: vscode.WebviewPanel, script: vscode.Uri): string {
  const nonce = String(Date.now());
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'"><style>html,body,#graph{width:100%;height:100%;margin:0;overflow:hidden;background:#1e1e1e}</style></head><body><div id="graph"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
}
function hasBracketReference(source: string, key: string): boolean {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\[\\s*"${escaped}"\\s*\\]`).test(source);
}
function keySuggestions(tree: Document): KeySuggestion[] {
  const baked = isBakedDocument(tree);
  const result: KeySuggestion[] = [];
  const visitExpr = (expression: Expr, dict: boolean) => {
    if (expression.kind === "object") {
      visitMembers(expression.members, dict);
      return;
    }
    if (expression.kind === "array")
      expression.items.forEach((item) => visitExpr(item, false));
  };
  const visitMembers = (members: Member[], dict: boolean) => {
    const mixedStyle = members.some((member) => !member.key.quoted);
    for (const member of members) {
      if (member.key.quoted && !dict && (!baked || mixedStyle)) {
        const replacement = normalizeObjectKey(member.key.text);
        const conflict =
          replacement !== undefined &&
          members.some(
            (other) => other !== member && other.key.text === replacement,
          );
        if (replacement !== undefined && !conflict)
          result.push({ member, replacement });
      }
      visitExpr(member.expression, member.annotation === "dict");
    }
  };
  visitMembers(tree.members, false);
  return result;
}
function previewUri(document: vscode.TextDocument): vscode.Uri {
  return vscode.Uri.parse(
    `${previewScheme}:${document.uri.path}.baked.dams?source=${encodeURIComponent(document.uri.toString())}`,
  );
}
function refreshPreview(document: vscode.TextDocument) {
  const uri = previewUris.get(document.uri.toString());
  if (!uri) return;
  const result = bake(document.getText());
  if (!result.text) return;
  previewContents.set(uri.toString(), result.text);
  previewChanges.fire(uri);
}
function getAnalysis(
  document: vscode.TextDocument,
): ReturnType<typeof analyze> {
  const key = document.uri.toString();
  const cached = analysisCache.get(key);
  if (cached?.version === document.version) return cached.analysis;
  const analyzer = cached?.analyzer ?? new IncrementalAnalyzer();
  const analysis = analyzer.analyze(document.getText());
  analysisCache.set(key, { version: document.version, analysis, analyzer });
  return analysis;
}
function check(
  document: vscode.TextDocument,
  output?: vscode.OutputChannel,
  status?: vscode.StatusBarItem,
) {
  if (document.languageId !== "dams") return;
  const a = getAnalysis(document);
  const baked =
    isBakedDocument(a.document) &&
    !a.diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const diagnostics = a.diagnostics.map(
    (d) =>
      new vscode.Diagnostic(
        range(d.range),
        d.message,
        d.severity === "error"
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning,
      ),
  );
  for (const suggestion of keySuggestions(a.document)) {
    const diagnostic = new vscode.Diagnostic(
      range(suggestion.member.key.range),
      "String key can be an object name",
      vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.code = "dams.stringKey";
    diagnostic.source = "DAMS";
    diagnostics.push(diagnostic);
  }
  collection.set(document.uri, diagnostics);
  refreshPreview(document);
  if (status && vscode.window.activeTextEditor?.document === document) {
    status.text = `DAMS: ${baked ? "Baked" : "Raw"}`;
    status.tooltip = baked
      ? "Final DAMS document; editor hints are hidden."
      : "DAMS source contains annotations, expressions, or incomplete syntax.";
    status.show();
  }
  if (output)
    output.appendLine(
      `Checked ${document.uri.fsPath}: ${diagnostics.length} diagnostic(s).`,
    );
  return a;
}
function active(): vscode.TextDocument | undefined {
  const d = vscode.window.activeTextEditor?.document;
  if (!d || d.languageId !== "dams") {
    void vscode.window.showErrorMessage("Open a DAMS file first.");
    return;
  }
  if (d.uri.scheme !== "file") {
    void vscode.window.showErrorMessage(
      "Open the original DAMS file to Bake, Preview, or show its graph.",
    );
    return;
  }
  return d;
}
export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("DAMS");
  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  output.appendLine("DAMS extension activated.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const checkOpen = () => {
    vscode.workspace.textDocuments.forEach((d) => check(d, output, status));
    const activeDocument = vscode.window.activeTextEditor?.document;
    if (activeDocument) check(activeDocument, output, status);
  };
  const keyActionProvider: vscode.CodeActionProvider = {
    provideCodeActions(document, selection) {
      const source = document.getText();
      const tree = getAnalysis(document).document;
      return keySuggestions(tree)
        .filter((suggestion) =>
          range(suggestion.member.key.range).intersection(selection),
        )
        .filter(
          (suggestion) =>
            !hasBracketReference(source, suggestion.member.key.text),
        )
        .map((suggestion) => {
          const action = new vscode.CodeAction(
            `Convert to ${suggestion.replacement}`,
            vscode.CodeActionKind.QuickFix,
          );
          action.diagnostics = collection
            .get(document.uri)
            ?.filter((diagnostic) => diagnostic.code === "dams.stringKey");
          action.edit = new vscode.WorkspaceEdit();
          action.edit.replace(
            document.uri,
            range(suggestion.member.key.range),
            suggestion.replacement,
          );
          return action;
        });
    },
  };
  const previewProvider: vscode.TextDocumentContentProvider = {
    onDidChange: previewChanges.event,
    provideTextDocumentContent(uri) {
      return (
        previewContents.get(uri.toString()) ??
        "// DAMS baked preview is unavailable."
      );
    },
  };
  context.subscriptions.push(
    collection,
    output,
    status,
    previewChanges,
    ...languageProviders(getAnalysis),
    vscode.workspace.registerTextDocumentContentProvider(
      previewScheme,
      previewProvider,
    ),
    vscode.languages.registerCodeActionsProvider("dams", keyActionProvider, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
    vscode.workspace.onDidOpenTextDocument((d) => check(d, output, status)),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) check(editor.document, output, status);
      else status.hide();
    }),
    vscode.window.onDidChangeVisibleTextEditors(checkOpen),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => check(e.document, output, status), 180);
    }),
    vscode.workspace.onDidCloseTextDocument((d) => {
      collection.delete(d.uri);
      analysisCache.delete(d.uri.toString());
    }),
  );
  checkOpen();
  let attempts = 0;
  const initialCheck = setInterval(() => {
    checkOpen();
    if (++attempts === 10) clearInterval(initialCheck);
  }, 500);
  context.subscriptions.push({ dispose: () => clearInterval(initialCheck) });
  context.subscriptions.push(
    vscode.commands.registerCommand("dams.validate", () => {
      const d = active();
      if (!d) return;
      const a = check(d, output);
      const errors = a?.diagnostics.filter((x) => x.severity === "error") ?? [];
      output.appendLine(`Validate ${d.uri.fsPath}: ${errors.length} error(s).`);
      output.show(true);
      void (errors.length
        ? vscode.window.showErrorMessage(
            `DAMS validation found ${errors.length} error(s); see Problems.`,
          )
        : vscode.window.showInformationMessage("DAMS document is valid."));
    }),
    vscode.commands.registerCommand("dams.bake", async () => {
      const d = active();
      if (!d) return;
      const r = bake(d.getText());
      check(d, output);
      if (!r.text) {
        output.appendLine(`Bake failed for ${d.uri.fsPath}.`);
        output.show(true);
        void vscode.window.showErrorMessage(
          "DAMS baking failed; see Problems and Output → DAMS.",
        );
        return;
      }
      const uri = d.uri.with({
        path: d.uri.path.replace(/\.dams$/i, "") + ".baked.dams",
      });
      await vscode.workspace.fs.writeFile(uri, Buffer.from(r.text));
      output.appendLine(`Baked file saved: ${uri.fsPath}`);
      const opened = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(opened);
      void vscode.window.showInformationMessage(`DAMS baked: ${uri.fsPath}`);
    }),
    vscode.commands.registerCommand("dams.preview", async () => {
      const d = active();
      if (!d) return;
      const uri = previewUri(d);
      const result = bake(d.getText());
      if (!result.text) {
        void vscode.window.showErrorMessage(
          "Baked preview needs one successful bake first; see Problems.",
        );
        return;
      }
      previewUris.set(d.uri.toString(), uri);
      previewContents.set(uri.toString(), result.text);
      const opened = await vscode.workspace.openTextDocument(uri);
      await vscode.languages.setTextDocumentLanguage(opened, "dams");
      await vscode.window.showTextDocument(opened, {
        preview: true,
        viewColumn: vscode.ViewColumn.Beside,
      });
      output.appendLine(`Live baked preview opened for ${d.uri.fsPath}.`);
      void vscode.window.showInformationMessage(
        "Live DAMS baked preview opened.",
      );
    }),
    vscode.commands.registerCommand("dams.graph", () => {
      const d = active();
      if (!d) return;
      const analysis = getAnalysis(d);
      const panel = vscode.window.createWebviewPanel(
        "dams.graph",
        "DAMS Dependency Graph",
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true },
      );
      const script = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, "dist", "graph-webview.js"),
      );
      panel.webview.html = graphHtml(panel, script);
      const members = graphMembers(analysis.document, analysis.diagnostics);
      context.subscriptions.push(
        panel.webview.onDidReceiveMessage((message) => {
          if (message?.type !== "open" || typeof message.id !== "string")
            return;
          const target = members.ranges.get(message.id);
          if (target)
            void vscode.window.showTextDocument(d, { selection: target });
        }),
      );
      setTimeout(
        () =>
          void panel.webview.postMessage({
            type: "graph",
            data: {
              nodes: members.nodes,
              links: dependencyEdges(analysis.document).map((edge) => ({
                source: edge.from,
                target: edge.to,
              })),
            },
          }),
        0,
      );
    }),
  );
}
export function deactivate() {}
