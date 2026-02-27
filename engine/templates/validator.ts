export interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

export function validateTicketOutput(outputJson: string, requiredKeys: string[] = []): ValidationResult {
  const reasons: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(outputJson);
  } catch (e) {
    return { valid: false, reasons: ['Invalid JSON syntax'] };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    reasons.push('Output is not a JSON object');
  } else {
    const obj = parsed as Record<string, unknown>;
    for (const key of requiredKeys) {
      if (!(key in obj)) {
        reasons.push(`Missing required key: ${key}`);
      }
    }
  }

  if (outputJson.match(/\{\{.*\}\}/)) {
    reasons.push('Unresolved placeholders remain in output');
  }

  return {
    valid: reasons.length === 0,
    reasons: reasons.sort()
  };
}
