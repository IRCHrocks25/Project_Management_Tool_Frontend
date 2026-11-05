import React, { useCallback, useState } from 'react';
import { BoardTaskRow } from '../../services/board.service';
import TaskDetailSideModal from '../task-detail/TaskDetailSideModal';
import TransferTaskModal from '../task-detail/TransferTaskModal';
import StatusChangeNotesModal from '../shared/StatusChangeNotesModal';
import { showBoardToast, stageLabel } from './boardConfig';
import type { BoardActions } from './useBoard';

/** The pop-ups a task can open: required status notes, department transfer and full details. */
export function useTaskOverlays(actions: BoardActions, allUsers: any[]) {
  const { board, moveStage, reload } = actions;
  const [pendingMove, setPendingMove] = useState<{ taskId: string; stageId: string } | null>(null);
  const [transfer, setTransfer] = useState<BoardTaskRow | null>(null);
  const [fullDetails, setFullDetails] = useState<BoardTaskRow | null>(null);

  const requestMove = useCallback((task: BoardTaskRow, stageId: string) => {
    if (stageId === task.stageId) return;
    if (stageId === 'not_started' && task.owners.length > 0) {
      showBoardToast('Remove the owner to move this back to Not yet started.');
      return;
    }
    setPendingMove({ taskId: task.id, stageId });
  }, []);

  const overlays = (
    <>
      {pendingMove && (
        <StatusChangeNotesModal
          isOpen
          targetColumnLabel={stageLabel(pendingMove.stageId)}
          notesRequired
          attachmentMode="multi"
          onClose={() => setPendingMove(null)}
          onSave={async (notes, links) => {
            const task = board?.tasks.find((t) => t.id === pendingMove.taskId);
            if (!task) {
              setPendingMove(null);
              return;
            }
            // Stays open if the save fails, so the notes aren't lost.
            if (await moveStage(task, pendingMove.stageId, notes, links)) setPendingMove(null);
          }}
        />
      )}

      {transfer && (
        <TransferTaskModal
          task={{
            id: transfer.id,
            title: transfer.title,
            type: transfer.type,
            projectId: transfer.projectId,
            deliverableId: transfer.deliverableId,
            assignees: transfer.owners.map((o) => ({ userId: o.id })),
          }}
          allUsers={allUsers}
          onClose={() => setTransfer(null)}
          onTransferred={() => {
            setTransfer(null);
            reload(true);
          }}
        />
      )}

      <TaskDetailSideModal
        isOpen={!!fullDetails}
        task={fullDetails}
        onClose={() => {
          setFullDetails(null);
          reload(true);
        }}
        allUsers={allUsers}
        getProjectName={() => board?.project.name || ''}
        onTaskUpdate={() => reload(true)}
      />
    </>
  );

  return { requestMove, transferTask: setTransfer, openFullDetails: setFullDetails, overlays };
}
