import { useCallback } from 'react';
import { projectService } from '../../../services/project.service';
import { deliverableService } from '../../../services/deliverable.service';
import { taskService } from '../../../services/task.service';
import { authService } from '../../../services/auth.service';
import {
  BoardProject,
  BoardDeliverable,
  BoardTask,
  BoardAssignee,
} from '../../../services/boardView.service';
import {
  KANBAN_COLUMNS,
  mapColumnToStatus,
  writeColumnMarker,
} from '../../../utils/taskKanbanColumn';

// Builds the "--- Status Change ---" log block exactly the same byte
// shape DepartmentView (single attachment) and RoleDashboard (multi-link)
// already write — TaskActivityHistory + TaskDetailSideModal parse these
// via regex (`/\n\n--- Status Change ---/`, /\nNotes:.../, /\nAttachments:/),
// so the format is load-bearing.
//
// Returns null when there's nothing to append (no notes AND no attachments).
function buildStatusChangeLogBlock(
  targetColumnLabel: string,
  userName: string,
  notes: string,
  attachments: string[],
): string | null {
  const trimmedNotes = (notes || '').trim();
  const cleanedAttachments = (attachments || []).map((a) => a.trim()).filter((a) => a.length > 0);
  if (!trimmedNotes && cleanedAttachments.length === 0) return null;

  const timestamp = new Date().toLocaleString();
  let block = `\n\n--- Status Change ---\nNew Column: ${targetColumnLabel}\nBy: ${userName}\nAt: ${timestamp}`;
  if (trimmedNotes) {
    block += `\nNotes: ${trimmedNotes}`;
  }
  if (cleanedAttachments.length === 1) {
    // Singular form — matches DepartmentView/ProjectDetail shape
    block += `\nAttachment: ${cleanedAttachments[0]}`;
  } else if (cleanedAttachments.length > 1) {
    // Plural form with bulleted list — matches RoleDashboard shape
    block += `\nAttachments:\n${cleanedAttachments.map((a) => `- ${a}`).join('\n')}`;
  }
  return block;
}

// Mirrors the toast in TaskMetaPanel.tsx (same .toast-notification class
// from Dashboard.css). Inline so Tuesday has zero new editing primitives.
function showToast(message: string) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

type SetData = (updater: (data: BoardProject[] | null) => BoardProject[] | null) => void;

function patchProject(setData: SetData, projectId: string, partial: Partial<BoardProject>) {
  setData((prev) => prev?.map((p) => (p.id === projectId ? { ...p, ...partial } : p)) ?? prev);
}

function patchDeliverable(
  setData: SetData,
  projectId: string,
  deliverableId: string,
  partial: Partial<BoardDeliverable>,
) {
  setData((prev) =>
    prev?.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        deliverables: p.deliverables.map((d) =>
          d.id === deliverableId ? { ...d, ...partial } : d,
        ),
      };
    }) ?? prev,
  );
}

function patchTask(
  setData: SetData,
  projectId: string,
  deliverableId: string,
  taskId: string,
  partial: Partial<BoardTask>,
) {
  setData((prev) =>
    prev?.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        deliverables: p.deliverables.map((d) => {
          if (d.id !== deliverableId) return d;
          return {
            ...d,
            tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, ...partial } : t)),
          };
        }),
      };
    }) ?? prev,
  );
}

// Recompute the project's done-count after a task transitioned in/out of
// approved_completed. Walks the project's children and sets the rollup.
// Cheaper than a refetch for what is usually a single-row change.
function recomputeProjectRollup(setData: SetData, projectId: string) {
  setData((prev) => {
    if (!prev) return prev;
    return prev.map((p) => {
      if (p.id !== projectId) return p;
      let total = 0;
      let done = 0;
      for (const d of p.deliverables) {
        for (const t of d.tasks) {
          total += 1;
          if (t.kanbanColumnId === 'approved_completed') done += 1;
        }
      }
      return { ...p, rollup: { total, done } };
    });
  });
}

function recomputeDeliverableRollup(
  setData: SetData,
  projectId: string,
  deliverableId: string,
) {
  setData((prev) => {
    if (!prev) return prev;
    return prev.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        deliverables: p.deliverables.map((d) => {
          if (d.id !== deliverableId) return d;
          const total = d.tasks.length;
          const done = d.tasks.filter((t) => t.kanbanColumnId === 'approved_completed').length;
          return { ...d, rollup: { total, done } };
        }),
      };
    });
  });
}

export function useTuesdayMutations(setData: SetData) {
  const editProjectName = useCallback(
    async (project: BoardProject, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === project.name) return;
      const old = project.name;
      patchProject(setData, project.id, { name: trimmed });
      try {
        await projectService.update(project.id, { clientName: trimmed });
      } catch {
        patchProject(setData, project.id, { name: old });
        showToast('Failed to rename project');
      }
    },
    [setData],
  );

  const editProjectPriority = useCallback(
    async (project: BoardProject, newPriority: string) => {
      if (newPriority === project.priority) return;
      const old = project.priority;
      patchProject(setData, project.id, { priority: newPriority });
      try {
        await projectService.update(project.id, { priority: newPriority });
      } catch {
        patchProject(setData, project.id, { priority: old });
        showToast('Failed to update priority');
      }
    },
    [setData],
  );

  const editDeliverableName = useCallback(
    async (
      projectId: string,
      deliverable: BoardDeliverable,
      newName: string,
    ) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === deliverable.name) return;
      const old = deliverable.name;
      patchDeliverable(setData, projectId, deliverable.id, { name: trimmed });
      try {
        // Backend `name` is derived from {type, customType}; only `customType`
        // is editable via PATCH /deliverables/:id (see deliverable.service.ts:81).
        // For non-Other deliverables, the backend will ignore customType for
        // display — the cell in NameCell guards this so we shouldn't reach here.
        await deliverableService.update(deliverable.id, { customType: trimmed });
      } catch {
        patchDeliverable(setData, projectId, deliverable.id, { name: old });
        showToast('Failed to rename deliverable');
      }
    },
    [setData],
  );

  const editDeliverableStatus = useCallback(
    async (
      projectId: string,
      deliverable: BoardDeliverable,
      newStatus: string,
    ) => {
      if (newStatus === deliverable.status) return;
      const old = deliverable.status;
      patchDeliverable(setData, projectId, deliverable.id, { status: newStatus });
      try {
        await deliverableService.updateStatus(deliverable.id, newStatus);
      } catch {
        patchDeliverable(setData, projectId, deliverable.id, { status: old });
        showToast('Failed to update deliverable status');
      }
    },
    [setData],
  );

  const editTaskTitle = useCallback(
    async (
      projectId: string,
      deliverableId: string,
      task: BoardTask,
      newTitle: string,
    ) => {
      const trimmed = newTitle.trim();
      if (!trimmed || trimmed === task.title) return;
      const old = task.title;
      patchTask(setData, projectId, deliverableId, task.id, { title: trimmed });
      try {
        await taskService.update(task.id, { title: trimmed });
      } catch {
        patchTask(setData, projectId, deliverableId, task.id, { title: old });
        showToast('Failed to rename task');
      }
    },
    [setData],
  );

  const editTaskDueDate = useCallback(
    async (
      projectId: string,
      deliverableId: string,
      task: BoardTask,
      newDueDate: string | null, // YYYY-MM-DD or null
    ) => {
      const newIso = newDueDate ? new Date(newDueDate).toISOString() : null;
      if (newIso === task.dueDate) return;
      const old = task.dueDate;
      patchTask(setData, projectId, deliverableId, task.id, { dueDate: newIso });
      try {
        await taskService.update(task.id, {
          dueDate: newDueDate ? new Date(newDueDate) : null,
        } as any);
      } catch {
        patchTask(setData, projectId, deliverableId, task.id, { dueDate: old });
        showToast('Failed to update due date');
      }
    },
    [setData],
  );

  // notes + attachments are passed by Tuesday's status-change modal flow.
  // When provided, a "--- Status Change ---" log block is appended to the
  // task description in the byte-exact format the existing surfaces use,
  // and (when attachments.length > 0) each link is also persisted to the
  // entity-based task_attachments table — matching RoleDashboard's
  // behavior so the links appear in TaskAttachmentsList.
  const editTaskStatus = useCallback(
    async (
      projectId: string,
      deliverableId: string,
      task: BoardTask,
      newColumnLabel: string,
      notes?: string,
      attachments?: string[],
    ) => {
      if (newColumnLabel === task.kanbanColumnLabel) return;
      const newCol = KANBAN_COLUMNS.find((c) => c.label === newColumnLabel);
      if (!newCol) return;
      const oldDesc = task.description;
      const oldStatus = task.status;
      const oldIsCompleted = task.isCompleted;
      const oldColLabel = task.kanbanColumnLabel;
      const oldColId = task.kanbanColumnId;

      const { status, isCompleted } = mapColumnToStatus(newColumnLabel);
      // Description = old desc + column marker (idempotent rewrite) + optional log block.
      const descWithMarker = writeColumnMarker(oldDesc, newColumnLabel);
      const userName = authService.getUser()?.name || 'Unknown';
      const logBlock = buildStatusChangeLogBlock(
        newColumnLabel,
        userName,
        notes || '',
        attachments || [],
      );
      const newDesc = logBlock ? descWithMarker + logBlock : descWithMarker;

      patchTask(setData, projectId, deliverableId, task.id, {
        status,
        isCompleted,
        description: newDesc,
        kanbanColumnId: newCol.id,
        kanbanColumnLabel: newCol.label,
      });
      // Done-count may have flipped — refresh rollups optimistically.
      recomputeDeliverableRollup(setData, projectId, deliverableId);
      recomputeProjectRollup(setData, projectId);

      try {
        // Description must be written first so updateStatus's side effects
        // (notifications, deliverable updates) see the right marker.
        if (newDesc !== oldDesc) {
          await taskService.update(task.id, { description: newDesc } as any);
        }
        await taskService.updateStatus(task.id, status, isCompleted);

        // Persist each link as a real attachment so it surfaces in
        // TaskAttachmentsList (mirrors RoleDashboard.handleStatusChangeFromDrag).
        // Failure here is non-fatal — the status change has already saved
        // and the link is also embedded in the description log block.
        const cleanedAttachments = (attachments || [])
          .map((a) => a.trim())
          .filter((a) => a.length > 0);
        if (cleanedAttachments.length > 0) {
          await Promise.all(
            cleanedAttachments.map((link) =>
              taskService.addLinkAttachment(
                task.id,
                link,
                undefined,
                notes && notes.trim() ? notes.trim() : undefined,
              ),
            ),
          ).catch((err) => {
            console.warn(
              '[Tuesday] Failed to add one or more status-change attachment links:',
              err,
            );
          });
        }
      } catch {
        patchTask(setData, projectId, deliverableId, task.id, {
          status: oldStatus,
          isCompleted: oldIsCompleted,
          description: oldDesc,
          kanbanColumnId: oldColId,
          kanbanColumnLabel: oldColLabel,
        });
        recomputeDeliverableRollup(setData, projectId, deliverableId);
        recomputeProjectRollup(setData, projectId);
        showToast('Failed to update status');
      }
    },
    [setData],
  );

  const editTaskAssignees = useCallback(
    async (
      projectId: string,
      deliverableId: string,
      task: BoardTask,
      newUserIds: string[],
      allUsers: any[],
    ) => {
      const oldAssignees = task.assignees;
      const oldUserIds = oldAssignees.map((a) => a.id);
      // Skip if unchanged
      if (
        newUserIds.length === oldUserIds.length &&
        newUserIds.every((id) => oldUserIds.includes(id))
      ) return;

      const newAssignees: BoardAssignee[] = newUserIds
        .map((id) => allUsers.find((u: any) => u.id === id))
        .filter(Boolean)
        .map((u: any) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null }));
      patchTask(setData, projectId, deliverableId, task.id, { assignees: newAssignees });
      try {
        await taskService.assignMultiple(task.id, newUserIds);
      } catch {
        patchTask(setData, projectId, deliverableId, task.id, { assignees: oldAssignees });
        showToast('Failed to update assignees');
      }
    },
    [setData],
  );

  // Inline add at the bottom of an expanded deliverable. Optimistically
  // appends a placeholder task with a temp id, then reconciles with the
  // real one returned by POST /tasks. Reverts on failure.
  const createTask = useCallback(
    async (
      projectId: string,
      deliverableId: string | null,  // null = under the synthetic Unassigned bucket
      title: string,
      type: string,
    ): Promise<BoardTask | null> => {
      const trimmed = title.trim();
      if (!trimmed) return null;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const bucketId = deliverableId ?? '__unassigned__';
      const placeholder: BoardTask = {
        id: tempId,
        title: trimmed,
        type,
        status: 'Todo',
        kanbanColumnId: 'not_started',
        kanbanColumnLabel: 'Not yet started',
        isCompleted: false,
        dueDate: null,
        deliverableId: deliverableId ?? null,
        description: null,
        assignees: [],
      };

      // Optimistic insert
      setData((prev) =>
        prev?.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            deliverables: p.deliverables.map((d) =>
              d.id !== bucketId ? d : { ...d, tasks: [...d.tasks, placeholder] },
            ),
          };
        }) ?? prev,
      );
      recomputeDeliverableRollup(setData, projectId, bucketId);
      recomputeProjectRollup(setData, projectId);

      try {
        const payload: any = { projectId, title: trimmed, type, status: 'Todo', isCompleted: false };
        if (deliverableId) payload.deliverableId = deliverableId;
        const created = await taskService.create(payload);

        // Replace the temp row with the real one. We trust the server-
        // returned id; everything else can stay from the optimistic shape
        // since the backend hasn't run getTaskColumn here — the row IS
        // a fresh Todo, which lands in not_started.
        setData((prev) =>
          prev?.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              deliverables: p.deliverables.map((d) => {
                if (d.id !== bucketId) return d;
                return {
                  ...d,
                  tasks: d.tasks.map((t) =>
                    t.id !== tempId ? t : { ...t, id: created.id },
                  ),
                };
              }),
            };
          }) ?? prev,
        );
        return { ...placeholder, id: created.id };
      } catch {
        // Remove the temp row on failure
        setData((prev) =>
          prev?.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              deliverables: p.deliverables.map((d) =>
                d.id !== bucketId ? d : { ...d, tasks: d.tasks.filter((t) => t.id !== tempId) },
              ),
            };
          }) ?? prev,
        );
        recomputeDeliverableRollup(setData, projectId, bucketId);
        recomputeProjectRollup(setData, projectId);
        showToast('Failed to create task');
        return null;
      }
    },
    [setData],
  );

  // Inline add at the bottom of an expanded project. Placeholder is
  // inserted BEFORE the synthetic '__unassigned__' bucket (if any) so the
  // synthetic row stays last. Reverts on failure.
  const createDeliverable = useCallback(
    async (
      projectId: string,
      type: string,
      customType: string | null,
    ): Promise<BoardDeliverable | null> => {
      if (!type) return null;
      // For type='Other', a non-empty customType is required.
      if (type === 'Other' && !(customType || '').trim()) return null;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const displayName =
        type === 'Other' && customType ? customType.trim() : type;
      const placeholder: BoardDeliverable = {
        id: tempId,
        name: displayName,
        status: 'Not Started',
        rollup: { total: 0, done: 0 },
        minDueDate: null,
        maxDueDate: null,
        tasks: [],
      };

      // Optimistic insert. If the project has the synthetic '__unassigned__'
      // bucket, splice the new deliverable before it; otherwise append.
      setData((prev) =>
        prev?.map((p) => {
          if (p.id !== projectId) return p;
          const idx = p.deliverables.findIndex((d) => d.id === '__unassigned__');
          const next = [...p.deliverables];
          if (idx === -1) next.push(placeholder);
          else next.splice(idx, 0, placeholder);
          return { ...p, deliverables: next };
        }) ?? prev,
      );

      try {
        const created = await deliverableService.create(
          projectId,
          type,
          type === 'Other' ? (customType || '').trim() : undefined,
        );
        // Replace temp id with real id; trust the backend's stored values
        setData((prev) =>
          prev?.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              deliverables: p.deliverables.map((d) =>
                d.id !== tempId ? d : { ...d, id: created.id },
              ),
            };
          }) ?? prev,
        );
        return { ...placeholder, id: created.id };
      } catch {
        setData((prev) =>
          prev?.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              deliverables: p.deliverables.filter((d) => d.id !== tempId),
            };
          }) ?? prev,
        );
        showToast('Failed to create deliverable');
        return null;
      }
    },
    [setData],
  );

  return {
    editProjectName,
    editProjectPriority,
    editDeliverableName,
    editDeliverableStatus,
    editTaskTitle,
    editTaskDueDate,
    editTaskStatus,
    editTaskAssignees,
    createTask,
    createDeliverable,
  };
}
