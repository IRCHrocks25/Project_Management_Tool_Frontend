import { taskService } from '../../services/task.service';

/** Workflow stages a task can be in, shared by the department and PM dashboards. */
export type ColumnId =
  | 'not_started'
  | 'owned_in_progress'
  | 'for_approval'
  | 'revision'
  | 'elliot_review'
  | 'qa_before_client'
  | 'client_validation'
  | 'approved_completed';

export const COLUMN_LABEL: Record<ColumnId, string> = {
  not_started: 'Not started',
  owned_in_progress: 'In progress',
  for_approval: 'Awaiting approval',
  revision: 'Changes requested',
  elliot_review: 'Elliot review',
  qa_before_client: 'QA review',
  client_validation: 'Client validation',
  approved_completed: 'Completed',
};

export const BOARD_COLUMNS: ColumnId[] = [
  'not_started',
  'owned_in_progress',
  'for_approval',
  'revision',
  'qa_before_client',
  'client_validation',
  'approved_completed',
];

export const NEXT_STEP: Record<ColumnId, string> = {
  not_started: 'Claim this task or assign an owner, then start work.',
  owned_in_progress: 'Finish the work, then send it for review.',
  for_approval: 'A reviewer completes it or requests specific changes.',
  revision: 'Apply the requested changes, then send it back for review.',
  elliot_review: 'Waiting on Elliot. Move it forward once it is reviewed.',
  qa_before_client: 'QA checks the work before it goes to the client.',
  client_validation: 'Waiting on client feedback. Complete it once the client approves.',
  approved_completed: 'This task is complete. No further action is needed.',
};

export const getAssigneeIds = (task: any): string[] => {
  const assignees = task?.assignees || [];
  if (assignees.length > 0) return assignees.map((a: any) => a.userId || a.user?.id);
  return task?.assignedToId ? [task.assignedToId] : [];
};

/** Which workflow stage a task is in, including the In Review sub-states kept as description markers. */
export const getTaskColumn = (task: any): ColumnId => {
  if (task.status === 'Completed' || task.isCompleted) return 'approved_completed';

  const desc: string = task.description || '';
  if (desc.includes('--- Column: Revision ---')) return 'revision';
  if (desc.includes('--- Column: Elliot Review ---')) return 'elliot_review';
  if (desc.includes('--- Column: QA Review ---')) return 'qa_before_client';
  if (desc.includes('--- Column: Client Validation ---')) return 'client_validation';
  if (desc.includes('--- Column: Client Review ---')) return 'client_validation';
  if (desc.includes('--- Column: For Approval ---')) return 'for_approval';

  if (task.assignedToId) {
    if (task.status === 'In Progress') return 'owned_in_progress';
    if (task.status === 'In Review') return 'for_approval';
    if (task.status === 'Revision' || task.status === 'Needs Revision') return 'revision';
    if (task.status === 'Elliot Review') return 'elliot_review';
    if (task.status === 'QA Review' || task.status === 'QA') return 'qa_before_client';
    if (task.status === 'Client Review' || task.status === 'Client Validation') return 'client_validation';
    return 'owned_in_progress';
  }
  return 'not_started';
};

export const getDueInfo = (task: any): { text: string; className: string } => {
  if (!task?.dueDate) return { text: 'No date', className: 'rd-unassigned' };
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return { text: 'No date', className: 'rd-unassigned' };
  const text = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (getTaskColumn(task) === 'approved_completed') return { text, className: '' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(due);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { text, className: 'rd-overdue' };
  if (days === 0) return { text: 'Today', className: 'rd-duesoon' };
  if (days <= 2) return { text, className: 'rd-duesoon' };
  return { text, className: '' };
};

/** Backend status and description marker for each stage. */
export const mapColumnToStatus = (columnId: string): { status: string; columnMarker?: string; isCompleted: boolean } => {
  switch (columnId) {
    case 'not_started':
      return { status: 'Todo', isCompleted: false };
    case 'owned_in_progress':
      return { status: 'In Progress', isCompleted: false };
    case 'for_approval':
      return { status: 'In Review', columnMarker: '\n\n--- Column: For Approval ---', isCompleted: false };
    case 'revision':
      return { status: 'In Review', columnMarker: '\n\n--- Column: Revision ---', isCompleted: false };
    case 'elliot_review':
      return { status: 'In Review', columnMarker: '\n\n--- Column: Elliot Review ---', isCompleted: false };
    case 'qa_before_client':
      return { status: 'In Review', columnMarker: '\n\n--- Column: QA Review ---', isCompleted: false };
    case 'client_validation':
      return { status: 'In Review', columnMarker: '\n\n--- Column: Client Validation ---', isCompleted: false };
    case 'approved_completed':
      return { status: 'Completed', isCompleted: true };
    default:
      return { status: 'Todo', isCompleted: false };
  }
};

/**
 * Moves a task to a stage: updates its status, attaches any links, and records the
 * stage marker plus a status-change log in the description.
 */
export const moveTaskToColumn = async (
  task: any,
  columnId: string,
  columnLabel: string,
  notes: string,
  links: string[],
  userName?: string,
) => {
  const { status, columnMarker, isCompleted } = mapColumnToStatus(columnId);
  const reviewIntent =
    status === 'In Review'
      ? columnId === 'revision'
        ? 'revision'
        : columnId === 'for_approval'
          ? 'for_approval'
          : undefined
      : undefined;

  await taskService.updateStatus(task.id, status, isCompleted, undefined, undefined, undefined, reviewIntent);

  const validLinks = links.map((link) => link.trim()).filter(Boolean);
  if (validLinks.length > 0) {
    await Promise.all(
      validLinks.map((link) => taskService.addLinkAttachment(task.id, link, undefined, notes.trim() || undefined)),
    ).catch((attachmentError) => {
      console.warn('Failed to add one or more status-change attachment links:', attachmentError);
    });
  }

  // Single description update so marker and log stay in sync
  const baseDesc = (task.description || '').replace(/\n\n--- Column: [^-]+ ---/g, '');
  const descWithMarker = columnMarker ? `${baseDesc}${columnMarker}` : baseDesc;
  let logBlock = `\n\n--- Status Change ---\nNew Column: ${columnLabel}\nBy: ${userName || 'Unknown'}\nAt: ${new Date().toLocaleString()}`;
  if (notes && notes.trim()) logBlock += `\nNotes: ${notes.trim()}`;
  if (validLinks.length === 1) {
    logBlock += `\nAttachment: ${validLinks[0]}`;
  } else if (validLinks.length > 1) {
    logBlock += `\nAttachments:\n${validLinks.map((link) => `- ${link}`).join('\n')}`;
  }
  try {
    await taskService.update(task.id, { description: descWithMarker + logBlock, baseDescription: task.description || '' });
  } catch (descError) {
    console.warn('Failed to update task description with status change log:', descError);
  }
};
