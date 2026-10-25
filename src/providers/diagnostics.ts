import * as vscode from "vscode";
import { blankCommentsAndStrings } from "../textUtils";

export const YUKINO_ERROR_CODES = {
  MISSING_REWRITE: "E0201"
};

export class YukinoDiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("yukino");
  }

  public getCollection(): vscode.DiagnosticCollection {
    return this.diagnosticCollection;
  }

  public analyzeDocument(document: vscode.TextDocument): void {
    if (document.languageId !== "yukino") {
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    // Mask out comments and literals to prevent false statement boundary detection.
    const codeLines = blankCommentsAndStrings(lines);

    let braceDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let enumBraceDepth = -1;
    let pendingEnumOpen = false;

    for (let i = 0; i < lines.length; i++) {
      const code = codeLines[i];
      const trimmed = code.trim();

      // Track braces to identify enum blocks
      const openBraces = (code.match(/\{/g) || []).length;
      const closeBraces = (code.match(/\}/g) || []).length;
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      const openBrackets = (code.match(/\[/g) || []).length;
      const closeBrackets = (code.match(/\]/g) || []).length;

      if (/\benum\s+[A-Za-z_]/.test(code) && enumBraceDepth === -1) {
        if (openBraces > 0) {
          enumBraceDepth = braceDepth + 1;
        } else {
          pendingEnumOpen = true;
        }
      } else if (pendingEnumOpen && openBraces > 0) {
        enumBraceDepth = braceDepth + 1;
        pendingEnumOpen = false;
      }

      // Skip lines that are pure comments (blanked to whitespace) or empty
      if (!trimmed) {
        braceDepth += openBraces - closeBraces;
        if (enumBraceDepth !== -1 && braceDepth < enumBraceDepth) {
          enumBraceDepth = -1;
        }
        continue;
      }

      // Enum variant assignments (e.g. Ok = 200) are not variable mutations
      if (enumBraceDepth !== -1) {
        braceDepth += openBraces - closeBraces;
        if (braceDepth < enumBraceDepth) {
          enumBraceDepth = -1;
        }
        continue;
      }

      const statements = code.split(";");
      let currentOffset = 0;

      for (const rawStmt of statements) {
        const stmtTrimmed = rawStmt.trim();
        const stmtStartInRaw = rawStmt.indexOf(stmtTrimmed);
        const actualStartCol = currentOffset + (stmtStartInRaw >= 0 ? stmtStartInRaw : 0);
        currentOffset += rawStmt.length + 1;

        if (!stmtTrimmed) {
          continue;
        }

        const isDeclarationOrControl =
          /^(?:(?:public|locked|static)\s+)?(?:set|rewrite|static|if|elif|else|while|for|loop|switch|return|sus|catch|finally|fun|cfun|class|struct|cstruct|interface|enum|load|get|operator|define|alias|type|defer|space|init)[\s\(]/.test(
            stmtTrimmed
          ) || stmtTrimmed.startsWith("|") || stmtTrimmed.startsWith("#");

        // Ignore expressions within multiline function calls, macro arguments, or attributes.
        if (!isDeclarationOrControl && parenDepth === 0 && bracketDepth === 0) {
          const assignMatch = stmtTrimmed.match(/^([a-zA-Z_][a-zA-Z0-9_\.\[\]]*)\s*(\+=|-=|\*=|\/=|%=|\*\*=|&=|\|=|\^=|<<=|>>=|=)\s*([^=].*)$/);
          if (assignMatch) {
            const target = assignMatch[1];
            const op = assignMatch[2];
            const targetStartCol = actualStartCol;
            const opIdxInStmt = stmtTrimmed.indexOf(op, target.length);
            const endCol = actualStartCol + (opIdxInStmt >= 0 ? opIdxInStmt + op.length : target.length + op.length);

            const range = new vscode.Range(i, targetStartCol, i, endCol);
            const diagnostic = new vscode.Diagnostic(
              range,
              `In Yukino, variable mutations must use the 'rewrite' keyword: rewrite ${target} ${op} ... (Compiler rule E0201)`,
              vscode.DiagnosticSeverity.Error
            );
            diagnostic.code = YUKINO_ERROR_CODES.MISSING_REWRITE;
            diagnostic.source = "yukino";
            diagnostics.push(diagnostic);
          }
        }
      }

      braceDepth += openBraces - closeBraces;
      parenDepth = Math.max(0, parenDepth + openParens - closeParens);
      bracketDepth = Math.max(0, bracketDepth + openBrackets - closeBrackets);
      if (enumBraceDepth !== -1 && braceDepth < enumBraceDepth) {
        enumBraceDepth = -1;
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  public clear(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
