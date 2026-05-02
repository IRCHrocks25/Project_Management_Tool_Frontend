import { describe, expect, it } from '@jest/globals';
import {
  KANBAN_COLUMNS,
  getTaskColumn,
  mapColumnToStatus,
  writeColumnMarker,
} from './taskKanbanColumn';

// This file is the contract. The backend mirror at
// backend/src/board-view/utils/task-kanban-column.ts must produce the same
// outputs for the same inputs — see backend/src/board-view/utils/
// task-kanban-column.spec.ts which loads the same fixtures.

describe('KANBAN_COLUMNS', () => {
  it('exposes 8 canonical columns including Elliot Review', () => {
    expect(KANBAN_COLUMNS.map((c) => c.id)).toEqual([
      'not_started',
      'owned_in_progress',
      'for_approval',
      'revision',
      'elliot_review',
      'approved_completed',
      'qa_before_client',
      'client_validation',
    ]);
  });

  it('every column has id, label, and color', () => {
    for (const c of KANBAN_COLUMNS) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('getTaskColumn', () => {
  it('completed task -> approved_completed (regardless of other fields)', () => {
    expect(getTaskColumn({ status: 'In Progress', isCompleted: true }).id).toBe('approved_completed');
    expect(getTaskColumn({ status: 'Completed' }).id).toBe('approved_completed');
    expect(getTaskColumn({ status: 'Completed', assignedToId: 'u1' }).id).toBe('approved_completed');
  });

  it('description marker wins over enum status (Revision)', () => {
    expect(getTaskColumn({ status: 'In Review', description: 'foo\n\n--- Column: Revision ---' }).id).toBe('revision');
  });

  it('description marker: Elliot Review', () => {
    expect(getTaskColumn({ status: 'In Review', description: '\n\n--- Column: Elliot Review ---' }).id).toBe('elliot_review');
  });

  it('description marker: QA Review -> qa_before_client', () => {
    expect(getTaskColumn({ status: 'In Review', description: '\n\n--- Column: QA Review ---' }).id).toBe('qa_before_client');
  });

  it('description marker: Client Validation -> client_validation', () => {
    expect(getTaskColumn({ status: 'In Review', description: '\n\n--- Column: Client Validation ---' }).id).toBe('client_validation');
  });

  it('description marker: legacy Client Review -> client_validation', () => {
    expect(getTaskColumn({ status: 'In Review', description: '\n\n--- Column: Client Review ---' }).id).toBe('client_validation');
  });

  it('description marker: For Approval', () => {
    expect(getTaskColumn({ status: 'In Review', description: '\n\n--- Column: For Approval ---' }).id).toBe('for_approval');
  });

  it('assigned + In Progress -> owned_in_progress', () => {
    expect(getTaskColumn({ status: 'In Progress', assignedToId: 'u1' }).id).toBe('owned_in_progress');
  });

  it('assigned + In Review (no marker) -> for_approval', () => {
    expect(getTaskColumn({ status: 'In Review', assignedToId: 'u1' }).id).toBe('for_approval');
  });

  it('assigned + Revision (legacy enum literal) -> revision', () => {
    expect(getTaskColumn({ status: 'Revision', assignedToId: 'u1' }).id).toBe('revision');
    expect(getTaskColumn({ status: 'Needs Revision', assignedToId: 'u1' }).id).toBe('revision');
  });

  it('assigned + Elliot Review (legacy enum literal) -> elliot_review', () => {
    expect(getTaskColumn({ status: 'Elliot Review', assignedToId: 'u1' }).id).toBe('elliot_review');
  });

  it('assigned + QA / QA Review -> qa_before_client', () => {
    expect(getTaskColumn({ status: 'QA Review', assignedToId: 'u1' }).id).toBe('qa_before_client');
    expect(getTaskColumn({ status: 'QA', assignedToId: 'u1' }).id).toBe('qa_before_client');
  });

  it('assigned + Client Review / Client Validation -> client_validation', () => {
    expect(getTaskColumn({ status: 'Client Review', assignedToId: 'u1' }).id).toBe('client_validation');
    expect(getTaskColumn({ status: 'Client Validation', assignedToId: 'u1' }).id).toBe('client_validation');
  });

  it('assigned + Todo (no other signal) -> owned_in_progress', () => {
    expect(getTaskColumn({ status: 'Todo', assignedToId: 'u1' }).id).toBe('owned_in_progress');
  });

  it('unassigned + Todo -> not_started', () => {
    expect(getTaskColumn({ status: 'Todo' }).id).toBe('not_started');
  });

  it('unassigned with no signals -> not_started (fallback)', () => {
    expect(getTaskColumn({}).id).toBe('not_started');
  });

  it('null/undefined description is safe', () => {
    expect(getTaskColumn({ status: 'In Progress', assignedToId: 'u1', description: null }).id).toBe('owned_in_progress');
    expect(getTaskColumn({ status: 'In Progress', assignedToId: 'u1', description: undefined }).id).toBe('owned_in_progress');
  });

  it('isCompleted beats every marker', () => {
    expect(getTaskColumn({ status: 'In Review', isCompleted: true, description: '--- Column: Revision ---' }).id).toBe('approved_completed');
  });

  it('first matching marker in order wins (Revision before Elliot Review)', () => {
    const desc = '\n\n--- Column: Revision ---\n\n--- Column: Elliot Review ---';
    expect(getTaskColumn({ status: 'In Review', description: desc }).id).toBe('revision');
  });
});

describe('mapColumnToStatus', () => {
  it('not_started -> Todo / not completed', () => {
    expect(mapColumnToStatus('Not yet started')).toEqual({ status: 'Todo', isCompleted: false });
  });

  it('owned_in_progress -> In Progress / not completed', () => {
    expect(mapColumnToStatus('Owned/In Progress')).toEqual({ status: 'In Progress', isCompleted: false });
  });

  it('all review-lane columns -> In Review / not completed', () => {
    for (const label of ['For Approval', 'Revision', 'Elliot Review', 'QA Before Sending to Client', 'Client Validation']) {
      expect(mapColumnToStatus(label)).toEqual({ status: 'In Review', isCompleted: false });
    }
  });

  it('approved_completed -> Completed / completed', () => {
    expect(mapColumnToStatus('Approved/Completed')).toEqual({ status: 'Completed', isCompleted: true });
  });

  it('unknown label falls back to Todo', () => {
    expect(mapColumnToStatus('Bogus')).toEqual({ status: 'Todo', isCompleted: false });
  });
});

describe('writeColumnMarker', () => {
  it('appends marker to a clean description', () => {
    const out = writeColumnMarker('Original body', 'For Approval');
    expect(out).toBe('Original body\n\n--- Column: For Approval ---');
  });

  it('replaces an existing marker with a new one', () => {
    const out = writeColumnMarker('Body\n\n--- Column: For Approval ---', 'Revision');
    expect(out).toBe('Body\n\n--- Column: Revision ---');
  });

  it('idempotent: writing the same marker twice does not duplicate', () => {
    const once = writeColumnMarker('Body', 'Revision');
    const twice = writeColumnMarker(once, 'Revision');
    expect(twice).toBe(once);
  });

  it('non-marker columns (Not yet started) strip any existing marker', () => {
    const out = writeColumnMarker('Body\n\n--- Column: Revision ---', 'Not yet started');
    expect(out).toBe('Body');
  });

  it('Owned/In Progress strips any existing marker', () => {
    const out = writeColumnMarker('Body\n\n--- Column: Elliot Review ---', 'Owned/In Progress');
    expect(out).toBe('Body');
  });

  it('Approved/Completed strips any existing marker', () => {
    const out = writeColumnMarker('Body\n\n--- Column: Client Validation ---', 'Approved/Completed');
    expect(out).toBe('Body');
  });

  it('null/undefined description treated as empty', () => {
    expect(writeColumnMarker(null, 'Revision')).toBe('\n\n--- Column: Revision ---');
    expect(writeColumnMarker(undefined, 'Revision')).toBe('\n\n--- Column: Revision ---');
  });

  it('unknown column label leaves description stripped only', () => {
    expect(writeColumnMarker('Body\n\n--- Column: Revision ---', 'Bogus')).toBe('Body');
  });

  it('round-trip: writeColumnMarker then getTaskColumn returns the same column for review-lane labels', () => {
    const reviewLabels = ['For Approval', 'Revision', 'Elliot Review', 'QA Before Sending to Client', 'Client Validation'];
    for (const label of reviewLabels) {
      const desc = writeColumnMarker('seed', label);
      const col = getTaskColumn({ status: 'In Review', description: desc, assignedToId: 'u1' });
      expect(col.label).toBe(label);
    }
  });
});
