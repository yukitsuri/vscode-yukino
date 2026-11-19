import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let activeTerminal: vscode.Terminal | undefined;
let codeLensProvider: YukinoCodeLensProvider | undefined;

function isFlatpakEnvironment(): boolean {
    return fs.existsSync('/.flatpak-info');
}

function expandHome(rawPath: string): string {
    if (rawPath.startsWith('~/') || rawPath === '~') {
        return path.join(os.homedir(), rawPath.slice(rawPath === '~' ? 1 : 2));
    }
    return rawPath;
}

function searchInPath(binName: string): string | null {
    const envPath = process.env.PATH || '';
    const delimiter = process.platform === 'win32' ? ';' : ':';
    const dirs = envPath.split(delimiter).filter(Boolean);
    const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];

    for (const dir of dirs) {
        for (const ext of extensions) {
            const candidate = path.join(dir, `${binName}${ext}`);
            try {
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    return candidate;
                }
            } catch {}
        }
    }
    return null;
}

function searchInKnownDirs(binName: string): string | null {
    const home = os.homedir();
    const candidates = [
        path.join(home, 'lacie', 'active', binName),
        path.join(home, '.local', 'bin', binName),
        path.join(home, '.cargo', 'bin', binName),
        `/usr/local/bin/${binName}`,
        `/usr/bin/${binName}`,
        `/run/current-system/sw/bin/${binName}`
    ];

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return candidate;
            }
        } catch {}
    }
    return null;
}

function resolveViaFlatpakSpawn(binName: string): string | null {
    if (!isFlatpakEnvironment() || !fs.existsSync('/usr/bin/flatpak-spawn')) {
        return null;
    }
    try {
        const out = cp.execFileSync('/usr/bin/flatpak-spawn', ['--host', 'which', binName], {
            encoding: 'utf8',
            timeout: 3000
        }).trim();
        if (out.length > 0 && !out.includes('no ' + binName)) {
            return out;
        }
    } catch {}
    return null;
}

function resolveViaShell(binName: string): string | null {
    try {
        const shell = process.env.SHELL || '/bin/sh';
        const out = cp.execFileSync(shell, ['-l', '-c', `which ${binName}`], {
            encoding: 'utf8',
            timeout: 3000
        }).trim();
        if (out.length > 0 && fs.existsSync(out)) {
            return out;
        }
    } catch {}
    return null;
}

function resolveServerBinary(): string | null {
    const config = vscode.workspace.getConfiguration('yukino');
    const customPath = config.get<string | null>('server.path');
    if (customPath && customPath.trim().length > 0) {
        const expanded = expandHome(customPath.trim());
        if (fs.existsSync(expanded) || isFlatpakEnvironment()) {
            return expanded;
        }
    }

    const hostCandidate = resolveViaFlatpakSpawn('yukino-lsp');
    if (hostCandidate) {
        return hostCandidate;
    }

    const pathCandidate = searchInPath('yukino-lsp');
    if (pathCandidate) {
        return pathCandidate;
    }

    const knownCandidate = searchInKnownDirs('yukino-lsp');
    if (knownCandidate) {
        return knownCandidate;
    }

    return resolveViaShell('yukino-lsp');
}

function buildServerOptions(binPath: string, extraArgs: string[]): ServerOptions {
    const isFlatpak = isFlatpakEnvironment();
    const flatpakSpawn = '/usr/bin/flatpak-spawn';

    if (isFlatpak && fs.existsSync(flatpakSpawn)) {
        return {
            run: {
                command: flatpakSpawn,
                args: ['--host', binPath, 'lsp', ...extraArgs],
                transport: TransportKind.stdio
            },
            debug: {
                command: flatpakSpawn,
                args: ['--host', binPath, 'lsp', ...extraArgs],
                transport: TransportKind.stdio
            }
        };
    }

    return {
        run: {
            command: binPath,
            args: ['lsp', ...extraArgs],
            transport: TransportKind.stdio
        },
        debug: {
            command: binPath,
            args: ['lsp', ...extraArgs],
            transport: TransportKind.stdio
        }
    };
}

function findProjectRoot(filePath: string): string {
    let current = path.dirname(filePath);
    while (true) {
        if (fs.existsSync(path.join(current, 'yuki.toml')) || fs.existsSync(path.join(current, 'yukispace.toml'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return path.dirname(filePath);
}

function getTerminal(cwd?: string): vscode.Terminal {
    if (activeTerminal && activeTerminal.exitStatus === undefined) {
        return activeTerminal;
    }
    activeTerminal = vscode.window.createTerminal({
        name: 'Yukino',
        cwd: cwd
    });
    return activeTerminal;
}

function runInTerminal(command: string, cwd?: string): void {
    const terminal = getTerminal(cwd);
    terminal.show();
    if (cwd) {
        terminal.sendText(`cd "${cwd}"`);
    }
    terminal.sendText(command);
}

class YukinoCodeLensProvider implements vscode.CodeLensProvider {
    private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

    public refresh(): void {
        this.onDidChangeCodeLensesEmitter.fire();
    }

    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const config = vscode.workspace.getConfiguration('yukino');
        if (!config.get<boolean>('codeLens.enable', true)) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];
        let pendingTestAttr = false;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();

            if (text.length === 0 || text.startsWith('//')) {
                continue;
            }

            if (text.startsWith('#[')) {
                if (text.includes('test')) {
                    pendingTestAttr = true;
                }
                continue;
            }

            const fnMatch = text.match(/^(?:public\s+)?(?:cfun|fun)\s+([a-zA-Z0-9_]+)(?:<[^>]+>)?\s*\(/);
            if (fnMatch) {
                const fnName = fnMatch[1];
                const range = new vscode.Range(i, 0, i, 0);

                if (fnName === 'main') {
                    lenses.push(new vscode.CodeLens(range, {
                        title: 'Run',
                        command: 'yukino.runMain',
                        arguments: [document.uri]
                    }));
                }

                if (pendingTestAttr) {
                    lenses.push(new vscode.CodeLens(range, {
                        title: 'Run Test',
                        command: 'yukino.runTest',
                        arguments: [document.uri, fnName]
                    }));
                }
            }

            pendingTestAttr = false;
        }

        return lenses;
    }
}

function createStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    item.command = 'yukino.showMenu';
    context.subscriptions.push(item);
    return item;
}

function setServerStatus(status: 'starting' | 'ready' | 'error' | 'stopped'): void {
    if (!statusBarItem) {
        return;
    }
    switch (status) {
        case 'starting':
            statusBarItem.text = 'Yukino: Starting...';
            statusBarItem.tooltip = 'Yukino LSP is initializing';
            statusBarItem.show();
            break;
        case 'ready':
            statusBarItem.text = 'Yukino LSP';
            statusBarItem.tooltip = 'Yukino LSP is active (click to open menu)';
            statusBarItem.show();
            break;
        case 'error':
            statusBarItem.text = 'Yukino: Error';
            statusBarItem.tooltip = 'Yukino LSP failed (click to open menu)';
            statusBarItem.show();
            break;
        case 'stopped':
            statusBarItem.text = 'Yukino: Stopped';
            statusBarItem.tooltip = 'Yukino LSP is stopped';
            statusBarItem.show();
            break;
    }
}

async function startServer(): Promise<void> {
    const binPath = resolveServerBinary();
    if (!binPath) {
        setServerStatus('error');
        const selected = await vscode.window.showErrorMessage(
            'Cannot find yukino-lsp binary. Please install yukitsuri/yukino-lsp or configure its path.',
            'Open Settings'
        );
        if (selected === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'yukino.server.path');
        }
        return;
    }

    setServerStatus('starting');
    const config = vscode.workspace.getConfiguration('yukino');
    const extraArgs = config.get<string[]>('server.extraArgs', []);
    const serverOptions = buildServerOptions(binPath, extraArgs);

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'yukino' },
            { scheme: 'untitled', language: 'yukino' }
        ],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.ykn')
        },
        outputChannel: outputChannel
    };

    client = new LanguageClient('yukino-lsp', 'Yukino LSP', serverOptions, clientOptions);

    try {
        await client.start();
        setServerStatus('ready');
    } catch (err) {
        setServerStatus('error');
        outputChannel?.appendLine(`Failed to start Yukino LSP: ${err}`);
        vscode.window.showErrorMessage(`Yukino LSP failed to start: ${err}`);
    }
}

async function restartServer(): Promise<void> {
    if (client) {
        setServerStatus('starting');
        outputChannel?.appendLine('Restarting Yukino LSP...');
        await client.stop();
        client = undefined;
    }
    await startServer();
}

function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('yukino.restartServer', async () => {
            await restartServer();
        }),

        vscode.commands.registerCommand('yukino.runMain', (uri?: vscode.Uri) => {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (!targetUri) {
                vscode.window.showErrorMessage('No active Yukino file to run');
                return;
            }
            const root = findProjectRoot(targetUri.fsPath);
            const hasManifest = fs.existsSync(path.join(root, 'yuki.toml')) || fs.existsSync(path.join(root, 'yukispace.toml'));
            if (hasManifest) {
                runInTerminal('yukino run', root);
            } else {
                runInTerminal(`yukino "${targetUri.fsPath}"`, path.dirname(targetUri.fsPath));
            }
        }),

        vscode.commands.registerCommand('yukino.runFile', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'yukino') {
                vscode.window.showErrorMessage('No active Yukino file');
                return;
            }
            const filePath = editor.document.uri.fsPath;
            runInTerminal(`yukino "${filePath}"`, path.dirname(filePath));
        }),

        vscode.commands.registerCommand('yukino.runTest', (uri?: vscode.Uri, testName?: string) => {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            const root = targetUri ? findProjectRoot(targetUri.fsPath) : undefined;
            if (testName) {
                runInTerminal(`yukino test ${testName}`, root);
            } else {
                runInTerminal('yukino test', root);
            }
        }),

        vscode.commands.registerCommand('yukino.testAll', () => {
            const editor = vscode.window.activeTextEditor;
            const root = editor ? findProjectRoot(editor.document.uri.fsPath) : undefined;
            runInTerminal('yukino test', root);
        }),

        vscode.commands.registerCommand('yukino.build', () => {
            const editor = vscode.window.activeTextEditor;
            const root = editor ? findProjectRoot(editor.document.uri.fsPath) : undefined;
            runInTerminal('yukino build', root);
        }),

        vscode.commands.registerCommand('yukino.check', () => {
            const editor = vscode.window.activeTextEditor;
            const root = editor ? findProjectRoot(editor.document.uri.fsPath) : undefined;
            runInTerminal('yukino-lsp check', root);
        }),

        vscode.commands.registerCommand('yukino.showDoc', async () => {
            const editor = vscode.window.activeTextEditor;
            let symbol = '';
            if (editor) {
                const sel = editor.selection;
                symbol = editor.document.getText(sel).trim();
                if (!symbol) {
                    const range = editor.document.getWordRangeAtPosition(sel.active);
                    if (range) {
                        symbol = editor.document.getText(range).trim();
                    }
                }
            }
            if (!symbol) {
                const input = await vscode.window.showInputBox({ prompt: 'Enter symbol name to inspect documentation' });
                if (!input) {
                    return;
                }
                symbol = input.trim();
            }

            const bin = resolveServerBinary();
            if (!bin) {
                vscode.window.showErrorMessage('Cannot find yukino-lsp to query docs');
                return;
            }

            try {
                let cmd = bin;
                let args = ['doc', symbol];
                if (isFlatpakEnvironment() && fs.existsSync('/usr/bin/flatpak-spawn')) {
                    cmd = '/usr/bin/flatpak-spawn';
                    args = ['--host', bin, 'doc', symbol];
                }
                const docText = cp.execFileSync(cmd, args, { encoding: 'utf8', timeout: 5000 });
                outputChannel?.clear();
                outputChannel?.appendLine(docText);
                outputChannel?.show();
            } catch (err) {
                vscode.window.showErrorMessage(`Documentation lookup failed: ${err}`);
            }
        }),

        vscode.commands.registerCommand('yukino.showMenu', async () => {
            const items: vscode.QuickPickItem[] = [
                { label: 'Restart Language Server', description: 'Restarts yukino-lsp' },
                { label: 'Show Output', description: 'Open Yukino LSP output log' },
                { label: 'Run Project', description: 'Executes yukino run' },
                { label: 'Run All Tests', description: 'Executes yukino test' },
                { label: 'Build Project', description: 'Executes yukino build' },
                { label: 'Check Diagnostics', description: 'Executes yukino-lsp check' }
            ];

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Yukino Actions'
            });

            if (!selected) {
                return;
            }

            switch (selected.label) {
                case 'Restart Language Server':
                    await restartServer();
                    break;
                case 'Show Output':
                    outputChannel?.show();
                    break;
                case 'Run Project':
                    vscode.commands.executeCommand('yukino.runMain');
                    break;
                case 'Run All Tests':
                    vscode.commands.executeCommand('yukino.testAll');
                    break;
                case 'Build Project':
                    vscode.commands.executeCommand('yukino.build');
                    break;
                case 'Check Diagnostics':
                    vscode.commands.executeCommand('yukino.check');
                    break;
            }
        })
    );
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('Yukino Language Server');
    context.subscriptions.push(outputChannel);

    statusBarItem = createStatusBar(context);
    registerCommands(context);

    codeLensProvider = new YukinoCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ language: 'yukino' }, codeLensProvider)
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('yukino.codeLens.enable')) {
                codeLensProvider?.refresh();
            }
            if (e.affectsConfiguration('yukino.server')) {
                restartServer();
            }
        })
    );

    await startServer();
}

export async function deactivate(): Promise<void> {
    if (client) {
        await client.stop();
        client = undefined;
    }
    setServerStatus('stopped');
}
