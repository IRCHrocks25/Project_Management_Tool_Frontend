import React, { useEffect, useMemo, useState } from 'react';
import { BoardPerson, BoardTaskRow } from '../../services/board.service';
import { BoardContext, BoardContextValue } from './cells';
import { orderedColumns, loadPrefs } from './boardConfig';
import TaskPanel, { PanelTab } from './TaskPanel';
import { useBoard } from './useBoard';
import { useTaskOverlays } from './useTaskOverlays';
import './boards.css';

interface TaskPanelHostProps {
  projectId: string;
  taskId: string;
  initialTab?: PanelTab;
  allUsers: any[];
  onClose: () => void;
}

/** Opens the Boards task panel from any page, loading that task's project itself. */
const TaskPanelHost: React.FC<TaskPanelHostProps> = ({ projectId, taskId, initialTab = 'updates', allUsers, onClose }) => {
  const actions = useBoard(projectId);
  const { requestMove, transferTask, openFullDetails, overlays } = useTaskOverlays(actions, allUsers);
  const [tab, setTab] = useState<PanelTab>(initialTab);
  const { board, error } = actions;

  useEffect(() => setTab(initialTab), [initialTab, taskId]);

  const people: BoardPerson[] = useMemo(
    () => allUsers.map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null })).sort((a, b) => a.name.localeCompare(b.name)),
    [allUsers],
  );

  const context: BoardContextValue = useMemo(
    () => ({
      actions,
      people,
      openTask: (_task: BoardTaskRow, next?: PanelTab) => setTab(next || 'updates'),
      transferTask,
      requestMove,
    }),
    [actions, people, transferTask, requestMove],
  );

  const task = board?.tasks.find((t) => t.id === taskId) || null;
  const columns = useMemo(() => {
    const prefs = loadPrefs(projectId);
    return orderedColumns(board?.columns || [], prefs).filter((c) => !prefs.hidden.includes(c.id));
  }, [board?.columns, projectId]);

  if (!board || !task) {
    return (
      <aside className="bv-panel" aria-label="Task">
        <div className="bv-panel-head">
          <button type="button" className="bv-link-btn" onClick={onClose}>Close</button>
        </div>
        <div className="bv-panel-empty">
          {error || (board ? 'That task is no longer on this project.' : 'Loading task…')}
        </div>
      </aside>
    );
  }

  return (
    <BoardContext.Provider value={context}>
      <TaskPanel
        key={task.id}
        task={task}
        board={board}
        columns={columns}
        tab={tab}
        allUsers={allUsers}
        onTab={setTab}
        onClose={onClose}
        onOpenFullDetails={openFullDetails}
      />
      {overlays}
    </BoardContext.Provider>
  );
};

export default TaskPanelHost;
