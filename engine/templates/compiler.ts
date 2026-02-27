import { canonicalSerialize } from '../events/schema';
import { TemplateVersion } from './registry';

export interface CompilationResult {
  state: 'needs_input' | 'ready' | 'invalid';
  missingKeys: string[];
  outputJson?: string;
  reasons?: string[];
}

export function compileTemplate(template: TemplateVersion, context: Record<string, unknown>): CompilationResult {
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  const missingKeys = new Set<string>();

  let match;
  while ((match = placeholderRegex.exec(template.body)) !== null) {
    const key = match[1].trim();
    if (context[key] === undefined || context[key] === null || context[key] === '') {
      missingKeys.add(key);
    }
  }

  if (missingKeys.size > 0) {
    return {
      state: 'needs_input',
      missingKeys: Array.from(missingKeys).sort()
    };
  }

  const rendered = template.body.replace(placeholderRegex, (_, key) => {
    const rawVal = String(context[key.trim()]);
    const escaped = JSON.stringify(rawVal);
    return escaped.substring(1, escaped.length - 1);
  });

  try {
    // If body aims to be JSON, make it deterministically sorted/byte-stable
    const parsed = JSON.parse(rendered);
    const outputJson = canonicalSerialize(parsed);
    return {
      state: 'ready',
      missingKeys: [],
      outputJson
    };
  } catch(e) {
    return {
      state: 'invalid',
      missingKeys: [],
      reasons: ['Malformed JSON after binding placeholders']
    };
  }
}
