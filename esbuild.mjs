import * as esbuild from 'esbuild';
const watch = process.argv.includes('--watch');
const extension = { entryPoints: ['extension/src/extension.ts'], bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], outfile: 'extension/dist/extension.js', sourcemap: true };
const webview = { entryPoints: ['extension/src/graph-webview.ts'], bundle: true, platform: 'browser', format: 'iife', outfile: 'extension/dist/graph-webview.js', sourcemap: true };
if (watch) { const first=await esbuild.context(extension),second=await esbuild.context(webview); await Promise.all([first.watch(),second.watch()]); } else await Promise.all([esbuild.build(extension),esbuild.build(webview)]);
