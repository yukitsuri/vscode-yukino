import * as vscode from "vscode";
import { YukinoSymbolIndexer } from "./indexer/symbolIndexer";
import { YukinoCompletionItemProvider } from "./providers/completionProvider";
import { YukinoHoverProvider } from "./providers/hoverProvider";
import { YukinoDefinitionProvider } from "./providers/definitionProvider";
import { YukinoSignatureHelpProvider } from "./providers/signatureHelpProvider";
import { YukinoDocumentSymbolProvider, YukinoWorkspaceSymbolProvider } from "./providers/symbolProvider";
import { YukinoDiagnosticsProvider } from "./providers/diagnostics";
import { YukinoCodeActionProvider } from "./providers/codeActionProvider";

const CHANGE_DEBOUNCE_MS = 250;

export async function activate(context: vscode.ExtensionContext) {
  // No `scheme` restriction: providers must also work in unsaved (untitled) files.
  const YUKINO_MODE: vscode.DocumentFilter = { language: "yukino" };

  // 1. Initialize In-Process Symbol Indexer
  const indexer = new YukinoSymbolIndexer();

  // 2. Initialize Diagnostics Linter
  const diagnostics = new YukinoDiagnosticsProvider();
  context.subscriptions.push(diagnostics.getCollection());

  // 3. Register Language Providers
  context.subscriptions.push(
    // Completion (IntelliSense)
    vscode.languages.registerCompletionItemProvider(
      YUKINO_MODE,
      new YukinoCompletionItemProvider(indexer),
      "."
    ),

    // Hover Tooltips
    vscode.languages.registerHoverProvider(
      YUKINO_MODE,
      new YukinoHoverProvider(indexer)
    ),

    // Go to Definition
    vscode.languages.registerDefinitionProvider(
      YUKINO_MODE,
      new YukinoDefinitionProvider(indexer)
    ),

    // Signature Help
    vscode.languages.registerSignatureHelpProvider(
      YUKINO_MODE,
      new YukinoSignatureHelpProvider(indexer),
      "(",
      ","
    ),

    // Document Symbols (Outline / Breadcrumbs)
    vscode.languages.registerDocumentSymbolProvider(
      YUKINO_MODE,
      new YukinoDocumentSymbolProvider(indexer)
    ),

    // Workspace Symbols (Ctrl+T)
    vscode.languages.registerWorkspaceSymbolProvider(
      new YukinoWorkspaceSymbolProvider(indexer)
    ),

    // Code Actions / QuickFix
    vscode.languages.registerCodeActionsProvider(
      YUKINO_MODE,
      new YukinoCodeActionProvider(),
      {
        providedCodeActionKinds: YukinoCodeActionProvider.providedCodeActionKinds
      }
    )
  );

  // 4. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("yukino.reindexWorkspace", async () => {
      await indexer.indexWorkspace();
      vscode.window.showInformationMessage("Yukino: Workspace symbols reindexed successfully.");
    })
  );

  // 5. Watch Documents and Workspaces
  const indexAndAnalyze = (doc: vscode.TextDocument) => {
    indexer.indexDocument(doc);
    diagnostics.analyzeDocument(doc);
  };

  // Debounced re-index/re-analysis: parsing runs on every keystroke otherwise,
  // which blocks the extension host on large files.
  const pendingChanges = new Map<string, ReturnType<typeof setTimeout>>();
  const scheduleReindex = (doc: vscode.TextDocument) => {
    const key = doc.uri.toString();
    const existing = pendingChanges.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    pendingChanges.set(
      key,
      setTimeout(() => {
        pendingChanges.delete(key);
        indexAndAnalyze(doc);
      }, CHANGE_DEBOUNCE_MS)
    );
  };
  const cancelScheduledReindex = (doc: vscode.TextDocument) => {
    const key = doc.uri.toString();
    const existing = pendingChanges.get(key);
    if (existing) {
      clearTimeout(existing);
      pendingChanges.delete(key);
    }
  };

  vscode.workspace.textDocuments.forEach(doc => {
    if (doc.languageId === "yukino") {
      indexAndAnalyze(doc);
    }
  });

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (doc.languageId === "yukino") {
        indexAndAnalyze(doc);
      }
    }),

    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.languageId === "yukino") {
        scheduleReindex(e.document);
      }
    }),

    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === "yukino") {
        indexAndAnalyze(doc);
      }
    }),

    vscode.workspace.onDidCloseTextDocument(doc => {
      diagnostics.clear(doc.uri);
      cancelScheduledReindex(doc);
      // Closed on-disk files stay indexed for workspace symbol search;
      // untitled documents have no file behind them and must not linger.
      if (doc.uri.scheme !== "file") {
        indexer.removeFile(doc.uri);
      }
    })
  );

  // 6. File System Watcher for external changes (git, compiler, file deletion)
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.ykn");
  watcher.onDidCreate(async uri => {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      indexer.indexDocument(doc);
    } catch (err) {
      console.error("Yukino: failed to index created file", uri.toString(), err);
    }
  });
  watcher.onDidChange(async uri => {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      indexer.indexDocument(doc);
    } catch (err) {
      console.error("Yukino: failed to index changed file", uri.toString(), err);
    }
  });
  watcher.onDidDelete(uri => {
    indexer.removeFile(uri);
    diagnostics.clear(uri);
  });
  context.subscriptions.push(watcher);

  // Perform background indexing of the workspace
  indexer.indexWorkspace().catch(err => {
    console.error("Yukino: workspace indexing failed", err);
  });
}

export function deactivate() {}
