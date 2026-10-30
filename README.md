# vscode-yukino

Yukino language support extension for Visual Studio Code.

Provides syntax highlighting, snippets, workspace symbol indexing, definition provider, hover tooltips, autocompletion, and diagnostics for Yukino (`.ykn`).

## Building & Installation

To build and install locally:

### 1. Build VSIX

Prerequisites: [Node.js](https://nodejs.org/) (with `npm` and `npx`).

```sh
git clone https://github.com/yukitsuri/vscode-yukino.git
cd vscode-yukino
npm install
npx @vscode/vsce package
```

This compiles TypeScript and generates a `.vsix` file in the project root.

### 2. Install

In VS Code:
1. Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run `Extensions: Install from VSIX...`.
3. Select the generated `.vsix` file.

Or via terminal:
```sh
code --install-extension *.vsix
```
