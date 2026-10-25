import * as vscode from "vscode";
import { YukinoSymbolIndexer } from "../indexer/symbolIndexer";

export class YukinoDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private indexer: YukinoSymbolIndexer) {}

  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
    if (token.isCancellationRequested) {
      return null;
    }

    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);

    // Find in indexed files (current file first, then workspace)
    const locations = this.indexer.findDefinitions(word, document.uri);
    if (locations.length > 0) {
      return locations;
    }

    return null;
  }
}
