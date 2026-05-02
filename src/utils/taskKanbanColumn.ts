/*
 * Canonical kanban column derivation for the Tuesday view.
 *
 * This is a NEW shared helper. Two pre-existing implementations remain in
 * the codebase and are intentionally NOT modified:
 *   - frontend/src/components/DepartmentView.tsx (~L429-584)
 *   - frontend/src/components/dashboards/RoleDashboard.tsx (~L779-819)
 * Consolidation is deferred until Tuesday ships and visual parity can be
 * verified against both views. See CLAUDE.md "Known Debt" for context on
 * the status-history-in-description hack and the 5-status-vs-9-column
 * mismatch this file works around.
 *
 * Reference logic: RoleDashboard. CRM-specific lanes (stuck / forwarded)
 * from DepartmentView are NOT ported — Tuesday is a unified cross-
 * department view; CRM lanes remain a kanban-only concern.
 *
 * The backend mirror lives at backend/src/board-view/utils/task-kanban-column.ts
 * and MUST stay byte-for-byte equivalent in behavior.
 * taskKanbanColumn.test.ts is the shared contract.
 */

export interface KanbanColumn {
  id: string;
  label: string;
  color: string;
}

export const KANBAN_COLUMNS: readonly KanbanColumn[] = [
  { id: 'not_started',        label: 'Not yet started',             color: '#6b7280' },
  { id: 'owned_in_progress',  label: 'Owned/In Progress',           color: '#3b82f6' },
  { id: 'for_approval',       label: 'For Approval',                color: '#f59e0b' },
  { id: 'revision',           label: 'Revision',                    color: '#ef4444' },
  { id: 'elliot_review',      label: 'Elliot Review',               color: '#8b5cf6' },
  { id: 'approved_completed', label: 'Approved/Completed',          color: '#10b981' },
  { id: 'qa_before_client',   label: 'QA Before Sending to Client', color: '#06b6d4' },
  { id: 'client_validation',  label: 'Client Validation',           color: '#f97316' },
];

const COLUMN_BY_ID: Record<string, KanbanColumn> = KANBAN_COLUMNS.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<string, KanbanColumn>,
);

const COLUMN_BY_LABEL: Record<string, KanbanColumn> = KANBAN_COLUMNS.reduce(
  (acc, c) => {
    acc[c.label] = c;
    return acc;
  },
  {} as Record<string, KanbanColumn>,
);

const FALLBACK = COLUMN_BY_ID['not_started'];

interface TaskShape {
  status?: string | null;
  isCompleted?: boolean | null;
  description?: string | null;
  assignedToId?: string | null;
}

export function getTaskColumn(task: TaskShape): KanbanColumn {
  if (task.isCompleted || task.status === 'Completed') {
    return COLUMN_BY_ID['approved_completed'];
  }

  const desc = task.description || '';

  if (desc.includes('--- Column: Revision ---'))         return COLUMN_BY_ID['revision'];
  if (desc.includes('--- Column: Elliot Review ---'))    return COLUMN_BY_ID['elliot_review'];
  if (desc.includes('--- Column: QA Review ---'))        return COLUMN_BY_ID['qa_before_client'];
  if (desc.includes('--- Column: Client Validation ---')) return COLUMN_BY_ID['client_validation'];
  if (desc.includes('--- Column: Client Review ---'))    return COLUMN_BY_ID['client_validation'];
  if (desc.includes('--- Column: For Approval ---'))     return COLUMN_BY_ID['for_approval'];

  if (task.assignedToId) {
    if (task.status === 'In Progress')                              return COLUMN_BY_ID['owned_in_progress'];
    if (task.status === 'In Review')                                return COLUMN_BY_ID['for_approval'];
    if (task.status === 'Revision' || task.status === 'Needs Revision') return COLUMN_BY_ID['revision'];
    if (task.status === 'Elliot Review')                            return COLUMN_BY_ID['elliot_review'];
    if (task.status === 'QA Review' || task.status === 'QA')        return COLUMN_BY_ID['qa_before_client'];
    if (task.status === 'Client Review' || task.status === 'Client Validation') return COLUMN_BY_ID['client_validation'];
    return COLUMN_BY_ID['owned_in_progress'];
  }

  return FALLBACK;
}

export interface ColumnStatusUpdate {
  status: string;
  isCompleted: boolean;
}

// Mirrors RoleDashboard.tsx mapColumnToStatus (~L1242-1264). Returns the
// payload for PATCH /tasks/:id/status. The accompanying description marker
// is written separately via writeColumnMarker so callers can sequence the
// two writes (description first, then status) and stay consistent with the
// existing kanban behavior.
export function mapColumnToStatus(columnLabel: string): ColumnStatusUpdate {
  const column = COLUMN_BY_LABEL[columnLabel];
  switch (column?.id) {
    case 'not_started':         return { status: 'Todo',        isCompleted: false };
    case 'owned_in_progress':   return { status: 'In Progress', isCompleted: false };
    case 'for_approval':
    case 'revision':
    case 'elliot_review':
    case 'qa_before_client':
    case 'client_validation':   return { status: 'In Review',   isCompleted: false };
    case 'approved_completed':  return { status: 'Completed',   isCompleted: true };
    default:                    return { status: 'Todo',        isCompleted: false };
  }
}

const COLUMN_MARKER_BY_ID: Record<string, string> = {
  for_approval:      '\n\n--- Column: For Approval ---',
  revision:          '\n\n--- Column: Revision ---',
  elliot_review:     '\n\n--- Column: Elliot Review ---',
  qa_before_client:  '\n\n--- Column: QA Review ---',
  client_validation: '\n\n--- Column: Client Validation ---',
};

// Strips any existing "--- Column: X ---" block from `description` and
// appends the marker for `columnLabel`. Columns with no marker (Not Yet
// Started / Owned-In-Progress / Approved-Completed) just return the
// stripped description. Mirrors the rewrite logic in RoleDashboard.tsx
// (~L1267-1297) — see CLAUDE.md "Known Debt" for why this lives in the
// description string.
export function writeColumnMarker(
  description: string | null | undefined,
  columnLabel: string,
): string {
  const cleaned = (description || '').replace(/\n\n--- Column: [^-]+ ---/g, '');
  const column = COLUMN_BY_LABEL[columnLabel];
  if (!column) return cleaned;
  const marker = COLUMN_MARKER_BY_ID[column.id];
  if (!marker) return cleaned;
  return cleaned.includes(marker) ? cleaned : cleaned + marker;
}
