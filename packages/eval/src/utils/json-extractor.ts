export function extractJsonFromText(raw: string): { success: boolean; data?: unknown; error?: string } {
  if (!raw || typeof raw !== 'string') {
    return { success: false, error: 'Empty or non-string response' };
  }

  const trimmed = raw.trim();

  // 1. Strict parse
  try {
    const parsed = JSON.parse(trimmed);
    return { success: true, data: parsed };
  } catch {}

  // 2. Fenced markdown block
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch && fencedMatch[1]) {
    try {
      const parsed = JSON.parse(fencedMatch[1].trim());
      return { success: true, data: parsed };
    } catch {}
  }

  // 3. First balanced object or array
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');

  let startIdx = -1;
  let isObject = true;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    isObject = true;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    isObject = false;
  }

  if (startIdx !== -1) {
    const openChar = isObject ? '{' : '[';
    const closeChar = isObject ? '}' : ']';
    let depth = 0;
    let endIdx = -1;

    for (let i = startIdx; i < trimmed.length; i++) {
      if (trimmed[i] === openChar) depth++;
      else if (trimmed[i] === closeChar) {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx !== -1) {
      const candidate = trimmed.substring(startIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(candidate);
        return { success: true, data: parsed };
      } catch {}
    }
  }

  return { success: false, error: 'Could not extract valid JSON from response' };
}
