import { useCallback, useEffect, useRef, useState } from 'react';
import { authService } from '../../services/auth.service';
import { taskService } from '../../services/task.service';
import { deliverableService } from '../../services/deliverable.service';
import {
  boardService,
  BoardColumnType,
  BoardPerson,
  BoardTaskRow,
  ProjectBoard,
  TaskFieldsUpdate,
} from '../../services/board.service';
import { getTaskColumn, mapColumnToStatus, moveTaskToColumn } from '../dashboards/taskColumns';
import { showBoardToast, stageLabel, UNASSIGNED_GROUP } from './boardConfig';

const errorMessage = (error: any, fallback: string): string => {
  const message = error?.response?.data?.message;
  return typeof message === 'string' ? message : fallback;
};

export interface NewTaskContext {
  deliverableId?: string | null;
  type: string;
  priority?: string | null;
  owner?: string | null;
  stageId?: string;
}

export function useBoard(projectId: string | undefined) {
  const [board, setBoard] = useState<ProjectBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const boardRef = useRef<ProjectBoard | null>(null);
  boardRef.current = board;
  const requestRef = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      if (!projectId) return;
      const request = ++requestRef.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const next = await boardService.get(projectId);
        if (request === requestRef.current) setBoard(next);
      } catch (loadError: any) {
        if (request === requestRef.current && !silent) {
          setBoard(null);
          setError(errorMessage(loadError, 'This board could not be loaded.'));
        }
      } finally {
        if (request === requestRef.current && !silent) setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    setBoard(null);
    load();
  }, [load]);

  // Picks up teammates' edits when someone comes back to the tab.
  useEffect(() => {
    const onFocus = () => load(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const patchLocal = useCallback((taskId: string, patch: Partial<BoardTaskRow>) => {
    setBoard((current) =>
      current && {
        ...current,
        tasks: current.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const merged = { ...t, ...patch };
          return { ...merged, stageId: patch.stageId ?? getTaskColumn(merged) };
        }),
      },
    );
  }, []);

  const stamp = (): Partial<BoardTaskRow> => {
    const me = authService.getUser();
    return {
      updatedAt: new Date().toISOString(),
      updatedBy: me ? { id: me.id, name: me.name, avatarUrl: me.avatarUrl ?? null } : null,
    };
  };

  const withRollback = async (task: BoardTaskRow, patch: Partial<BoardTaskRow>, save: () => Promise<unknown>, failure: string) => {
    patchLocal(task.id, { ...patch, ...stamp() });
    try {
      await save();
      return true;
    } catch (saveError) {
      patchLocal(task.id, task);
      showBoardToast(errorMessage(saveError, failure));
      return false;
    }
  };

  const setFields = useCallback(
    (task: BoardTaskRow, update: TaskFieldsUpdate) => {
      const patch: Partial<BoardTaskRow> = {};
      if (update.priority !== undefined) patch.priority = update.priority;
      if (update.startDate !== undefined) patch.startDate = update.startDate;
      if (update.dueDate !== undefined) patch.dueDate = update.dueDate;
      if (update.notes !== undefined) patch.notes = update.notes;
      if (update.deliverableId !== undefined) patch.deliverableId = update.deliverableId;
      if (update.customFields) patch.customFields = { ...task.customFields, ...update.customFields };
      return withRollback(task, patch, () => boardService.updateFields(task.id, update), 'That change could not be saved.');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patchLocal],
  );

  const setTitle = useCallback(
    (task: BoardTaskRow, title: string) => {
      const trimmed = title.trim();
      if (!trimmed || trimmed === task.title) return Promise.resolve(false);
      return withRollback(task, { title: trimmed }, () => taskService.update(task.id, { title: trimmed }), 'The task could not be renamed.');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patchLocal],
  );

  const setOwners = useCallback(
    (task: BoardTaskRow, owners: BoardPerson[]) =>
      withRollback(
        task,
        { owners, assignedToId: owners[0]?.id ?? null },
        () => taskService.assignMultiple(task.id, owners.map((o) => o.id)),
        'The owners could not be saved.',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patchLocal],
  );

  /** Same write every other board makes, so the task sits in the same column everywhere. */
  const moveStage = useCallback(
    async (task: BoardTaskRow, stageId: string) => {
      if (stageId === task.stageId) return;
      if (stageId === 'not_started' && task.owners.length > 0) {
        showBoardToast('Remove the owner to move this back to Not yet started.');
        return;
      }
      const me = authService.getUser();
      let working = task;
      // In progress means someone owns it, so an unowned task goes to whoever moved it.
      if (stageId === 'owned_in_progress' && task.owners.length === 0 && me) {
        const owner = { id: me.id, name: me.name, avatarUrl: me.avatarUrl ?? null };
        working = { ...task, owners: [owner], assignedToId: me.id };
        try {
          await taskService.assignMultiple(task.id, [me.id]);
          showBoardToast('Assigned to you, since in-progress work needs an owner.');
        } catch (assignError) {
          showBoardToast(errorMessage(assignError, 'The task could not be assigned to you.'));
          return;
        }
      }
      const { status, isCompleted } = mapColumnToStatus(stageId);
      patchLocal(task.id, { owners: working.owners, assignedToId: working.assignedToId, status, isCompleted, stageId, ...stamp() });
      try {
        await moveTaskToColumn(working, stageId, stageLabel(stageId), '', [], me?.name);
      } catch (moveError) {
        patchLocal(task.id, task);
        showBoardToast(errorMessage(moveError, 'The status could not be changed.'));
        return;
      }
      await load(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load, patchLocal],
  );

  const addTask = useCallback(
    async (title: string, context: NewTaskContext) => {
      const trimmed = title.trim();
      if (!projectId || !trimmed) return;
      try {
        const payload: any = { projectId, title: trimmed, type: context.type, status: 'Todo', isCompleted: false };
        if (context.deliverableId && context.deliverableId !== UNASSIGNED_GROUP) payload.deliverableId = context.deliverableId;
        if (context.priority) payload.priority = context.priority;
        const created = await taskService.create(payload);
        if (context.owner) await taskService.assignMultiple(created.id, [context.owner]);
        if (context.stageId && context.stageId !== 'not_started') {
          const { status, isCompleted } = mapColumnToStatus(context.stageId);
          await moveTaskToColumn(
            { ...created, assignedToId: context.owner ?? created.assignedToId, status, isCompleted },
            context.stageId,
            stageLabel(context.stageId),
            '',
            [],
            authService.getUser()?.name,
          );
        }
        await load(true);
      } catch (createError) {
        showBoardToast(errorMessage(createError, 'The task could not be created.'));
      }
    },
    [load, projectId],
  );

  const deleteTasks = useCallback(
    async (taskIds: string[]) => {
      const results = await Promise.allSettled(taskIds.map((id) => taskService.delete(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) showBoardToast(`${failed} task${failed === 1 ? '' : 's'} could not be deleted.`);
      await load(true);
    },
    [load],
  );

  const addGroup = useCallback(
    async (name: string) => {
      if (!projectId || !name.trim()) return;
      try {
        await deliverableService.create(projectId, 'Other', name.trim());
        await load(true);
      } catch (groupError) {
        showBoardToast(errorMessage(groupError, 'The group could not be created.'));
      }
    },
    [load, projectId],
  );

  const renameGroup = useCallback(
    async (groupId: string, name: string) => {
      if (!name.trim()) return;
      try {
        await deliverableService.update(groupId, { customType: name.trim() });
        await load(true);
      } catch (groupError) {
        showBoardToast(errorMessage(groupError, 'The group could not be renamed.'));
      }
    },
    [load],
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      try {
        await deliverableService.delete(groupId);
        await load(true);
      } catch (groupError) {
        showBoardToast(errorMessage(groupError, 'The group could not be deleted.'));
      }
    },
    [load],
  );

  const addColumn = useCallback(
    async (input: { name: string; type: BoardColumnType; labels?: string[] }) => {
      if (!projectId) return null;
      try {
        const column = await boardService.addColumn(projectId, input);
        await load(true);
        return column;
      } catch (columnError) {
        showBoardToast(errorMessage(columnError, 'The column could not be added.'));
        return null;
      }
    },
    [load, projectId],
  );

  const renameColumn = useCallback(
    async (columnId: string, name: string) => {
      if (!projectId || !name.trim()) return;
      try {
        await boardService.updateColumn(projectId, columnId, { name: name.trim() });
        await load(true);
      } catch (columnError) {
        showBoardToast(errorMessage(columnError, 'The column could not be renamed.'));
      }
    },
    [load, projectId],
  );

  const deleteColumn = useCallback(
    async (columnId: string) => {
      if (!projectId) return;
      try {
        await boardService.deleteColumn(projectId, columnId);
        await load(true);
      } catch (columnError) {
        showBoardToast(errorMessage(columnError, 'The column could not be deleted.'));
      }
    },
    [load, projectId],
  );

  return {
    board,
    loading,
    error,
    reload: load,
    patchLocal,
    setFields,
    setTitle,
    setOwners,
    moveStage,
    addTask,
    deleteTasks,
    addGroup,
    renameGroup,
    deleteGroup,
    addColumn,
    renameColumn,
    deleteColumn,
  };
}

export type BoardActions = ReturnType<typeof useBoard>;
