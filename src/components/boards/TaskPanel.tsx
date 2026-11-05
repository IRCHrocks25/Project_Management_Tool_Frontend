import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaArrowRight,
  FaCompressAlt,
  FaEllipsisH,
  FaExpandAlt,
  FaExchangeAlt,
  FaExternalLinkAlt,
  FaLink,
  FaRegClock,
  FaTimes,
  FaTrash,
} from 'react-icons/fa';
import { taskService } from '../../services/task.service';
import { BoardTaskRow, ProjectBoard } from '../../services/board.service';
import { cardDescription } from '../dashboards/taskColumns';
import ConfirmModal from '../ConfirmModal';
import UserAvatar from '../UserAvatar';
import TaskConversation from '../task-detail/TaskConversation';
import TaskAttachmentsList from '../task-detail/TaskAttachmentsList';
import '../task-detail/TaskDetailSideModal.css';
import Popover from './Popover';
import { ColumnCell, OwnerStack, useBoardContext } from './cells';
import {
  BoardColumnDef,
  formatDay,
  GROUP_COLORS,
  PRIORITY_COLOR,
  showBoardToast,
  STAGE_COLOR,
  timeAgo,
  UNASSIGNED_GROUP,
} from './boardConfig';

export type PanelTab = 'updates' | 'files' | 'activity';

interface ActivityRow {
  id: string;
  at: string;
  by: string;
  field: string;
  before?: React.ReactNode;
  after?: React.ReactNode;
  note?: string;
}

const Pill: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className="bv-activity-pill" style={{ background: color }}>{children}</span>
);

const stageColorByLabel = (label: string): string => {
  const known: Record<string, string> = {
    'Not yet started': STAGE_COLOR.not_started,
    'Owned/In Progress': STAGE_COLOR.owned_in_progress,
    'For Approval': STAGE_COLOR.for_approval,
    Revision: STAGE_COLOR.revision,
    'Elliot Review': STAGE_COLOR.elliot_review,
    'Approved/Completed': STAGE_COLOR.approved_completed,
    'QA Before Sending to Client': STAGE_COLOR.qa_before_client,
    'Client Validation': STAGE_COLOR.client_validation,
  };
  return known[label] || '#6b7280';
};

/** Status moves live in the description as history blocks, the same record every other board writes. */
const statusRows = (description: string | null): ActivityRow[] => {
  const blocks = (description || '').split(/\n\n--- Status Change ---/).slice(1);
  let previous: string | undefined;
  return blocks.map((block, index) => {
    const column = (block.match(/\nNew Column:\s*(.+?)(?:\n|$)/)?.[1] || '').trim();
    const by = (block.match(/\nBy:\s*(.+?)(?:\n|$)/)?.[1] || 'Unknown').trim();
    const at = (block.match(/\nAt:\s*(.+?)(?:\n|$)/)?.[1] || '').trim();
    const note = block.match(/\nNotes:\s*([\s\S]+?)(?=\nAttachments?:|\n\n|$)/)?.[1]?.trim();
    const row: ActivityRow = {
      id: `status-${index}`,
      at,
      by,
      field: 'Status',
      before: previous ? <Pill color={stageColorByLabel(previous)}>{previous}</Pill> : undefined,
      after: <Pill color={stageColorByLabel(column)}>{column}</Pill>,
      note,
    };
    previous = column;
    return row;
  });
};

const plain = (value: unknown): React.ReactNode => (value === null || value === undefined || value === '' ? '-' : String(value));
const day = (value: unknown): React.ReactNode => (value ? formatDay(String(value)) : '-');
const priorityPill = (value: unknown): React.ReactNode =>
  value ? <Pill color={PRIORITY_COLOR[String(value)] || '#6b7280'}>{String(value)}</Pill> : '-';
const names = (value: unknown): React.ReactNode => (Array.isArray(value) && value.length ? value.join(', ') : '-');

const logRow = (log: any): ActivityRow | null => {
  const details = log.details || {};
  const base = { id: log.id, at: log.createdAt, by: log.actorName || 'Unknown' };
  switch (log.action) {
    case 'task_created': return { ...base, field: 'Created', after: plain(details.after) };
    case 'title_changed': return { ...base, field: 'Name', before: plain(details.before), after: plain(details.after) };
    case 'due_date_changed': return { ...base, field: 'Due date', before: day(details.before), after: day(details.after) };
    case 'start_date_changed': return { ...base, field: 'Start date', before: day(details.before), after: day(details.after) };
    case 'priority_changed': return { ...base, field: 'Priority', before: priorityPill(details.before), after: priorityPill(details.after) };
    case 'notes_changed': return { ...base, field: 'Notes', before: plain(details.before), after: plain(details.after) };
    case 'owners_changed': return { ...base, field: 'Owner', before: names(details.before), after: names(details.after) };
    case 'group_changed': return { ...base, field: 'Group', before: plain(details.before), after: plain(details.after) };
    case 'field_changed': return { ...base, field: details.field || 'Field', before: plain(details.before), after: plain(details.after) };
    case 'description_edited': return { ...base, field: 'Description', after: 'Edited' };
    case 'attachment_removed': return { ...base, field: 'Files', before: plain(details.filename || details.url), after: 'Removed' };
    case 'question_deleted': return { ...base, field: 'Updates', after: 'Deleted a question' };
    default: return null;
  }
};

const ActivityLog: React.FC<{ task: BoardTaskRow }> = ({ task }) => {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const refreshKey = `${task.id}:${task.updatedAt}`;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([taskService.getActivity(task.id), taskService.getAttachments(task.id)])
      .then(([logs, attachments]) => {
        if (cancelled) return;
        const fileRows: ActivityRow[] = (attachments || []).map((a: any) => ({
          id: `file-${a.id}`,
          at: a.uploadedAt || a.createdAt,
          by: a.uploadedBy?.name || 'Unknown',
          field: 'Files',
          after: a.filename || a.url,
        }));
        const all = [...(logs || []).map(logRow).filter(Boolean) as ActivityRow[], ...statusRows(task.description), ...fileRows];
        all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        setRows(all);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (failed) return <div className="bv-panel-empty">The activity log could not be loaded.</div>;
  if (!rows) return <div className="bv-panel-empty">Loading…</div>;
  if (rows.length === 0) return <div className="bv-panel-empty">Nothing has changed on this task yet.</div>;
  return (
    <div className="bv-activity">
      {rows.map((row) => (
        <div key={row.id} className="bv-activity-row">
          <span className="bv-activity-time" title={row.at ? new Date(row.at).toLocaleString() : undefined}><FaRegClock /> {timeAgo(row.at)}</span>
          <span className="bv-activity-who"><UserAvatar name={row.by} size={26} /> <span className="bv-ellipsis">{row.by}</span></span>
          <span className="bv-activity-field">{row.field}</span>
          <span className="bv-activity-change">
            {row.before !== undefined && <><span className="bv-activity-value">{row.before}</span><FaArrowRight className="bv-activity-arrow" /></>}
            <span className="bv-activity-value">{row.after}</span>
          </span>
          {row.note && <p className="bv-activity-note">{row.note}</p>}
        </div>
      ))}
    </div>
  );
};

interface TaskPanelProps {
  task: BoardTaskRow;
  board: ProjectBoard;
  columns: BoardColumnDef[];
  tab: PanelTab;
  allUsers: any[];
  onTab: (tab: PanelTab) => void;
  onClose: () => void;
  onOpenFullDetails: (task: BoardTaskRow) => void;
}

const TaskPanel: React.FC<TaskPanelProps> = ({ task, board, columns, tab, allUsers, onTab, onClose, onOpenFullDetails }) => {
  const { actions, transferTask } = useBoardContext();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(task.title);
  const menuAnchor = useRef<HTMLButtonElement>(null);
  const brief = useMemo(() => cardDescription(task.description), [task.description]);

  useEffect(() => setTitle(task.title), [task.title, task.id]);

  // The list reloads whenever this callback changes, so it has to stay the same between renders.
  const { patchLocal } = actions;
  const taskId = task.id;
  const syncFiles = useCallback(
    (files: any[]) =>
      patchLocal(taskId, {
        files: files.map((f) => ({ id: f.id, filename: f.filename, kind: f.kind, mimeType: f.mimeType, url: f.url })),
      }),
    [patchLocal, taskId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (expanded) setExpanded(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, onClose]);

  const copyLink = () => {
    setMenuOpen(false);
    const link = `${window.location.origin}/boards/${task.projectId}/${task.id}`;
    navigator.clipboard?.writeText(link).then(
      () => showBoardToast('Task link copied'),
      () => showBoardToast('The link could not be copied'),
    );
  };

  const groupIndex = board.groups.findIndex((g) => g.id === (task.deliverableId || UNASSIGNED_GROUP));
  const color = GROUP_COLORS[Math.max(groupIndex, 0) % GROUP_COLORS.length];
  const currentGroup = board.groups[groupIndex];

  const titleInput = (
    <input
      className="bv-panel-title"
      value={title}
      aria-label="Task name"
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => {
        if (title.trim()) actions.setTitle(task, title);
        else setTitle(task.title);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );

  const tabs = (
    <>
      <div className="bv-panel-tabs" role="tablist">
        {([['updates', 'Updates'], ['files', 'Files'], ['activity', 'Activity log']] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => onTab(key)}>
            {label}
            {key === 'updates' && task.updateCount > 0 && <span className="bv-tab-count">{task.updateCount}</span>}
            {key === 'files' && task.files.length > 0 && <span className="bv-tab-count">{task.files.length}</span>}
          </button>
        ))}
      </div>
      <div className="bv-panel-body">
        {tab === 'updates' && (
          <>
            {brief && <p className="bv-panel-brief">{brief}</p>}
            <TaskConversation isOpen task={task} allUsers={allUsers} activeTab="conversation" />
          </>
        )}
        {tab === 'files' && (
          <TaskAttachmentsList
            taskId={task.id}
            onAttachmentsChange={syncFiles}
          />
        )}
        {tab === 'activity' && <ActivityLog task={task} />}
      </div>
    </>
  );

  const headerTools = (
    <div className="bv-panel-tools">
      {task.owners.length > 0 && <OwnerStack owners={task.owners} size={28} />}
      <button
        type="button"
        className="bv-icon-btn"
        aria-label={expanded ? 'Back to side panel' : 'Open the full task view'}
        title={expanded ? 'Back to side panel' : 'Open the full task view'}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <FaCompressAlt /> : <FaExpandAlt />}
      </button>
      <button ref={menuAnchor} type="button" className="bv-icon-btn" aria-label="Task options" onClick={() => setMenuOpen(!menuOpen)}><FaEllipsisH /></button>
      {expanded && <button type="button" className="bv-icon-btn" aria-label="Close" onClick={onClose}><FaTimes /></button>}
    </div>
  );

  return (
    <div className="tdsm-light-theme">
      {expanded ? (
        <div className="bv-full-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}>
          <div className="bv-full" role="dialog" aria-label={task.title}>
            <div className="bv-full-fields">
              {titleInput}
              <p className="bv-full-sub">in {board.project.name}{currentGroup ? ` · ${currentGroup.name}` : ''}</p>
              <dl>
                {columns.map((column) => (
                  <div key={column.id} className="bv-field">
                    <dt>{column.label}</dt>
                    <dd className={`bv-field-cell bv-cell-${column.id}`}>
                      <ColumnCell columnId={column.id} custom={column.custom} task={task} color={color} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="bv-full-side">
              <div className="bv-full-side-head">{headerTools}</div>
              {tabs}
            </div>
          </div>
        </div>
      ) : (
        <aside className="bv-panel" aria-label={`Task ${task.title}`}>
          <div className="bv-panel-head">
            <button type="button" className="bv-icon-btn" aria-label="Close" onClick={onClose}><FaTimes /></button>
            {titleInput}
            {headerTools}
          </div>
          {tabs}
        </aside>
      )}

      {menuOpen && (
        <Popover anchor={menuAnchor.current} onClose={() => { setMenuOpen(false); setMoveOpen(false); }} width={240} align="right">
          {moveOpen ? (
            <>
              <div className="bv-menu-title">Move to group</div>
              {board.groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`bv-menu-item${group === currentGroup ? ' selected' : ''}`}
                  onClick={() => {
                    setMenuOpen(false);
                    setMoveOpen(false);
                    actions.setFields(task, { deliverableId: group.id === UNASSIGNED_GROUP ? null : group.id });
                  }}
                >
                  {group.name}
                </button>
              ))}
            </>
          ) : (
            <>
              <button type="button" className="bv-menu-item" onClick={() => setMoveOpen(true)}><FaArrowRight /> Move to group</button>
              <button type="button" className="bv-menu-item" onClick={() => { setMenuOpen(false); transferTask(task); }}><FaExchangeAlt /> Send to department</button>
              <button type="button" className="bv-menu-item" onClick={copyLink}><FaLink /> Copy task link</button>
              <button type="button" className="bv-menu-item" onClick={() => { setMenuOpen(false); onOpenFullDetails(task); }}><FaExternalLinkAlt /> Description and full history</button>
              <button type="button" className="bv-menu-item danger" onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}><FaTrash /> Delete</button>
            </>
          )}
        </Popover>
      )}

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onClose();
          actions.deleteTasks([task.id]);
        }}
        title={`Delete "${task.title}"?`}
        message="It will be removed from every board. A record of what was deleted stays in the activity log."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default TaskPanel;
