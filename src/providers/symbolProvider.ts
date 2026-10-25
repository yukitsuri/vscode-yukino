import * as vscode from "vscode";
import { YukinoSymbolIndexer, YukinoSymbol, SymbolKindType } from "../indexer/symbolIndexer";

function mapYukinoKind(kind: SymbolKindType): vscode.SymbolKind {
  switch (kind) {
    case "function":
    case "cfun":
      return vscode.SymbolKind.Function;
    case "method":
      return vscode.SymbolKind.Method;
    case "struct":
    case "cstruct":
      return vscode.SymbolKind.Struct;
    case "class":
      return vscode.SymbolKind.Class;
    case "interface":
      return vscode.SymbolKind.Interface;
    case "enum":
      return vscode.SymbolKind.Enum;
    case "variable":
      return vscode.SymbolKind.Variable;
    case "constant":
      return vscode.SymbolKind.Constant;
    case "field":
      return vscode.SymbolKind.Field;
    case "property":
      return vscode.SymbolKind.Property;
    case "macro":
      return vscode.SymbolKind.Function;
    case "operator":
      return vscode.SymbolKind.Operator;
    case "enumMember":
      return vscode.SymbolKind.EnumMember;
    case "alias":
    case "typeAlias":
      return vscode.SymbolKind.TypeParameter;
    default:
      return vscode.SymbolKind.Variable;
  }
}

export class YukinoDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  constructor(private indexer: YukinoSymbolIndexer) {}

  public provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    if (token.isCancellationRequested) {
      return null;
    }

    const rawSymbols = this.indexer.getSymbolsForFile(document.uri);
    return this.convertToDocumentSymbols(rawSymbols);
  }

  private convertToDocumentSymbols(syms: YukinoSymbol[]): vscode.DocumentSymbol[] {
    const result: vscode.DocumentSymbol[] = [];

    for (const sym of syms) {
      const docSym = new vscode.DocumentSymbol(
        sym.name,
        sym.signature || sym.kind,
        mapYukinoKind(sym.kind),
        sym.range,
        sym.selectionRange
      );

      if (sym.children && sym.children.length > 0) {
        docSym.children = this.convertToDocumentSymbols(sym.children);
      }

      result.push(docSym);
    }

    return result;
  }
}

export class YukinoWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
  constructor(private indexer: YukinoSymbolIndexer) {}

  public provideWorkspaceSymbols(
    query: string,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.SymbolInformation[]> {
    if (token.isCancellationRequested) {
      return null;
    }

    const syms = this.indexer.getAllSymbols(query);
    const results: vscode.SymbolInformation[] = [];

    for (const sym of syms) {
      results.push(
        new vscode.SymbolInformation(
          sym.name,
          mapYukinoKind(sym.kind),
          sym.containerName || "",
          new vscode.Location(sym.uri, sym.selectionRange)
        )
      );
    }

    return results;
  }
}
