import type { ActionResponseEnvelope, DashboardActionId, OperatorApiFacade, ReceiptSummary } from './contracts.ts';

type CardState = {
  id: DashboardActionId;
  title: string;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  summary: string;
  hash: string | null;
  receipts: ReceiptSummary[];
};

interface DashboardState {
  sequence: number;
  cards: CardState[];
  lastArtifactsMessage: string;
}

const ACTION_TIMEOUT_MS = 15000;

export function mountDashboardApp(root: HTMLElement, facade: OperatorApiFacade): void {
  const state: DashboardState = {
    sequence: 0,
    cards: [
      { id: 'preflight', title: 'Preflight', status: 'IDLE', summary: 'Ready.', hash: null, receipts: [] },
      { id: 'gates', title: 'Gates', status: 'IDLE', summary: 'Ready.', hash: null, receipts: [] },
      { id: 'pr_inventory', title: 'PR Status', status: 'IDLE', summary: 'Ready.', hash: null, receipts: [] },
      { id: 'run_status', title: 'Run Artifacts', status: 'IDLE', summary: 'Ready.', hash: null, receipts: [] },
    ],
    lastArtifactsMessage: 'not configured',
  };

  render(root, state);
  bindCardButtons(root, state, facade);
}

function bindCardButtons(root: HTMLElement, state: DashboardState, facade: OperatorApiFacade): void {
  for (const card of state.cards) {
    const button = root.querySelector<HTMLButtonElement>(`button[data-action="${card.id}"]`);
    if (!button) continue;
    button.addEventListener('click', async () => {
      await runCardAction(root, state, facade, card.id);
    });
  }
}

async function runCardAction(
  root: HTMLElement,
  state: DashboardState,
  facade: OperatorApiFacade,
  cardId: DashboardActionId,
): Promise<void> {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;

  state.sequence += 1;
  const requestId = `${cardId}_${String(state.sequence).padStart(3, '0')}`;
  card.status = 'RUNNING';
  card.summary = `Running ${card.title}...`;
  render(root, state);

  const response = await withTimeout(invokeFacadeAction(facade, cardId, requestId), ACTION_TIMEOUT_MS, cardId, requestId);
  applyResponse(state, cardId, response);
  render(root, state);
}

function applyResponse(state: DashboardState, cardId: DashboardActionId, response: ActionResponseEnvelope<unknown>): void {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;

  const passed = response.status === 'PASS';
  card.status = passed ? 'COMPLETED' : 'FAILED';
  card.summary = `${response.status} ${response.reasonCode}: ${response.message}`;
  card.hash = response.resultHash;
  card.receipts = response.receipts;

  if (cardId === 'run_status') {
    const data = response.data as Record<string, unknown>;
    state.lastArtifactsMessage = typeof data.diagnosisPath === 'string' ? data.diagnosisPath : 'not configured';
  }
}

async function invokeFacadeAction(
  facade: OperatorApiFacade,
  action: DashboardActionId,
  requestId: string,
): Promise<ActionResponseEnvelope<unknown>> {
  const args = { requestId, timestamp: `S17_${requestId}` };
  if (action === 'preflight') return facade.runPreflight(args);
  if (action === 'gates') return facade.runGates(args);
  if (action === 'pr_inventory') return facade.listOpenPrs(args);
  return facade.getRunStatus(args);
}

async function withTimeout(
  operation: Promise<ActionResponseEnvelope<unknown>>,
  timeoutMs: number,
  action: DashboardActionId,
  requestId: string,
): Promise<ActionResponseEnvelope<unknown>> {
  const timeout = new Promise<ActionResponseEnvelope<unknown>>((resolve) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      resolve({
        action,
        request: { action, requestId, args: { requestId }, repoRootStrategy: 'unresolved' },
        status: 'HARD_STOP',
        reasonCode: 'TIMEOUT',
        message: `Action exceeded deterministic timeout (${timeoutMs}ms).`,
        data: {},
        receipts: [],
        receiptPaths: {},
        durableBundlePath: null,
        exitCode: 124,
        resultHash: `${action}:${requestId}:timeout`,
      });
    }, timeoutMs);
  });

  return Promise.race([operation, timeout]);
}

function render(root: HTMLElement, state: DashboardState): void {
  root.innerHTML = dashboardTemplate(state);
}

function dashboardTemplate(state: DashboardState): string {
  const cards = state.cards
    .map((card) => {
      const receipts = card.receipts.length
        ? `<details><summary>Receipts (${card.receipts.length})</summary><pre>${formatReceipts(card.receipts)}</pre></details>`
        : '<p class="muted">No receipts yet.</p>';
      return `<section class="card" aria-live="polite"><h2>${card.title}</h2><p>Status: <strong>${card.status}</strong></p><p>${escapeHtml(card.summary)}</p><p class="muted">Hash: ${escapeHtml(card.hash ?? 'none')}</p><button data-action="${card.id}">Run ${card.title}</button>${receipts}</section>`;
    })
    .join('');

  return `<main class="dashboard" role="main"><h1>PromptOps Dashboard</h1><p class="muted">Deterministic single-route entrypoint.</p><div class="grid">${cards}</div><section class="card"><h2>Run Artifacts</h2><p>${escapeHtml(state.lastArtifactsMessage)}</p></section></main>`;
}

function formatReceipts(receipts: ReceiptSummary[]): string {
  return receipts
    .map((item) => `${item.id} | exit=${item.exitCode} | ${item.cmd}\nstdout=${item.stdoutPath}\nstderr=${item.stderrPath}`)
    .join('\n\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
