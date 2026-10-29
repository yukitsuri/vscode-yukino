import * as vscode from "vscode";
import { blankCommentsAndStrings } from "../textUtils";

export type SymbolKindType =
  | "function"
  | "cfun"
  | "struct"
  | "cstruct"
  | "class"
  | "interface"
  | "enum"
  | "variable"
  | "constant"
  | "field"
  | "method"
  | "property"
  | "macro"
  | "operator"
  | "enumMember"
  | "alias"
  | "typeAlias";

export interface ParameterInfo {
  name: string;
  type?: string;
  defaultValue?: string;
}

export interface YukinoSymbol {
  name: string;
  kind: SymbolKindType;
  uri: vscode.Uri;
  range: vscode.Range;
  selectionRange: vscode.Range;
  signature?: string;
  parameters?: ParameterInfo[];
  returnType?: string;
  docComment?: string;
  containerName?: string;
  children?: YukinoSymbol[];
}

export interface YukinoImport {
  modulePath: string;
  symbols: { name: string; alias?: string }[];
  isWildcard: boolean;
}

export class YukinoSymbolIndexer {
  private fileSymbols: Map<string, YukinoSymbol[]> = new Map();
  private fileImports: Map<string, YukinoImport[]> = new Map();

  public indexDocument(document: vscode.TextDocument): void {
    const text = document.getText();
    const uri = document.uri;
    const { symbols, imports } = this.parseSource(text, uri);
    this.fileSymbols.set(uri.fsPath, symbols);
    this.fileImports.set(uri.fsPath, imports);
  }

  public removeFile(uri: vscode.Uri): void {
    this.fileSymbols.delete(uri.fsPath);
    this.fileImports.delete(uri.fsPath);
  }

  public async indexWorkspace(): Promise<void> {
    const files = await vscode.workspace.findFiles("**/*.ykn");
    for (const file of files) {
      try {
        const doc = await vscode.workspace.openTextDocument(file);
        this.indexDocument(doc);
      } catch (err) {
        // Skip inaccessible files cleanly
      }
    }
  }

  public getSymbolsForFile(uri: vscode.Uri): YukinoSymbol[] {
    return this.fileSymbols.get(uri.fsPath) || [];
  }

  public getImportsForFile(uri: vscode.Uri): YukinoImport[] {
    return this.fileImports.get(uri.fsPath) || [];
  }

  public findDefinitions(name: string, currentUri: vscode.Uri): vscode.Location[] {
    const locations: vscode.Location[] = [];
    const cleanName = name.replace(/!$/, "");
    const matches = (symName: string) => symName === name || symName === cleanName;

    // 1. Search in current file first
    const currentFileSyms = this.getSymbolsForFile(currentUri);
    for (const sym of currentFileSyms) {
      if (matches(sym.name)) {
        locations.push(new vscode.Location(sym.uri, sym.selectionRange));
      }
      if (sym.children) {
        for (const child of sym.children) {
          if (matches(child.name)) {
            locations.push(new vscode.Location(child.uri, child.selectionRange));
          }
        }
      }
    }

    if (locations.length > 0) {
      return locations;
    }

    // 2. Search across other indexed workspace files
    for (const [fsPath, syms] of this.fileSymbols.entries()) {
      if (fsPath === currentUri.fsPath) {
        continue;
      }
      for (const sym of syms) {
        if (matches(sym.name)) {
          locations.push(new vscode.Location(sym.uri, sym.selectionRange));
        }
        if (sym.children) {
          for (const child of sym.children) {
            if (matches(child.name)) {
              locations.push(new vscode.Location(child.uri, child.selectionRange));
            }
          }
        }
      }
    }

    return locations;
  }

  public findSymbolByName(name: string, currentUri?: vscode.Uri): YukinoSymbol | undefined {
    const cleanName = name.replace(/!$/, "");
    const matches = (symName: string) => symName === name || symName === cleanName;

    if (currentUri) {
      const currentSyms = this.getSymbolsForFile(currentUri);
      for (const sym of currentSyms) {
        if (matches(sym.name)) {
          return sym;
        }
        if (sym.children) {
          for (const child of sym.children) {
            if (matches(child.name)) {
              return child;
            }
          }
        }
      }
    }

    for (const syms of this.fileSymbols.values()) {
      for (const sym of syms) {
        if (matches(sym.name)) {
          return sym;
        }
        if (sym.children) {
          for (const child of sym.children) {
            if (matches(child.name)) {
              return child;
            }
          }
        }
      }
    }

    return undefined;
  }

  public getAllSymbols(query: string = ""): YukinoSymbol[] {
    const results: YukinoSymbol[] = [];
    const lower = query.toLowerCase();

    for (const syms of this.fileSymbols.values()) {
      for (const sym of syms) {
        if (!query || sym.name.toLowerCase().includes(lower)) {
          results.push(sym);
        }
        if (sym.children) {
          for (const child of sym.children) {
            if (!query || child.name.toLowerCase().includes(lower)) {
              results.push(child);
            }
          }
        }
      }
    }

    return results;
  }

  private parseSource(text: string, uri: vscode.Uri): { symbols: YukinoSymbol[]; imports: YukinoImport[] } {
    const symbols: YukinoSymbol[] = [];
    const imports: YukinoImport[] = [];
    const lines = text.split(/\r?\n/);
    // Mask out comments and literals while preserving line lengths.
    const codeLines = blankCommentsAndStrings(lines);

    const YUKINO_KEYWORD_NAMES = new Set([
      "set", "rewrite", "static", "fun", "cfun", "define", "class", "struct", "cstruct",
      "interface", "enum", "type", "public", "locked", "operator", "externc", "get",
      "if", "elif", "else", "switch", "while", "for", "in", "loop", "break", "continue",
      "return", "recur", "region", "sus", "catch", "finally", "defer", "space",
      "this", "super", "ref", "with", "extends", "is", "as", "alias", "load",
      "init"
    ]);

    let docCommentBuffer: string[] = [];
    interface ContainerEntry {
      symbol: YukinoSymbol;
      braceDepth: number;
    }
    const containerStack: ContainerEntry[] = [];
    const getCurrentContainer = (): YukinoSymbol | null =>
      containerStack.length > 0 ? containerStack[containerStack.length - 1].symbol : null;

    let braceDepth = 0;
    let parenDepth = 0;
    let pendingFunctionOpen = false;
    const functionBraceDepths: number[] = [];

    const splitParameters = (raw: string): string[] => {
      const result: string[] = [];
      let current = "";
      let depth = 0;
      for (const char of raw) {
        if (char === "<" || char === "(" || char === "[") {
          depth++;
          current += char;
        } else if (char === ">" || char === ")" || char === "]") {
          depth = Math.max(0, depth - 1);
          current += char;
        } else if (char === "," && depth === 0) {
          if (current.trim()) {
            result.push(current.trim());
          }
          current = "";
        } else {
          current += char;
        }
      }
      if (current.trim()) {
        result.push(current.trim());
      }
      return result;
    };

    const findSymbolCol = (lineStr: string, name: string): number => {
      if (/[+*?^$()\[\]{}|\\]/.test(name)) {
        return Math.max(0, lineStr.indexOf(name));
      }
      const idx = lineStr.search(new RegExp(`\\b${name}\\b`));
      return idx >= 0 ? idx : Math.max(0, lineStr.indexOf(name));
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const code = codeLines[lineIndex];
      const trimmed = line.trim();

      // Collect doc comments
      if (trimmed.startsWith("//")) {
        const commentText = trimmed.replace(/^\/\/\s?/, "");
        docCommentBuffer.push(commentText);
        continue;
      }

      if (trimmed === "") {
        // Discard accumulated doc comment on blank separator lines.
        docCommentBuffer = [];
        continue;
      }

      // Preserve doc comment buffer across attribute lines preceding a declaration.
      if (/^(?:#!?\[|!#\[|\|)/.test(trimmed)) {
        continue;
      }

      const currentDocComment = docCommentBuffer.length > 0 ? docCommentBuffer.join("\n") : undefined;
      docCommentBuffer = [];

      // Check imports (support multiline load and public load)
      let loadText = code;
      if (/^\s*(?:public\s+)?load\b/.test(code)) {
        let peekIdx = lineIndex;
        while (!loadText.includes(";") && peekIdx + 1 < lines.length && peekIdx - lineIndex < 20) {
          peekIdx++;
          loadText += " " + codeLines[peekIdx].trim();
        }
      }
      const stmt = loadText.split(";")[0];
      const loadMatch = stmt.match(/^\s*(?:public\s+)?load\s+((?:(?:::)|[^:])+?)(?:\s*(?<!:):(?!:)\s*(.+))?$/);
      if (loadMatch) {
        // '!' is a force-folder marker, not part of the resolved path
        const modPath = loadMatch[1].trim().replace(/!/g, "");
        const rawSymbols = loadMatch[2];
        const itemImport: YukinoImport = {
          modulePath: modPath,
          symbols: [],
          isWildcard: false
        };

        // no symbols clause means the whole module, same as ': *'
        if (!rawSymbols || modPath.includes("*")) {
          itemImport.isWildcard = true;
        }

        if (rawSymbols) {
          const asMatch = rawSymbols.match(/^(.*?)\s+as\s+(.*)$/);
          const symbolPart = asMatch ? asMatch[1] : rawSymbols;
          const aliases = asMatch
            ? asMatch[2].split(",").map(a => a.trim()).filter(a => a)
            : [];
          const parts = symbolPart.split(",").map(p => p.trim()).filter(p => p);
          parts.forEach((part, i) => {
            const exact = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)$/);
            if (exact) {
              itemImport.symbols.push({ name: exact[1], alias: aliases[i] });
            } else {
              // '*', 'pref*' and '*suf' patterns enumerate nothing
              itemImport.isWildcard = true;
            }
          });
        }
        imports.push(itemImport);
      }

      // Check aliases: alias math#sin as sine
      const aliasMatch = code.match(/\b(?:public\s+)?alias\s+([^;\n]+?)\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (aliasMatch) {
        const orig = aliasMatch[1].trim();
        const name = aliasMatch[2].trim();
        const col = findSymbolCol(code, name);
        const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
        const selRange = new vscode.Range(lineIndex, col, lineIndex, col + name.length);

        const sym: YukinoSymbol = {
          name,
          kind: "alias",
          uri,
          range,
          selectionRange: selRange,
          signature: `alias ${orig} as ${name}`,
          docComment: currentDocComment
        };

        symbols.push(sym);
      }

      // Check type aliases: type UserId = uint64 (top-level only, not inside functions)
      const typeAliasMatch = functionBraceDepths.length === 0
        ? code.match(/\b(?:public\s+)?type\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*<[^>]*>)?\s*=\s*([^;]+?);?\s*$/)
        : null;
      if (typeAliasMatch) {
        const name = typeAliasMatch[1];
        const target = typeAliasMatch[2].trim();
        const col = findSymbolCol(code, name);
        const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
        const selRange = new vscode.Range(lineIndex, col, lineIndex, col + name.length);

        const sym: YukinoSymbol = {
          name,
          kind: "typeAlias",
          uri,
          range,
          selectionRange: selRange,
          signature: `type ${name} = ${target}`,
          returnType: target,
          docComment: currentDocComment
        };

        symbols.push(sym);
      }

      // Check struct/class/interface/enum declarations
      const containerMatch = code.match(
        /\b(?:public\s+)?(?:locked\s+)?(struct|cstruct|class|interface|enum)\s+([a-zA-Z_][a-zA-Z0-9_]*)/
      );
      if (containerMatch) {
        const kind = containerMatch[1] as SymbolKindType;
        const name = containerMatch[2];
        const col = findSymbolCol(code, name);
        const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
        const selRange = new vscode.Range(lineIndex, col, lineIndex, col + name.length);

        const sym: YukinoSymbol = {
          name,
          kind,
          uri,
          range,
          selectionRange: selRange,
          signature: `${kind} ${name}`,
          docComment: currentDocComment,
          children: []
        };

        const parentContainer = getCurrentContainer();
        if (parentContainer && parentContainer.children) {
          parentContainer.children.push(sym);
        } else {
          symbols.push(sym);
        }
        containerStack.push({ symbol: sym, braceDepth: -1 });
      }

      // Check macro declarations: define name(params) => expr or define name(params) { ... }
      let macroDeclText = code;
      const macroDeclStart = code.match(/\b(?:public\s+)?define\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
      let macroMatch: RegExpMatchArray | null = null;
      if (macroDeclStart) {
        let peekIdx = lineIndex;
        while (!macroDeclText.includes(")") && peekIdx + 1 < lines.length && peekIdx - lineIndex < 15) {
          peekIdx++;
          macroDeclText += " " + codeLines[peekIdx].trim();
        }
        macroMatch = macroDeclText.match(/\b(?:public\s+)?define\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*?)\)/);
      }
      if (macroMatch) {
        const name = macroMatch[1];
        const rawParams = macroMatch[2] || "";
        const col = findSymbolCol(code, name);
        const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
        const selRange = new vscode.Range(lineIndex, col, lineIndex, col + name.length);

        const params: ParameterInfo[] = [];
        if (rawParams.trim()) {
          const pParts = splitParameters(rawParams);
          for (const p of pParts) {
            const pMatch = p.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*:\s*([^=]+))?/);
            if (pMatch) {
              params.push({
                name: pMatch[1],
                type: pMatch[2]?.trim()
              });
            }
          }
        }

        const parentContainer = getCurrentContainer();
        const sym: YukinoSymbol = {
          name,
          kind: "macro",
          uri,
          range,
          selectionRange: selRange,
          signature: `define ${name}(${rawParams.replace(/\s+/g, " ").trim()})`,
          parameters: params,
          docComment: currentDocComment,
          containerName: parentContainer ? parentContainer.name : undefined
        };

        if (parentContainer && parentContainer.children) {
          parentContainer.children.push(sym);
        } else {
          symbols.push(sym);
        }
      }

      // Check functions (top-level or method, with optional generics and multiline support)
      let funDeclText = code;
      const funDeclStart = code.match(
        /\b(?:public\s+)?(?:static\s+)?(fun|cfun)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:<[^>]+>)?\s*\(/
      );

      let funMatch: RegExpMatchArray | null = null;
      if (funDeclStart) {
        let peekIdx = lineIndex;
        while (!funDeclText.includes(")") && peekIdx + 1 < lines.length && peekIdx - lineIndex < 15) {
          peekIdx++;
          funDeclText += " " + codeLines[peekIdx].trim();
        }

        funMatch = funDeclText.match(
          /\b(?:public\s+)?(?:static\s+)?(fun|cfun)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:<([^>]+)>)?\s*\(([\s\S]*?)\)(?:\s*->\s*([^{;]+))?/
        );
      }

      if (funMatch) {
        const isCfun = funMatch[1] === "cfun";
        const name = funMatch[2];
        const typeParams = funMatch[3];
        const rawParams = funMatch[4] || "";
        const returnType = (funMatch[5] || "void").trim();
        const col = findSymbolCol(code, name);
        const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
        const selRange = new vscode.Range(lineIndex, col, lineIndex, col + name.length);

        const params: ParameterInfo[] = [];
        if (rawParams.trim()) {
          const pParts = splitParameters(rawParams);
          for (const p of pParts) {
            const pMatch = p.trim().match(/^(?:ref\s+~?|(?:\.\.\.))?([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?$/);
            if (pMatch) {
              params.push({
                name: pMatch[1],
                type: pMatch[2]?.trim(),
                defaultValue: pMatch[3]?.trim()
              });
            }
          }
        }

        const parentContainer = getCurrentContainer();
        const sym: YukinoSymbol = {
          name,
          kind: parentContainer ? "method" : (isCfun ? "cfun" : "function"),
          uri,
          range,
          selectionRange: selRange,
          signature: `${funMatch[1]} ${name}${typeParams ? `<${typeParams}>` : ""}(${rawParams.replace(/\s+/g, " ").trim()})${returnType ? ` -> ${returnType}` : ""}`.trim(),
          parameters: params,
          returnType,
          docComment: currentDocComment,
          containerName: parentContainer ? parentContainer.name : undefined
        };

        if (parentContainer && parentContainer.children) {
          parentContainer.children.push(sym);
        } else {
          symbols.push(sym);
        }
      }

      // Operator overloading (with multiline support)
      let opDeclText = code;
      const opDeclStart = code.match(/\b(?:public\s+)?(?:operator\s+(?:fun\s+)?|fun\s+operator\s+)([+\-*/%^&|!=<>~\[\]]+)\s*\(/);
      let opMatch: RegExpMatchArray | null = null;
      if (opDeclStart) {
        let peekIdx = lineIndex;
        while (!opDeclText.includes(")") && peekIdx + 1 < lines.length && peekIdx - lineIndex < 15) {
          peekIdx++;
          opDeclText += " " + codeLines[peekIdx].trim();
        }
        opMatch = opDeclText.match(/\b(?:public\s+)?(?:operator\s+(?:fun\s+)?|fun\s+operator\s+)([+\-*/%^&|!=<>~\[\]]+)\s*\(([\s\S]*?)\)(?:\s*->\s*([^{;]+))?/);
      }
      if (opMatch) {
        const opSymbol = opMatch[1];
        const rawParams = opMatch[2] || "";
        const returnType = (opMatch[3] || "void").trim();
        const opName = `operator ${opSymbol}`;
        const col = findSymbolCol(code, opSymbol);
        const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
        const selRange = new vscode.Range(lineIndex, col, lineIndex, col + opSymbol.length);

        const params: ParameterInfo[] = [];
        if (rawParams.trim()) {
          const pParts = splitParameters(rawParams);
          for (const p of pParts) {
            const pMatch = p.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*:\s*([^=]+))?/);
            if (pMatch) {
              params.push({
                name: pMatch[1],
                type: pMatch[2]?.trim()
              });
            }
          }
        }

        const parentContainer = getCurrentContainer();
        const sym: YukinoSymbol = {
          name: opName,
          kind: "operator",
          uri,
          range,
          selectionRange: selRange,
          signature: `operator ${opSymbol}(${rawParams.replace(/\s+/g, " ").trim()})${returnType ? ` -> ${returnType}` : ""}`,
          parameters: params,
          returnType,
          docComment: currentDocComment,
          containerName: parentContainer ? parentContainer.name : undefined
        };

        if (parentContainer && parentContainer.children) {
          parentContainer.children.push(sym);
        } else {
          symbols.push(sym);
        }
      }

      // Property getters
      const getMatch = code.match(/\b(?:public\s+)?(?:fun\s+)?get\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\(\))?\s*(?:->|:)\s*([^{;]+)/);
      if (getMatch) {
        const name = getMatch[1];
        const retType = getMatch[2].trim();
        const col = findSymbolCol(code, name);
        const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
        const selRange = new vscode.Range(lineIndex, col, lineIndex, col + name.length);

        const parentContainer = getCurrentContainer();
        const sym: YukinoSymbol = {
          name,
          kind: "property",
          uri,
          range,
          selectionRange: selRange,
          signature: `get ${name}() -> ${retType}`,
          returnType: retType,
          docComment: currentDocComment,
          containerName: parentContainer ? parentContainer.name : undefined
        };

        if (parentContainer && parentContainer.children) {
          parentContainer.children.push(sym);
        } else {
          symbols.push(sym);
        }
      }

      // Property setters (with multiline support)
      let setDeclText = code;
      const setDeclStart = code.match(/\b(?:public\s+)?(?:fun\s+)?set\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
      let setPropMatch: RegExpMatchArray | null = null;
      const parentForSet = getCurrentContainer();
      if (setDeclStart && parentForSet) {
        let peekIdx = lineIndex;
        while (!setDeclText.includes(")") && peekIdx + 1 < lines.length && peekIdx - lineIndex < 15) {
          peekIdx++;
          setDeclText += " " + codeLines[peekIdx].trim();
        }
        setPropMatch = setDeclText.match(/\b(?:public\s+)?(?:fun\s+)?set\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*?)\)/);
      }
      if (setPropMatch && parentForSet) {
        const name = setPropMatch[1];
        const rawParams = setPropMatch[2] || "";
        const col = findSymbolCol(code, name);
        const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
        const selRange = new vscode.Range(lineIndex, col, lineIndex, col + name.length);

        const params: ParameterInfo[] = [];
        if (rawParams.trim()) {
          const pParts = splitParameters(rawParams);
          for (const p of pParts) {
            const pMatch = p.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*:\s*([^=]+))?/);
            if (pMatch) {
              params.push({
                name: pMatch[1],
                type: pMatch[2]?.trim()
              });
            }
          }
        }

        const sym: YukinoSymbol = {
          name,
          kind: "property",
          uri,
          range,
          selectionRange: selRange,
          signature: `set ${name}(${rawParams.replace(/\s+/g, " ").trim()})`,
          parameters: params,
          docComment: currentDocComment,
          containerName: parentForSet.name
        };

        if (parentForSet.children) {
          parentForSet.children.push(sym);
        }
      }

      // Check enum variants with optional inline attributes.
      const enumContainer = getCurrentContainer();
      if (enumContainer && enumContainer.kind === "enum") {
        const codeTrimmed = code.trim().replace(/^(?:(?:#!?\[.*?\]|!#\[.*?\]|\|.*?\|)\s*)+/, "");
        const enumVariantMatch = codeTrimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\((.*?)\))?(?:\s*=\s*([^,;]+))?/);
        if (
          enumVariantMatch &&
          enumVariantMatch[1] !== "enum" &&
          enumVariantMatch[1] !== "public" &&
          enumVariantMatch[1] !== "locked"
        ) {
          const vName = enumVariantMatch[1];
          const vParams = enumVariantMatch[2];
          const vVal = enumVariantMatch[3];
          const col = findSymbolCol(code, vName);
          const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
          const selRange = new vscode.Range(lineIndex, col, lineIndex, col + vName.length);

          const sym: YukinoSymbol = {
            name: vName,
            kind: "enumMember",
            uri,
            range,
            selectionRange: selRange,
            signature: vParams ? `${vName}(${vParams.trim()})` : (vVal ? `${vName} = ${vVal.trim()}` : vName),
            docComment: currentDocComment,
            containerName: enumContainer.name
          };

          if (enumContainer.children) {
            enumContainer.children.push(sym);
          }
        }
      }

      // Struct and class field declarations
      const fieldContainer = getCurrentContainer();
      if (fieldContainer && fieldContainer.kind !== "enum" && parenDepth === 0 && !funMatch && !getMatch && !setPropMatch && !opMatch) {
        const strippedCode = code.trim().replace(/^(?:(?:#!?\[.*?\]|!#\[.*?\]|\|.*?\|)\s*)+/, "");
        const fieldMatch = strippedCode.match(/^(?:public\s+)?(?:static\s+)?(?:set\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+?)(?:\s*=\s*[^;,]+)?(?:[,;]|\s*$)/);
        if (fieldMatch) {
          const name = fieldMatch[1];
          const type = fieldMatch[2].trim();
          const col = findSymbolCol(code, name);
          const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
          const selRange = new vscode.Range(lineIndex, col, lineIndex, col + name.length);

          const sym: YukinoSymbol = {
            name,
            kind: "field",
            uri,
            range,
            selectionRange: selRange,
            signature: `${name}: ${type}`,
            returnType: type,
            docComment: currentDocComment,
            containerName: fieldContainer.name
          };

          if (fieldContainer.children) {
            fieldContainer.children.push(sym);
          }
        }
      }

      // Index module-level variables while skipping locals inside function bodies.
      const varContainer = getCurrentContainer();
      const isInsideFunction = functionBraceDepths.length > 0 || (!!funMatch && code.includes("{"));
      const varMatch = code.match(/\b(set|static)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?!\s*\()\s*(?::\s*([^=;]+))?/);
      if (varMatch && !setPropMatch && !YUKINO_KEYWORD_NAMES.has(varMatch[2])) {
        const isStatic = varMatch[1] === "static";
        if (isStatic || (!isInsideFunction && !varContainer)) {
          const name = varMatch[2];
          const type = varMatch[3]?.trim();
          const col = findSymbolCol(code, name);
          const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
          const selRange = new vscode.Range(lineIndex, col, lineIndex, col + name.length);

          const sym: YukinoSymbol = {
            name,
            kind: isStatic ? "constant" : "variable",
            uri,
            range,
            selectionRange: selRange,
            signature: `${varMatch[1]} ${name}${type ? `: ${type}` : ""}`,
            returnType: type,
            docComment: currentDocComment,
            containerName: varContainer ? varContainer.name : undefined
          };

          if (varContainer && varContainer.children) {
            varContainer.children.push(sym);
          } else {
            symbols.push(sym);
          }
        }
      }

      // Track brace nesting level using masked code lines.
      const openBraces = (code.match(/\{/g) || []).length;
      const closeBraces = (code.match(/\}/g) || []).length;

      for (const entry of containerStack) {
        if (entry.braceDepth === -1 && openBraces > 0) {
          entry.braceDepth = braceDepth + 1;
        }
      }

      if (funMatch) {
        const hasNoBody = funDeclText.includes(";") || getCurrentContainer()?.kind === "interface";
        if (openBraces > 0) {
          functionBraceDepths.push(braceDepth + 1);
        } else if (!hasNoBody) {
          pendingFunctionOpen = true;
        }
      } else if (pendingFunctionOpen && openBraces > 0) {
        functionBraceDepths.push(braceDepth + 1);
        pendingFunctionOpen = false;
      }

      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      parenDepth = Math.max(0, parenDepth + openParens - closeParens);

      braceDepth = Math.max(0, braceDepth + openBraces - closeBraces);

      while (functionBraceDepths.length > 0 && braceDepth < functionBraceDepths[functionBraceDepths.length - 1]) {
        functionBraceDepths.pop();
      }

      while (containerStack.length > 0) {
        const top = containerStack[containerStack.length - 1];
        if (top.braceDepth !== -1 && braceDepth < top.braceDepth) {
          top.symbol.range = new vscode.Range(top.symbol.range.start, new vscode.Position(lineIndex, line.length));
          containerStack.pop();
        } else {
          break;
        }
      }
    }

    return { symbols, imports };
  }
}
