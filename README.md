# vscode-yukino

Yukino language support for Visual Studio Code powered by [yukino-lsp](https://github.com/yukitsuri/yukino-lsp).

## Features

- Full LSP support via `yukino-lsp`:
  - Code completion (members, modules, types, keywords, snippets, attributes)
  - Hover documentation and type inspection
  - Go to Definition, Declaration, Type Definition, and Implementation
  - Find References
  - Document Symbols and Outline tree
  - Signature Help (parameter hints)
  - Inlay Hints for inferred types
  - Document Formatting
  - Call Hierarchy (incoming and outgoing calls)
  - Diagnostics and compile-time error reporting
- CodeLens runnables (matching Zed runnables):
  - "Run" action above `fun main()`
  - "Run Test" action above `#[test]` functions
- Status bar item showing language server status with quick action menu
- Integrated build, check, and test commands
- Automatic environment resolution (native host, custom user paths, and Flatpak containers via flatpak-spawn)

## Configuration

The extension contributes the following settings under `yukino`:

- `yukino.server.path`: Custom path to the `yukino-lsp` executable (default: `null`, auto-discovered).
- `yukino.server.extraArgs`: Additional arguments to pass to the LSP server.
- `yukino.server.trace`: Protocol tracing level (`off`, `messages`, `verbose`).
- `yukino.codeLens.enable`: Enable or disable "Run" and "Run Test" CodeLens annotations (default: `true`).
- `yukino.inlayHints.enable`: Enable or disable inlay type hints (default: `true`).

## Commands

- `Yukino: Restart Language Server` (`yukino.restartServer`)
- `Yukino: Run (main)` (`yukino.runMain`)
- `Yukino: Run Current File` (`yukino.runFile`)
- `Yukino: Run Test` (`yukino.runTest`)
- `Yukino: Run All Tests` (`yukino.testAll`)
- `Yukino: Build Project` (`yukino.build`)
- `Yukino: Check Diagnostics` (`yukino.check`)
- `Yukino: Show Documentation` (`yukino.showDoc`)
- `Yukino: Open Status Menu` (`yukino.showMenu`)

## Installation

Ensure `yukino-lsp` is installed. The extension automatically looks up standard directories, login shells, and Flatpak host environments.

### From VSIX

Build the package:

```bash
npm exec -- @vscode/vsce package
```

Install via terminal:

```bash
code --install-extension yukinolsp-0.2.1.vsix
```

Or inside VS Code:
1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run `Extensions: Install from VSIX...`.
3. Select `yukinolsp-0.2.1.vsix`.

## License

MIT License (c) 2026 shareui
