import * as fs from 'node:fs';
import * as path from 'node:path';
import { runOpenPrProtocol } from '../src/s07/open_pr_protocol.ts';

interface CliOptions {
  repo: string;
  stagingRoot: string;
  durableRoot?: string;
  baseBranch?: string;
  canonicalRootEnv?: string;
  operatorApprovedMerge: boolean;
  enforceMainPreflight: boolean;
  resolveCodexThreads: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const get = (name: string): string | undefined => {
    const idx = argv.indexOf(name);
    if (idx < 0 || idx + 1 >= argv.length) return undefined;
    return argv[idx + 1];
  };
  const has = (name: string): boolean => argv.includes(name);

  const stagingRoot = path.resolve(get('--staging-root') ?? `/tmp/promptops/S07/run-${Date.now()}`);
  return {
    repo: get('--repo') ?? 'Doogie201/promptops-gui',
    stagingRoot,
    durableRoot: get('--durable-root'),
    baseBranch: get('--base-branch') ?? 'main',
    canonicalRootEnv: get('--canonical-root-env') ?? process.env.PROMPTOPS_GUI_CANONICAL_ROOT,
    operatorApprovedMerge: has('--operator-approved-merge'),
    enforceMainPreflight: !has('--skip-main-preflight'),
    resolveCodexThreads: !has('--skip-codex-resolve'),
  };
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(opts.stagingRoot, { recursive: true });

  const result = runOpenPrProtocol({
    cwd: process.cwd(),
    repo: opts.repo,
    stagingRoot: opts.stagingRoot,
    durableRoot: opts.durableRoot,
    baseBranch: opts.baseBranch,
    canonicalRootEnv: opts.canonicalRootEnv,
    operatorApprovedMerge: opts.operatorApprovedMerge,
    enforceMainPreflight: opts.enforceMainPreflight,
    resolveCodexThreads: opts.resolveCodexThreads,
  });

  const outputPath = path.join(opts.stagingRoot, 's07_protocol_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
  process.stdout.write(`${outputPath}\n`);
}

main();
