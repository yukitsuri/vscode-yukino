import * as vscode from "vscode";
import {
  YUKINO_KEYWORDS,
  YUKINO_INTRINSICS,
  YUKINO_STDLIB_FUNCTIONS,
  YUKINO_RECEIVER_METHODS,
  YUKINO_ATTRIBUTES
} from "../data/yukinoDocs";
import { YukinoSymbolIndexer } from "../indexer/symbolIndexer";

export class YukinoHoverProvider implements vscode.HoverProvider {
  constructor(private indexer: YukinoSymbolIndexer) {}

  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    if (token.isCancellationRequested) {
      return null;
    }

    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);

    // Check Compiler Attributes
    if (YUKINO_ATTRIBUTES[word]) {
      const attr = YUKINO_ATTRIBUTES[word];
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`*(compiler attribute)* \`${attr.name}\`\n\n`);
      md.appendCodeblock(attr.syntax, "yukino");
      md.appendMarkdown(`**${attr.summary}**\n\n`);
      md.appendMarkdown(`${attr.description}\n\n`);
      if (attr.example) {
        md.appendMarkdown(`**Example:**\n`);
        md.appendCodeblock(attr.example, "yukino");
      }
      return new vscode.Hover(md, wordRange);
    }

    // 1. Check Keywords
    if (YUKINO_KEYWORDS[word]) {
      const kw = YUKINO_KEYWORDS[word];
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**keyword** \`${kw.name}\` *(${kw.category})*\n\n`);
      md.appendMarkdown(`**${kw.summary}**\n\n`);
      md.appendMarkdown(`${kw.description}\n\n`);
      md.appendCodeblock(kw.example, "yukino");
      return new vscode.Hover(md, wordRange);
    }

    // 2. Check Intrinsics
    if (YUKINO_INTRINSICS[word]) {
      const fn = YUKINO_INTRINSICS[word];
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`*(compiler intrinsic)*\n`);
      md.appendCodeblock(fn.signature, "yukino");
      md.appendMarkdown(`**${fn.summary}**\n\n`);
      md.appendMarkdown(`${fn.description}\n\n`);
      if (fn.parameters.length > 0) {
        md.appendMarkdown(`**Parameters:**\n`);
        for (const p of fn.parameters) {
          md.appendMarkdown(`- \`${p.name}: ${p.type}\` — ${p.description}\n`);
        }
        md.appendMarkdown(`\n`);
      }
      md.appendMarkdown(`**Returns:** \`${fn.returnType}\`\n\n`);
      if (fn.example) {
        md.appendMarkdown(`**Example:**\n`);
        md.appendCodeblock(fn.example, "yukino");
      }
      return new vscode.Hover(md, wordRange);
    }

    // 3. Check Standard Library Functions
    if (YUKINO_STDLIB_FUNCTIONS[word]) {
      const fn = YUKINO_STDLIB_FUNCTIONS[word];
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`*(stdlib: ${fn.module})*\n`);
      md.appendCodeblock(fn.signature, "yukino");
      md.appendMarkdown(`**${fn.summary}**\n\n`);
      md.appendMarkdown(`${fn.description}\n\n`);
      if (fn.parameters.length > 0) {
        md.appendMarkdown(`**Parameters:**\n`);
        for (const p of fn.parameters) {
          md.appendMarkdown(`- \`${p.name}: ${p.type}\` — ${p.description}\n`);
        }
        md.appendMarkdown(`\n`);
      }
      md.appendMarkdown(`**Returns:** \`${fn.returnType}\`\n\n`);
      if (fn.example) {
        md.appendMarkdown(`**Example:**\n`);
        md.appendCodeblock(fn.example, "yukino");
      }
      return new vscode.Hover(md, wordRange);
    }

    // 4. Check Receiver Methods
    if (YUKINO_RECEIVER_METHODS[word]) {
      const fn = YUKINO_RECEIVER_METHODS[word];
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`*(built-in method)*\n`);
      md.appendCodeblock(fn.signature, "yukino");
      md.appendMarkdown(`**${fn.summary}**\n\n`);
      md.appendMarkdown(`${fn.description}\n\n`);
      if (fn.example) {
        md.appendMarkdown(`**Example:**\n`);
        md.appendCodeblock(fn.example, "yukino");
      }
      return new vscode.Hover(md, wordRange);
    }

    // 5. Check Project Symbols from Indexer
    const sym = this.indexer.findSymbolByName(word, document.uri);
    if (sym) {
      const md = new vscode.MarkdownString();
      const containerPrefix = sym.containerName ? `*(in ${sym.containerName})*\n` : "";
      md.appendMarkdown(`${containerPrefix}*(${sym.kind})*\n`);
      if (sym.signature) {
        md.appendCodeblock(sym.signature, "yukino");
      }
      if (sym.docComment) {
        md.appendMarkdown(`\n${sym.docComment}\n\n`);
      }
      return new vscode.Hover(md, wordRange);
    }

    return null;
  }
}
