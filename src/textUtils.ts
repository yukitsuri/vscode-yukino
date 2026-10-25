/**
 * Returns a copy of the given lines where every character inside comments,
 * string literals, and char literals is replaced with a space.
 *
 * Line lengths are preserved, so column offsets in the result remain valid
 * for the original text. Block comments and triple-quoted strings can span
 * multiple lines; the scanner carries that state across lines.
 */
export function blankCommentsAndStrings(srcLines: string[]): string[] {
  const result: string[] = [];
  let inBlockComment = false;
  let inString = false; // "..."
  let inTriple = false; // """..."""
  let inChar = false; // '...'

  for (const srcLine of srcLines) {
    const chars = srcLine.split("");
    let i = 0;

    const blankAt = (idx: number) => {
      if (idx < chars.length) {
        chars[idx] = " ";
      }
    };

    while (i < chars.length) {
      const c = chars[i];
      const next = i + 1 < chars.length ? chars[i + 1] : "";
      const third = i + 2 < chars.length ? chars[i + 2] : "";

      if (inBlockComment) {
        if (c === "*" && next === "/") {
          blankAt(i);
          blankAt(i + 1);
          inBlockComment = false;
          i += 2;
        } else {
          blankAt(i);
          i++;
        }
      } else if (inString) {
        if (c === "\\") {
          blankAt(i);
          blankAt(i + 1);
          i += 2;
        } else if (c === '"') {
          blankAt(i);
          inString = false;
          i++;
        } else {
          blankAt(i);
          i++;
        }
      } else if (inTriple) {
        if (c === "\\") {
          blankAt(i);
          blankAt(i + 1);
          i += 2;
        } else if (c === '"' && next === '"' && third === '"') {
          blankAt(i);
          blankAt(i + 1);
          blankAt(i + 2);
          inTriple = false;
          i += 3;
        } else {
          blankAt(i);
          i++;
        }
      } else if (inChar) {
        if (c === "\\") {
          blankAt(i);
          blankAt(i + 1);
          i += 2;
        } else if (c === "'") {
          blankAt(i);
          inChar = false;
          i++;
        } else {
          blankAt(i);
          i++;
        }
      } else {
        if (c === "/" && next === "/") {
          for (let j = i; j < chars.length; j++) {
            blankAt(j);
          }
          i = chars.length;
        } else if (c === "/" && next === "*") {
          blankAt(i);
          blankAt(i + 1);
          inBlockComment = true;
          i += 2;
        } else if (c === '"' && next === '"' && third === '"') {
          blankAt(i);
          blankAt(i + 1);
          blankAt(i + 2);
          inTriple = true;
          i += 3;
        } else if (c === '"') {
          blankAt(i);
          inString = true;
          i++;
        } else if (c === "'") {
          blankAt(i);
          inChar = true;
          i++;
        } else {
          i++;
        }
      }
    }

    // Normal strings and chars cannot span lines; reset them at end of line.
    // Block comments and triple-quoted strings intentionally keep their state.
    inString = false;
    inChar = false;

    result.push(chars.join(""));
  }

  return result;
}
