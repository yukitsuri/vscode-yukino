import * as vscode from "vscode";
import {
  YUKINO_KEYWORDS,
  YUKINO_INTRINSICS,
  YUKINO_STDLIB_FUNCTIONS,
  YUKINO_RECEIVER_METHODS
} from "../data/yukinoDocs";
import { YukinoSymbolIndexer } from "../indexer/symbolIndexer";

export class YukinoCompletionItemProvider implements vscode.CompletionItemProvider {
  constructor(private indexer: YukinoSymbolIndexer) {}

  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    if (token.isCancellationRequested) {
      return null;
    }

    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    // 1. Check if completing receiver methods after dot (e.g. obj. or str.),
    // but not the range operator `..` and not the decimal point of a float
    const trimmedPrefix = linePrefix.trimEnd();
    if (
      trimmedPrefix.endsWith(".") &&
      !trimmedPrefix.endsWith("..") &&
      !/\d\.$/.test(trimmedPrefix)
    ) {
      return this.provideReceiverCompletions();
    }

    const items: vscode.CompletionItem[] = [];

    // 2. Add Keywords
    for (const [kw, info] of Object.entries(YUKINO_KEYWORDS)) {
      const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
      item.detail = `${kw} (${info.category})`;
      item.documentation = new vscode.MarkdownString(`${info.summary}\n\n**Example:**\n\`\`\`yukino\n${info.example}\n\`\`\``);
      items.push(item);
    }

    // 3. Add Primitive and C ABI Types
    const primitiveTypes = [
      "int8", "int16", "int32", "int64",
      "uint8", "uint16", "uint32", "uint64",
      "float32", "float64", "bool", "char",
      "void", "never", "string", "bytes",
      "ptr", "map",
      "c_char", "c_int", "c_size_t", "c_void",
      "c_long", "c_short", "c_uint", "usize", "isize"
    ];
    for (const type of primitiveTypes) {
      const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
      item.detail = `Yukino type: ${type}`;
      items.push(item);
    }

    // 4. Add Intrinsics and Compiler Macros
    for (const [name, fn] of Object.entries(YUKINO_INTRINSICS)) {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
      item.detail = fn.signature;
      const isMacro = fn.signature.includes("!(");
      item.insertText = new vscode.SnippetString(isMacro ? `${name}!($0)` : `${name}($0)`);
      item.documentation = new vscode.MarkdownString(
        `**[Compiler ${isMacro ? "Macro" : "Intrinsic"}]** ${fn.summary}\n\n${fn.description}${fn.example ? `\n\n**Example:**\n\`\`\`yukino\n${fn.example}\n\`\`\`` : ""}`
      );
      items.push(item);
    }

    // 5. Add Stdlib functions
    for (const [name, fn] of Object.entries(YUKINO_STDLIB_FUNCTIONS)) {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
      item.detail = `${fn.signature} [${fn.module}]`;
      item.insertText = new vscode.SnippetString(`${name}($0)`);
      item.documentation = new vscode.MarkdownString(
        `**[${fn.module}]** ${fn.summary}\n\n${fn.description}${fn.example ? `\n\n**Example:**\n\`\`\`yukino\n${fn.example}\n\`\`\`` : ""}`
      );
      items.push(item);
    }

    // 6. Add Project Symbols from Indexer
    const symbols = this.indexer.getAllSymbols();
    const seenNames = new Set<string>();

    for (const sym of symbols) {
      if (seenNames.has(sym.name)) {
        continue;
      }
      seenNames.add(sym.name);

      let kind = vscode.CompletionItemKind.Variable;
      let insertSnippet = sym.name;

      if (sym.kind === "function" || sym.kind === "cfun" || sym.kind === "method") {
        kind = vscode.CompletionItemKind.Function;
        insertSnippet = `${sym.name}($0)`;
      } else if (sym.kind === "macro") {
        kind = vscode.CompletionItemKind.Function;
        insertSnippet = `${sym.name}!($0)`;
      } else if (sym.kind === "struct" || sym.kind === "cstruct") {
        kind = vscode.CompletionItemKind.Struct;
      } else if (sym.kind === "class") {
        kind = vscode.CompletionItemKind.Class;
      } else if (sym.kind === "interface") {
        kind = vscode.CompletionItemKind.Interface;
      } else if (sym.kind === "enum") {
        kind = vscode.CompletionItemKind.Enum;
      } else if (sym.kind === "enumMember") {
        kind = vscode.CompletionItemKind.EnumMember;
      } else if (sym.kind === "constant") {
        kind = vscode.CompletionItemKind.Constant;
      } else if (sym.kind === "field" || sym.kind === "property") {
        kind = vscode.CompletionItemKind.Field;
      } else if (sym.kind === "operator") {
        kind = vscode.CompletionItemKind.Operator;
      } else if (sym.kind === "alias") {
        kind = vscode.CompletionItemKind.Variable;
      }

      const item = new vscode.CompletionItem(sym.name, kind);
      item.detail = sym.signature || sym.name;
      if (insertSnippet !== sym.name) {
        item.insertText = new vscode.SnippetString(insertSnippet);
      }
      if (sym.docComment) {
        item.documentation = new vscode.MarkdownString(sym.docComment);
      }
      items.push(item);
    }

    return items;
  }

  private provideReceiverCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // Receiver methods for strings, slices, and arrays
    for (const [name, fn] of Object.entries(YUKINO_RECEIVER_METHODS)) {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
      item.detail = fn.signature;
      item.insertText = new vscode.SnippetString(`${name}($0)`);
      item.documentation = new vscode.MarkdownString(
        `${fn.summary}\n\n${fn.description}${fn.example ? `\n\n**Example:**\n\`\`\`yukino\n${fn.example}\n\`\`\`` : ""}`
      );
      items.push(item);
    }

    return items;
  }
}
