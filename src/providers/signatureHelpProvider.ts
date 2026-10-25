import * as vscode from "vscode";
import {
  YUKINO_INTRINSICS,
  YUKINO_STDLIB_FUNCTIONS,
  YUKINO_RECEIVER_METHODS
} from "../data/yukinoDocs";
import { YukinoSymbolIndexer } from "../indexer/symbolIndexer";

export class YukinoSignatureHelpProvider implements vscode.SignatureHelpProvider {
  constructor(private indexer: YukinoSymbolIndexer) {}

  public provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.SignatureHelpContext
  ): vscode.ProviderResult<vscode.SignatureHelp> {
    if (token.isCancellationRequested) {
      return null;
    }

    const startLine = Math.max(0, position.line - 15);
    const textBefore = document.getText(new vscode.Range(new vscode.Position(startLine, 0), position));

    // Simple parser finding enclosing function call and comma count
    const callInfo = this.findCallAtPosition(textBefore);
    if (!callInfo) {
      return null;
    }

    const { functionName, paramIndex } = callInfo;
    const lookupName = functionName.replace(/!$/, "");

    // Check Intrinsics
    const intrinsic = YUKINO_INTRINSICS[functionName] || YUKINO_INTRINSICS[lookupName];
    if (intrinsic) {
      return this.buildSignatureHelp(intrinsic.signature, intrinsic.parameters, paramIndex, intrinsic.summary);
    }

    // Check Stdlib functions
    const stdFn = YUKINO_STDLIB_FUNCTIONS[functionName] || YUKINO_STDLIB_FUNCTIONS[lookupName];
    if (stdFn) {
      return this.buildSignatureHelp(stdFn.signature, stdFn.parameters, paramIndex, stdFn.summary);
    }

    // Check Receiver methods
    if (YUKINO_RECEIVER_METHODS[functionName]) {
      const fn = YUKINO_RECEIVER_METHODS[functionName];
      return this.buildSignatureHelp(fn.signature, fn.parameters, paramIndex, fn.summary);
    }

    // Check Project Symbols
    const sym =
      this.indexer.findSymbolByName(functionName, document.uri) ||
      this.indexer.findSymbolByName(lookupName, document.uri);
    if (sym && (sym.kind === "function" || sym.kind === "cfun" || sym.kind === "method" || sym.kind === "macro") && sym.parameters) {
      const params = sym.parameters.map(p => ({
        name: p.name,
        type: p.type || "any",
        description: ""
      }));
      return this.buildSignatureHelp(sym.signature || functionName, params, paramIndex, sym.docComment);
    }

    return null;
  }

  private findCallAtPosition(text: string): { functionName: string; paramIndex: number } | null {
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;
    let paramIndex = 0;
    let parenPos = -1;
    let inString = false;
    let stringQuote = "";

    for (let i = text.length - 1; i >= 0; i--) {
      const ch = text[i];
      const prevCh = i > 0 ? text[i - 1] : "";

      if ((ch === '"' || ch === "'") && prevCh !== "\\") {
        if (inString && ch === stringQuote) {
          inString = false;
          stringQuote = "";
        } else if (!inString) {
          inString = true;
          stringQuote = ch;
        }
        continue;
      }

      if (inString) {
        continue;
      }

      if (ch === ")") {
        parenDepth++;
      } else if (ch === "(") {
        if (parenDepth === 0) {
          parenPos = i;
          break;
        } else {
          parenDepth--;
        }
      } else if (ch === "]") {
        bracketDepth++;
      } else if (ch === "[") {
        bracketDepth = Math.max(0, bracketDepth - 1);
      } else if (ch === "}") {
        braceDepth++;
      } else if (ch === "{") {
        braceDepth = Math.max(0, braceDepth - 1);
      } else if (ch === "," && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
        paramIndex++;
      }
    }

    if (parenPos < 0) {
      return null;
    }

    const beforeParen = text.substring(0, parenPos).trimEnd();
    const match = beforeParen.match(/([a-zA-Z_][a-zA-Z0-9_]*!?)$/);
    if (!match) {
      return null;
    }

    return {
      functionName: match[1],
      paramIndex
    };
  }

  private buildSignatureHelp(
    signature: string,
    parameters: { name: string; type: string; description?: string }[],
    activeParameter: number,
    doc?: string
  ): vscode.SignatureHelp {
    const help = new vscode.SignatureHelp();
    const sigInfo = new vscode.SignatureInformation(signature, doc ? new vscode.MarkdownString(doc) : undefined);

    for (const p of parameters) {
      const paramLabel = p.type ? `${p.name}: ${p.type}` : p.name;
      sigInfo.parameters.push(new vscode.ParameterInformation(paramLabel, p.description));
    }

    help.signatures = [sigInfo];
    help.activeSignature = 0;
    help.activeParameter = Math.min(activeParameter, Math.max(0, parameters.length - 1));

    return help;
  }
}
