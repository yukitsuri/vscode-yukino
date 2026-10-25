import * as vscode from "vscode";
import { YUKINO_ERROR_CODES } from "./diagnostics";

export class YukinoCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
    if (token.isCancellationRequested) {
      return null;
    }

    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.code === YUKINO_ERROR_CODES.MISSING_REWRITE) {
        const action = new vscode.CodeAction("Add 'rewrite' keyword", vscode.CodeActionKind.QuickFix);
        action.diagnostics = [diagnostic];
        action.isPreferred = true;

        const edit = new vscode.WorkspaceEdit();
        edit.insert(document.uri, diagnostic.range.start, "rewrite ");
        action.edit = edit;

        actions.push(action);
      }
    }

    return actions;
  }
}
