// Zero-dependency JSON syntax highlighter for dark themes.
// Returns an array of React elements with colour spans.
// Designed for pre-formatted JSON strings (output of JSON.stringify(x, null, 2)).

import { createElement, type ReactNode } from 'react';

// Token colours (dark theme, matching MUI dark palette)
const COLOURS: Record<string, string> = {
  key: '#00E5FF',      // primary cyan
  string: '#C3E88D',   // green
  number: '#F78C6C',   // orange
  boolean: '#C792EA',  // purple
  null: '#89DDFF',     // light cyan
  brace: '#EEFFFF',    // white-ish
  punctuation: '#89DDFF',
};

// Constant regex on trusted JSON.stringify output, not user input.
// eslint-disable-next-line security/detect-unsafe-regex
const TOKEN_RE = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|([-+]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\]])|([,:])/g;

export function highlightJson(text: string): ReactNode[] {
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    // Push any whitespace/text between tokens
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    lastIndex = match.index + match[0].length;

    if (match[1] !== undefined) {
      // Key (quoted string before colon)
      const keyText = match[1];
      const colon = match[0].slice(keyText.length);
      result.push(
        createElement('span', { key: key++, style: { color: COLOURS.key } }, keyText),
      );
      if (colon) {
        result.push(
          createElement('span', { key: key++, style: { color: COLOURS.punctuation } }, colon),
        );
      }
    } else if (match[2] !== undefined) {
      result.push(
        createElement('span', { key: key++, style: { color: COLOURS.string } }, match[2]),
      );
    } else if (match[3] !== undefined) {
      result.push(
        createElement('span', { key: key++, style: { color: COLOURS.number } }, match[3]),
      );
    } else if (match[4] !== undefined) {
      result.push(
        createElement('span', { key: key++, style: { color: COLOURS.boolean } }, match[4]),
      );
    } else if (match[5] !== undefined) {
      result.push(
        createElement('span', { key: key++, style: { color: COLOURS.null } }, match[5]),
      );
    } else if (match[6] !== undefined) {
      result.push(
        createElement('span', { key: key++, style: { color: COLOURS.brace } }, match[6]),
      );
    } else if (match[7] !== undefined) {
      result.push(
        createElement('span', { key: key++, style: { color: COLOURS.punctuation } }, match[7]),
      );
    }
  }

  // Trailing text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

// Attempt to pretty-print a JSON string. Returns formatted string on success,
// or the original string if it is not valid JSON.
export function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
