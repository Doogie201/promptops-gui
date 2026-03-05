const FORBIDDEN_IMPORT_PATTERNS: readonly RegExp[] = [
  /from\s+["']\.\.\/s10\//,
  /from\s+["']\.\.\/\.\.\/engine\//,
  /from\s+["']\.\.\/\.\.\/adapters\//,
  /from\s+["']\.\.\/\.\.\/policy\//,
];

export interface ImportGuardViolation {
  line: number;
  importLine: string;
  reason: string;
}

export function findForbiddenUiImports(source: string): ImportGuardViolation[] {
  const lines = source.split(/\r?\n/);
  const violations: ImportGuardViolation[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ')) return;

    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      if (!pattern.test(trimmed)) continue;
      violations.push({
        line: index + 1,
        importLine: trimmed,
        reason: 'UI layer must import only the S17 façade, not deep engine/operator modules.',
      });
      return;
    }
  });

  return violations;
}

export function guardUiImportDirection(files: Array<{ filePath: string; source: string }>): ImportGuardViolation[] {
  const violations: ImportGuardViolation[] = [];
  for (const file of files) {
    for (const violation of findForbiddenUiImports(file.source)) {
      violations.push({
        ...violation,
        reason: `${file.filePath}:${violation.reason}`,
      });
    }
  }
  return violations;
}
