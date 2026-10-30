import { CheckerResult } from '../../types.js';

export interface MarkdownTableInput {
  markdown: string;
}

export type MarkdownTableRow = Record<string, string | number | boolean>;

export function parseMarkdownTableReference(input: MarkdownTableInput): MarkdownTableRow[] {
  const lines = input.markdown
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'));

  if (lines.length < 3) return [];

  // Parse headers
  const headerLine = lines[0];
  const rawHeaders = splitTableLine(headerLine);

  const rows: MarkdownTableRow[] = [];
  for (let i = 2; i < lines.length; i++) {
    const rawCells = splitTableLine(lines[i]);
    const rowObj: MarkdownTableRow = {};
    for (let c = 0; c < rawHeaders.length; c++) {
      const colName = rawHeaders[c];
      const rawVal = rawCells[c] ?? '';
      rowObj[colName] = coerceVal(rawVal);
    }
    rows.push(rowObj);
  }
  return rows;
}

function splitTableLine(line: string): string[] {
  // Strip outer pipes
  const inner = line.replace(/^\|/, '').replace(/\|$/, '');
  // Split on pipe NOT preceded by backslash
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '|' && (i === 0 || inner[i - 1] !== '\\')) {
      parts.push(cur.replace(/\\\|/g, '|').trim());
      cur = '';
    } else {
      cur += inner[i];
    }
  }
  parts.push(cur.replace(/\\\|/g, '|').trim());
  return parts;
}

function coerceVal(val: string): string | number | boolean {
  if (val.toLowerCase() === 'true') return true;
  if (val.toLowerCase() === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
  return val;
}

export function checkMarkdownTable(candidateOutput: unknown, input: unknown): CheckerResult {
  const tableInput = input as MarkdownTableInput;
  const expected = parseMarkdownTableReference(tableInput);

  if (!Array.isArray(candidateOutput)) {
    return { pass: false, reason: 'Expected candidate output to be an array of row objects' };
  }

  if (candidateOutput.length !== expected.length) {
    return {
      pass: false,
      reason: `Row count mismatch: expected ${expected.length}, got ${candidateOutput.length}`,
    };
  }

  for (let r = 0; r < expected.length; r++) {
    const expRow = expected[r];
    const candRow = candidateOutput[r] as Record<string, unknown>;
    if (!candRow || typeof candRow !== 'object') {
      return { pass: false, reason: `Row ${r} is not an object` };
    }

    const expKeys = Object.keys(expRow);
    const candKeys = Object.keys(candRow);

    if (expKeys.length !== candKeys.length) {
      return {
        pass: false,
        reason: `Row ${r} key count mismatch: expected [${expKeys.join(', ')}], got [${candKeys.join(', ')}]`,
      };
    }

    for (const key of expKeys) {
      if (String(candRow[key]) !== String(expRow[key])) {
        return {
          pass: false,
          reason: `Row ${r} key '${key}' mismatch: expected '${expRow[key]}', got '${candRow[key]}'`,
        };
      }
    }
  }

  return { pass: true };
}
