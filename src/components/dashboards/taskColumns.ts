import { taskService } from '../../services/task.service';
import { deliverableService } from '../../services/deliverable.service';

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

/** The board keeps the order and names the team already knows. */
export const BOARD_DISPLAY_ORDER: ColumnId[] = [
  'not_started',
  'owned_in_progress',
  'for_approval',
  'revision',
  'approved_completed',
  'qa_before_client',
  'client_validation',
];

export const BOARD_COLUMN_TITLE: Partial<Record<ColumnId, string>> = {
  not_started: 'Not yet started',
  owned_in_progress: 'Owned/In Progress',
  for_approval: 'For Approval',
  revision: 'Revision',
  approved_completed: 'Approved/Completed',
  qa_before_client: 'QA Before Sending to Client',
  client_validation: 'Client Validation',
};

export const CARD_STAGE_TONE: Partial<Record<ColumnId, string>> = {
  for_approval: 'tone-review',
  revision: 'tone-revision',
  approved_completed: 'tone-done',
};

export const CARD_ACTION_TONE: Record<string, string> = {
  complete: 'done',
  'mark-complete': 'done',
  'request-changes': 'attention',
  'send-back': 'attention',
  back: 'plain',
};

/** Button colour by what the action means: go ahead, finished, or needs a closer look. */
export const ACTION_BUTTON_CLASS: Record<string, string> = {
  claim: 'rd-btn-go',
  start: 'rd-btn-go',
  review: 'rd-btn-go',
  complete: 'rd-btn-done',
  'mark-complete': 'rd-btn-done',
  'request-changes': 'rd-btn-attention',
  'send-back': 'rd-btn-attention',
};

/** The text someone wrote, without the history blocks and linked-task ids stored beside it. */
export const cardDescription = (description?: string | null): string =>
  (description || '')
    .split(/\n\n--- /)[0]
    .replace(/\n?\[\[[A-Z_]+:[^\]]*\]\]/g, '')
    .replace(/^--- .* ---$/gm, '')
    .trim();

export const getTaskAssigneeIds = (task: any): string[] =>
  task?.assignees?.length
    ? task.assignees.map((a: any) => a.userId || a.user?.id)
    : task?.assignedToId
      ? [task.assignedToId]
      : [];

export const hasRevisionDeliverables = (project: any) =>
  project?.deliverables?.some(
    (d: any) =>
      ['Brand Book', 'Copy of Home Page', 'Home Page', 'Speaker Kit', 'Other'].includes(d.type) &&
      d.status === 'Revision',
  );

export const getLinkedOriginInfo = (task: any) => {
  if (!task?.description) return null;
  const desc: string = task.description;
  const originTaskMatch = desc.match(/\[\[LINKED_ORIGIN_TASK_ID:([^\]]+)\]\]/);
  const originDeptMatch = desc.match(/\[\[LINKED_ORIGIN_DEPARTMENT:([^\]]+)\]\]/);
  const targetDeptMatch = desc.match(/\[\[LINKED_TARGET_DEPARTMENT:([^\]]+)\]\]/);
  if (!originTaskMatch) return null;
  return {
    originTaskId: originTaskMatch[1],
    originDepartmentName: originDeptMatch ? originDeptMatch[1] : '',
    targetDepartmentName: targetDeptMatch ? targetDeptMatch[1] : '',
  };
};

export const getLinkedTargetInfo = (task: any) => {
  if (!task?.description) return null;
  const desc: string = task.description;
  const targetTaskMatch = desc.match(/\[\[LINKED_TARGET_TASK_ID:([^\]]+)\]\]/);
  const targetDeptMatch = desc.match(/\[\[LINKED_TARGET_DEPARTMENT:([^\]]+)\]\]/);
  if (!targetTaskMatch) return null;
  return {
    targetTaskId: targetTaskMatch[1],
    targetDepartmentName: targetDeptMatch ? targetDeptMatch[1] : '',
  };
};

/** What someone can do with a task. Every board and task panel offers exactly these. */
export const getTaskActionRules = (
  task: any,
  viewer: { userId?: string; isTeamLead: boolean; isAIDeveloper?: boolean; project: any },
): { key: string; label: string }[] => {
  const assigneeIds = getTaskAssigneeIds(task);
  const isMine = assigneeIds.includes(viewer.userId || '');
  const linkedOrigin = getLinkedOriginInfo(task);
  const linkedTarget = getLinkedTargetInfo(task);
  const revisionPending = hasRevisionDeliverables(viewer.project || {});
  const rules: { key: string; label: string }[] = [];

  if (assigneeIds.length === 0) {
    rules.push({ key: 'claim', label: 'Claim task' });
    if (viewer.isTeamLead) rules.push({ key: 'assign', label: 'Assign to team member' });
  }
  if (task.assignedToId && !task.isCompleted && (isMine || viewer.isTeamLead)) {
    if (task.status === 'Todo') rules.push({ key: 'start', label: 'Start task' });
    if (task.status === 'In Progress' || (revisionPending && task.status === 'In Review')) {
      rules.push({ key: 'review', label: revisionPending ? 'Resubmit' : 'Send for review' });
      if (viewer.isAIDeveloper) rules.push({ key: 'forward', label: 'Forward to department' });
      if (!revisionPending && !linkedOrigin) rules.push({ key: 'complete', label: 'Complete' });
    }
    if (linkedOrigin) {
      rules.push({ key: 'return', label: `Return to ${linkedOrigin.originDepartmentName || 'origin dept'} for approval` });
    }
    if (task.status === 'In Review' && !revisionPending && !linkedTarget) {
      rules.push({ key: 'mark-complete', label: 'Mark complete' });
      rules.push({ key: 'request-changes', label: 'Request changes' });
      rules.push({ key: 'back', label: 'Back to in progress' });
    }
    if (linkedTarget && task.status === 'In Review') {
      rules.push({ key: 'send-back', label: `Send back to ${linkedTarget.targetDepartmentName || 'linked dept'} for revision` });
    }
  }
  if (task.assignedToId && !task.isCompleted && viewer.isTeamLead) {
    rules.push({ key: 'members', label: 'Update members' });
  }
  return rules;
};

/** Submits a task for review: status, links as attachments, history in the description and on the deliverable. */
export const submitTaskForReview = async (
  task: any,
  links: string[],
  deliverableType: string,
  deliverableId: string | undefined,
  userName?: string,
) => {
  const validLinks = links.map((l) => l.trim()).filter(Boolean);
  const primaryLink = validLinks[0];
  const resolvedDeliverableId = deliverableId || task.deliverableId;
  await taskService.updateStatus(task.id, 'In Review', false, primaryLink, deliverableType, resolvedDeliverableId);
  await Promise.all(validLinks.map((link) => taskService.addLinkAttachment(task.id, link))).catch((attachmentError) => {
    console.warn('Failed to add one or more review attachment links:', attachmentError);
  });
  const linkLines =
    validLinks.length === 1
      ? `\nAttachment: ${validLinks[0]}`
      : `\nAttachments:\n${validLinks.map((link) => `- ${link}`).join('\n')}`;
  const logBlock = `\n\n--- Status Change ---\nNew Column: For Approval\nBy: ${userName || 'Unknown'}\nAt: ${new Date().toLocaleString()}${linkLines}`;
  const currentDesc = task.description || '';
  try {
    await taskService.update(task.id, { description: currentDesc + logBlock, baseDescription: currentDesc });
  } catch (descError) {
    console.warn('Failed to update task description with review log:', descError);
  }
  if (resolvedDeliverableId && primaryLink) {
    try {
      await deliverableService.updateStatus(
        resolvedDeliverableId,
        'Ready for Review',
        `Status moved to "For Approval" by ${userName || 'Unknown'}.${linkLines}`,
        primaryLink,
      );
    } catch (historyError) {
      console.warn('Failed to record deliverable history for review:', historyError);
    }
  }
};
