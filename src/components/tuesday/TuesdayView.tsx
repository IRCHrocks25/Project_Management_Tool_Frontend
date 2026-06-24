import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaBell,
  FaCheckCircle,
  FaChevronDown,
  FaCog,
  FaComment,
  FaComments,
  FaFolder,
  FaFolderOpen,
  FaHistory,
  FaPlus,
  FaSignOutAlt,
  FaTicketAlt,
  FaUser,
  FaUsers,
} from 'react-icons/fa';
import {
  ColumnDef,
  getCoreRowModel,
  getExpandedRowModel,
  Row,
  useReactTable,
} from '@tanstack/react-table';
import { authService } from '../../services/auth.service';
import { useBoardView } from './hooks/useBoardView';
import { useExpansionState } from './hooks/useExpansionState';
import { useTuesdayMutations } from './hooks/useTuesdayMutations';
import { useTuesdayFilters } from './hooks/useTuesdayFilters';
import TuesdayToolbar, { ToolbarOptions } from './TuesdayToolbar';
import TuesdayPagination from './TuesdayPagination';
import { applySort } from './applySort';
import { KANBAN_COLUMNS } from '../../utils/taskKanbanColumn';
import { TuesdayRow, buildRows, rowId, getRowSubRows, unassignedCountFor } from './rowTypes';
import TuesdayHeader from './TuesdayHeader';
import NameCell from './cells/NameCell';
import RowActionsCell from './cells/RowActionsCell';
import StatusCell from './cells/StatusCell';
import PriorityCell from './cells/PriorityCell';
import TimelineCell from './cells/TimelineCell';
import PMCell from './cells/PMCell';
import DepartmentCell from './cells/DepartmentCell';
import AssigneeCell from './cells/AssigneeCell';
import TaskDetailSideModal from '../task-detail/TaskDetailSideModal';
import TransferTaskModal from '../task-detail/TransferTaskModal';
import AddTaskModal from '../AddTaskModal';
import CreateProjectModal from '../CreateProjectModal';
import StatusChangeNotesModal from '../shared/StatusChangeNotesModal';
import { BoardTask, BoardViewSort } from '../../services/boardView.service';
import AddTaskRow from './AddTaskRow';
import AddDeliverableRow from './AddDeliverableRow';
import NotificationsModal from '../NotificationsModal';
import LiveChatPanel from '../LiveChatPanel';
import SubmitTicketModal from '../SubmitTicketModal';
import UserAvatar from '../UserAvatar';
import { notificationService } from '../../services/notification.service';
import { useUnreadChatCount } from '../../hooks/useUnreadChatCount';
import '../Dashboard.css';
import './styles/tuesday.css';

// Walks up the row's parents to find the project row (kind='project'),
// so deliverable/task rows can render inherited columns (priority, PM).
function findProjectRow(row: Row<TuesdayRow>): TuesdayRow | undefined {
  let cur: Row<TuesdayRow> | undefined = row;
  while (cur) {
    if (cur.original.kind === 'project') return cur.original;
    cur = cur.getParentRow();
  }
  return undefined;
}

const TuesdayView: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [expanded, setExpanded] = useExpansionState();
  const filterControls = useTuesdayFilters();

  // L1 sort happens server-side and accepts only the columns the backend
  // can ORDER BY at the project level. Anything else (notably 'department',
  // which is non-sortable here, or a stale URL param) gets dropped at the
  // boundary so the network call never sends it. Within-project sort at
  // L2/L3 still uses the full SortState via applySort below.
  const SERVER_SORT_COLUMNS = new Set<BoardViewSort['column']>(
    ['name', 'priority', 'timeline', 'pm', 'status'],
  );
  const serverSort: BoardViewSort | null =
    filterControls.sort && SERVER_SORT_COLUMNS.has(filterControls.sort.column as BoardViewSort['column'])
      ? { column: filterControls.sort.column as BoardViewSort['column'], direction: filterControls.sort.direction }
      : null;

  // Pass filter/sort/page state straight through to useBoardView. The hook
  // normalizes/serializes via `argsKey` so spurious refetches from new
  // Set/array identities don't trigger network calls — only real value
  // changes do. Sets are converted to arrays here (the hook's argsKey
  // sorts them before joining, so toggle order doesn't matter).
  const {
    data, totalCount, page: serverPage, pageSize: serverPageSize, totalPages,
    loading, refetching, error, setData, refetch,
  } = useBoardView({
    page: filterControls.page,
    pageSize: 50,
    search: filterControls.state.search,
    dept: Array.from(filterControls.state.department),
    pm: Array.from(filterControls.state.pm),
    status: Array.from(filterControls.state.status),
    priority: Array.from(filterControls.state.priority),
    assignee: Array.from(filterControls.state.assignee),
    sort: serverSort,
  });
  const mutations = useTuesdayMutations(setData);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const skipRefreshUntilRef = useRef<number | null>(null);

  // Fetch all users once for the AssigneePicker + TransferTaskModal.
  // Same source as PMDashboard / TaskDetailSideModal usage.
  const [allUsers, setAllUsers] = useState<any[]>([]);
  useEffect(() => {
    authService.getAllUsers().then((u: any[]) => setAllUsers(u || [])).catch(() => setAllUsers([]));
  }, []);
  const userNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of allUsers) m.set(u.id, u.name || 'Unassigned');
    return m;
  }, [allUsers]);
  const getUserName = (id: string) => userNameMap.get(id) || 'Unassigned';
  const projectNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of data || []) m.set(p.id, p.name);
    return m;
  }, [data]);
  const getProjectName = (projectId: string) => projectNameMap.get(projectId) || '';

  // TaskDetailSideModal + TransferTaskModal state. `openTaskInitialTab`
  // lets the chat-bubble icon open the modal directly on the Conversation
  // tab; the diamond/name path leaves it at default ('details').
  const [openTask, setOpenTask] = useState<any | null>(null);
  const [openTaskInitialTab, setOpenTaskInitialTab] = useState<'details' | 'conversation'>('details');
  const [transferTask, setTransferTask] = useState<any | null>(null);

  // "More fields" → AddTaskModal pre-filled with the inline draft
  const [addTaskModalState, setAddTaskModalState] = useState<{
    projectId: string; deliverableId: string | null; type: string; initialTitle: string;
  } | null>(null);

  // "+ Add project" → existing CreateProjectModal flow (PMDashboard's modal)
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showLiveChatPanel, setShowLiveChatPanel] = useState(false);
  const [showSubmitTicketModal, setShowSubmitTicketModal] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChatCount, refreshUnreadChat] = useUnreadChatCount();

  // L3 status-change modal flow. Tuesday opens the shared
  // StatusChangeNotesModal on EVERY task status transition (notes
  // required, multi-link attachments). The mutation only fires from the
  // modal's onSave — Cancel discards.
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    projectId: string;
    deliverableId: string;
    task: BoardTask;
    newColumnLabel: string;
  } | null>(null);
  const [statusChangeSaving, setStatusChangeSaving] = useState(false);

  // Server returns the projects already filtered (search/dept/pm/status/
  // priority/assignee), paginated (50 per page), and L1-sorted (project
  // level). applySort only reorders deliverables/tasks *within* each
  // loaded project — pass-through when no sort is active.
  const sortedData = useMemo(
    () => (data ? applySort(data, filterControls.sort) : null),
    [data, filterControls.sort],
  );

  const rows = useMemo<TuesdayRow[]>(
    () => (sortedData ? buildRows(sortedData) : []),
    [sortedData],
  );

  // Scroll to top after the server confirms a page change. Tracking the
  // *server-confirmed* page (not filterControls.page) so the scroll
  // happens once new data has arrived — users still see their previous
  // page's content during the brief refetch, then land at the top of
  // the new page when it renders. Skips initial mount so the user's
  // own scroll position isn't disturbed when arriving via deep link.
  const lastServerPageRef = useRef<number | null>(null);
  useEffect(() => {
    if (data === null) return;
    if (lastServerPageRef.current !== null && lastServerPageRef.current !== serverPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    lastServerPageRef.current = serverPage;
  }, [serverPage, data]);

  // 3-state sort cycle: unsorted → asc → desc → unsorted. Click a
  // different column resets to asc on that column.
  const handleColumnSort = (columnKey: string) => {
    const current = filterControls.sort;
    if (!current || current.column !== columnKey) {
      filterControls.setSort({ column: columnKey, direction: 'asc' });
    } else if (current.direction === 'asc') {
      filterControls.setSort({ column: columnKey, direction: 'desc' });
    } else {
      filterControls.setSort(null);
    }
  };

  // Expand all walks the *currently visible* (filtered + sorted) tree
  // and adds expansion entries for every project + every (project,
  // deliverable) pair. Filtered-out rows are not in `sortedData`, so
  // they're inherently excluded — invisible projects don't get
  // pre-expanded behind the user's back.
  const handleExpandAll = () => {
    if (!sortedData) return;
    const next: Record<string, boolean> = {};
    for (const project of sortedData) {
      next[`p:${project.id}`] = true;
      for (const deliverable of project.deliverables) {
        next[`d:${project.id}:${deliverable.id}`] = true;
      }
    }
    setExpanded(next);
  };

  // Collapse all clears the expansion state. useExpansionState's writer
  // drops the URL `?expanded=` param when the resulting set is empty.
  const handleCollapseAll = () => {
    setExpanded({});
  };

  // Toolbar option lists derived from the loaded board data. Each list is
  // stable across renders unless `data` changes. Filter logic itself is
  // wired in Step 2 — this just supplies the dropdown contents.
  const toolbarOptions = useMemo<ToolbarOptions>(() => {
    const dept = new Set<string>();
    const pmMap = new Map<string, { name: string; avatarUrl: string | null }>();
    const assigneeMap = new Map<string, { name: string; avatarUrl: string | null }>();
    for (const p of data || []) {
      if (p.pm) pmMap.set(p.pm.id, { name: p.pm.name, avatarUrl: p.pm.avatarUrl });
      for (const d of p.deliverables) {
        for (const t of d.tasks) {
          if (t.type) dept.add(t.type);
          for (const a of t.assignees) {
            if (!assigneeMap.has(a.id)) assigneeMap.set(a.id, { name: a.name, avatarUrl: a.avatarUrl });
          }
        }
      }
    }
    return {
      department: Array.from(dept).sort().map((d) => ({ value: d, label: d })),
      pm: Array.from(pmMap.entries())
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([id, u]) => ({ value: id, label: u.name })),
      status: KANBAN_COLUMNS.map((c) => ({
        value: c.id,
        label: c.label,
        hint: undefined,
      })),
      priority: ['Urgent', 'High', 'Medium', 'Low'].map((p) => ({ value: p, label: p })),
      assignee: Array.from(assigneeMap.entries())
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([id, u]) => ({ value: id, label: u.name })),
    };
  }, [data]);

  const columns = useMemo<ColumnDef<TuesdayRow>[]>(
    () => [
      { id: 'name' },
      // Row-action icons. Sort/filter not applicable — column is purely
      // for action affordances; TanStack defaults disable both already
      // since no accessor / accessorKey is provided.
      { id: 'actions', enableSorting: false, enableColumnFilter: false },
      { id: 'status' }, { id: 'priority' }, { id: 'timeline' },
      { id: 'pm' }, { id: 'clientType' }, { id: 'department' }, { id: 'assignee' },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: getRowSubRows,
    getRowId: (row) => rowId(row),
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const loadUnreadCount = useCallback(async () => {
    try {
      if (skipRefreshUntilRef.current && Date.now() < skipRefreshUntilRef.current) {
        return;
      }
      const count = await notificationService.getUnreadCount();
      setUnreadNotifications(count);
    } catch (loadError) {
      console.error('Failed to load unread count:', loadError);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    notificationService.connectSocket();
    const unsub = notificationService.onNewNotification(() => {
      loadUnreadCount();
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [loadUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.avatar-dropdown-container')) {
        setShowAvatarDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = useCallback(() => {
    authService.logout();
    navigate('/');
  }, [navigate]);

  const handleOpenTaskConversationFromNotification = useCallback(
    (projectId: string, taskId: string, tab: 'details' | 'conversation' = 'details') => {
      navigate(`/project/${projectId}?task=${taskId}&tab=${tab}`);
    },
    [navigate],
  );

  const renderRow = (row: Row<TuesdayRow>) => {
    const r = row.original;
    const projectRow = findProjectRow(row);
    const project = projectRow && projectRow.kind === 'project' ? projectRow.data : null;
    const pm = project?.pm ?? null;
    const projectPriority = project?.priority ?? '';
    const clientType = project?.clientType ?? null;
    const isUnassigned = r.kind === 'deliverable' && r.data.id === '__unassigned__';
    const trClass =
      r.kind === 'project' ? 'tuesday-tr-project'
      : isUnassigned ? 'tuesday-tr-deliverable tuesday-tr-unassigned'
      : r.kind === 'deliverable' ? 'tuesday-tr-deliverable'
      : 'tuesday-tr-task';

    // Derive level-specific edit callbacks
    const onRenameProject = r.kind === 'project'
      ? (newName: string) => mutations.editProjectName(r.data, newName)
      : undefined;

    const onChangeProjectPriority = r.kind === 'project'
      ? (newPriority: string) => mutations.editProjectPriority(r.data, newPriority)
      : undefined;

    const onRenameDeliverable = (r.kind === 'deliverable' && !isUnassigned && project)
      ? (newName: string) => mutations.editDeliverableName(project.id, r.data, newName)
      : undefined;

    const onChangeDeliverableStatus = (r.kind === 'deliverable' && !isUnassigned && project)
      ? (newStatus: string) => mutations.editDeliverableStatus(project.id, r.data, newStatus)
      : undefined;

    const onChangeTaskDueDate = (r.kind === 'task' && project)
      ? (newDate: string | null) => mutations.editTaskDueDate(project.id, r.deliverableId, r.data, newDate)
      : undefined;

    // L3 status changes route through the shared StatusChangeNotesModal
    // (notes required + multi-link attachments). The dropdown selection
    // only sets pending state; the actual mutation fires from modal Save.
    const onChangeTaskStatus = (r.kind === 'task' && project)
      ? (newColumnLabel: string) => setPendingStatusChange({
          projectId: project.id,
          deliverableId: r.deliverableId,
          task: r.data,
          newColumnLabel,
        })
      : undefined;

    const onChangeTaskAssignees = (r.kind === 'task' && project && allUsers.length > 0)
      ? (newUserIds: string[]) => mutations.editTaskAssignees(project.id, r.deliverableId, r.data, newUserIds, allUsers)
      : undefined;

    const onOpenTaskDetail = r.kind === 'task'
      ? () => {
          setOpenTaskInitialTab('details');
          setOpenTask({ ...r.data, projectId: project?.id, deliverableId: r.deliverableId });
        }
      : undefined;

    const onOpenTaskConversation = r.kind === 'task'
      ? () => {
          setOpenTaskInitialTab('conversation');
          setOpenTask({ ...r.data, projectId: project?.id, deliverableId: r.deliverableId });
        }
      : undefined;

    const onOpenProjectDetail = r.kind === 'project'
      ? () => navigate(`/project/${r.data.id}`)
      : undefined;

    const onOpenTransfer = r.kind === 'task'
      ? () => setTransferTask({
          id: r.data.id, title: r.data.title, type: r.data.type, projectId: project?.id,
          deliverableId: r.deliverableId, assignees: r.data.assignees.map((a) => ({ userId: a.id })),
        })
      : undefined;

    return (
      <tr key={row.id} className={trClass}>
        <td className="tuesday-td">
          <NameCell
            row={r}
            depth={row.depth}
            canExpand={row.getCanExpand()}
            isExpanded={row.getIsExpanded()}
            onToggleExpand={row.getToggleExpandedHandler()}
            unassignedCount={r.kind === 'project' ? unassignedCountFor(r.data) : undefined}
            onRenameProject={onRenameProject}
            onRenameDeliverable={onRenameDeliverable}
            onOpenTaskDetail={onOpenTaskDetail}
          />
        </td>
        <td className="tuesday-td tuesday-td-actions">
          <RowActionsCell
            row={r}
            onOpenTaskDetail={onOpenTaskDetail}
            onOpenTaskConversation={onOpenTaskConversation}
            onOpenProjectDetail={onOpenProjectDetail}
          />
        </td>
        <td className="tuesday-td">
          <StatusCell
            row={r}
            onChangeDeliverableStatus={onChangeDeliverableStatus}
            onChangeTaskStatus={onChangeTaskStatus}
            anyFilterActive={filterControls.anyActive}
          />
        </td>
        <td className="tuesday-td">
          <PriorityCell row={r} projectPriority={projectPriority} onChangeProjectPriority={onChangeProjectPriority} />
        </td>
        <td className="tuesday-td">
          <TimelineCell row={r} onChangeTaskDueDate={onChangeTaskDueDate} />
        </td>
        <td className="tuesday-td"><PMCell row={r} projectPm={pm} /></td>
        <td className="tuesday-td">
          {clientType ? (
            <span className="tuesday-dept-cell" title={clientType}>{clientType}</span>
          ) : (
            <span className="tuesday-muted">-</span>
          )}
        </td>
        <td className="tuesday-td">
          <DepartmentCell row={r} onOpenTransfer={onOpenTransfer} />
        </td>
        <td className="tuesday-td">
          <AssigneeCell
            row={r}
            projectPm={pm}
            allUsers={allUsers.length > 0 ? allUsers : undefined}
            getUserName={getUserName}
            onChangeTaskAssignees={onChangeTaskAssignees}
          />
        </td>
      </tr>
    );
  };

  return (
    <div className="dashboard premium" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="dashboard-nav premium-nav">
        <div className="nav-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user?.role !== 'Project Manager' && !!user?.isTeamLead && (
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#64748b',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.color = '#667eea';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                ← My Department
              </button>
            )}
            <h2 className="logo">Katalyst PM</h2>
          </div>
          <div className="nav-right">
            {user?.role === 'Project Manager' && (
              <button
                onClick={() => setShowCreateProject(true)}
                className="btn-primary btn-primary-premium"
                style={{ marginRight: '1rem' }}
              >
                <FaPlus className="btn-icon" />
                New Project
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/tuesday')}
              style={{
                marginRight: '1rem',
                padding: '0.2rem 0.25rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Hierarchical view: Project → Deliverable → Task"
            >
              <img
                src="https://cdn.katalyst-crm.com/t1/cloudinary/Tuesday_iruicl.png"
                alt="Tuesday"
                style={{ height: '28px', width: 'auto', display: 'block' }}
              />
            </button>

            <button
              className="notification-button"
              onClick={() => setShowLiveChatPanel(true)}
              style={{
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                marginRight: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: '1.25rem',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#667eea';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#64748b';
              }}
              title="Live Chat"
            >
              <FaComments />
              {unreadChatCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-0.25rem',
                    right: '-0.25rem',
                    minWidth: '1.5rem',
                    height: '1.5rem',
                    padding: '0 0.375rem',
                    borderRadius: '0.75rem',
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </span>
              )}
            </button>

            <button
              className="notification-button"
              onClick={() => setShowNotificationsModal(true)}
              style={{
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                marginRight: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: '1.25rem',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#667eea';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#64748b';
              }}
            >
              <FaBell />
              {unreadNotifications > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-0.25rem',
                    right: '-0.25rem',
                    minWidth: '1.5rem',
                    height: '1.5rem',
                    padding: '0 0.375rem',
                    borderRadius: '0.75rem',
                    background: unreadNotifications >= 10
                      ? '#dc2626'
                      : unreadNotifications >= 5
                        ? '#f59e0b'
                        : '#10b981',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </button>

            <div className="avatar-dropdown-container" ref={dropdownRef}>
              <button
                className="avatar-button"
                onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
              >
                <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} className="avatar premium-avatar" />
                <FaChevronDown className="dropdown-chevron" />
              </button>
              {showAvatarDropdown && (
                <div className="avatar-dropdown">
                  <div className="dropdown-header">
                    <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} className="avatar premium-avatar" />
                    <div>
                      <div className="dropdown-name">{user?.name}</div>
                      <div className="dropdown-email">{user?.email}</div>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  {user?.role !== 'Project Manager' && !!user?.isTeamLead && (
                    <button
                      onClick={() => {
                        setShowAvatarDropdown(false);
                        navigate('/dashboard');
                      }}
                      className="dropdown-item"
                    >
                      <FaFolderOpen className="dropdown-icon" />
                      My Department
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/clients');
                    }}
                    className="dropdown-item"
                  >
                    <FaFolder className="dropdown-icon" />
                    Clients
                  </button>
                  <button
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/users');
                    }}
                    className="dropdown-item"
                  >
                    <FaUsers className="dropdown-icon" />
                    Users
                  </button>
                  <button
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/profile');
                    }}
                    className="dropdown-item"
                  >
                    <FaUser className="dropdown-icon" />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      setShowNotificationsModal(true);
                    }}
                    className="dropdown-item"
                  >
                    <FaBell className="dropdown-icon" />
                    Notifications
                  </button>
                  <button
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      setShowSubmitTicketModal(true);
                    }}
                    className="dropdown-item"
                  >
                    <FaTicketAlt className="dropdown-icon" />
                    Submit Ticket
                  </button>
                  <button
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/settings');
                    }}
                    className="dropdown-item"
                  >
                    <FaCog className="dropdown-icon" />
                    Settings
                  </button>
                  <div className="dropdown-divider"></div>
                  <button
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/pm-activity-log');
                    }}
                    className="dropdown-item"
                  >
                    <FaHistory className="dropdown-icon" />
                    PM Activity Log
                  </button>
                  <button
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/department-activity-log');
                    }}
                    className="dropdown-item"
                  >
                    <FaUsers className="dropdown-icon" />
                    Department Activity Log
                  </button>
                  <button
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/forum');
                    }}
                    className="dropdown-item"
                  >
                    <FaComment className="dropdown-icon" />
                    Forum
                  </button>
                  <button
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/completed-projects');
                    }}
                    className="dropdown-item"
                  >
                    <FaCheckCircle className="dropdown-icon" />
                    Completed Projects
                  </button>
                  <div className="dropdown-divider"></div>
                  <button onClick={handleLogout} className="dropdown-item dropdown-item-danger">
                    <FaSignOutAlt className="dropdown-icon" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="tuesday-root" style={{ flex: 1 }}>
        <div className="tuesday-page">
          <div className="tuesday-pageheader">
            <div>
              <h1 className="tuesday-pagetitle">
                <img
                  src="https://cdn.katalyst-crm.com/t1/cloudinary/Tuesday_iruicl.png"
                  alt="Tuesday"
                  style={{ height: '36px', width: 'auto', display: 'block' }}
                />
              </h1>
              <p className="tuesday-pagesub">All projects, hierarchical view.</p>
            </div>
          </div>

        {/* Toolbar — search, filter chips, expand/collapse. State + URL
            persistence in useTuesdayFilters; filter/sort logic wired in
            later steps of Phase 5a. Hidden until data exists so the
            chips don't render with empty option lists on first paint. */}
        {data !== null && (
          <TuesdayToolbar
            controls={filterControls}
            options={toolbarOptions}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
          />
        )}

        {/* States are mutually exclusive based on whether data exists.
            Once data is non-null the table stays mounted; background
            refetches don't blank the view. */}
        {data === null && loading && <div className="tuesday-loading">Loading…</div>}
        {data === null && !loading && error && <div className="tuesday-error">Failed to load: {error}</div>}
        {data !== null && rows.length === 0 && (
          <div className="tuesday-empty">
            {filterControls.anyActive ? (
              <>
                <h2 className="tuesday-empty-title">No matches</h2>
                <p className="tuesday-empty-sub">
                  No tasks match the current filters.{' '}
                  <button
                    type="button"
                    className="tuesday-clear-filters"
                    style={{ height: 'auto', padding: 0 }}
                    onClick={filterControls.clearAll}
                  >
                    Clear filters
                  </button>
                  {' '}to reset.
                </p>
              </>
            ) : (
              <>
                <h2 className="tuesday-empty-title">No projects yet</h2>
                <p className="tuesday-empty-sub">There are no active projects visible to you. New projects will show up here.</p>
              </>
            )}
          </div>
        )}
        {data !== null && rows.length > 0 && (
          <table className="tuesday-table">
            <TuesdayHeader sort={filterControls.sort} onSort={handleColumnSort} />
            <tbody>
              {(() => {
                const rowList = table.getRowModel().rows;
                const out: React.ReactNode[] = [];
                for (let i = 0; i < rowList.length; i++) {
                  const tr = rowList[i];
                  out.push(renderRow(tr));
                  const r = tr.original;

                  // Inject "+ Add task" placeholder at the bottom of every
                  // expanded deliverable. Two cases:
                  //   (a) deliverable expanded with no tasks → placeholder
                  //       appears immediately after the deliverable row
                  //   (b) deliverable expanded with N tasks → placeholder
                  //       appears after the LAST task of that deliverable
                  let bucketProjectId: string | null = null;
                  let bucketDeliverableId: string | null = null;     // null = Unassigned bucket
                  let bucketDeliverableEntityId: string | null = null;

                  if (r.kind === 'deliverable' && tr.getIsExpanded() && r.subRows.length === 0) {
                    bucketProjectId = r.projectId;
                    bucketDeliverableId = r.data.id === '__unassigned__' ? null : r.data.id;
                    bucketDeliverableEntityId = r.data.id;
                  } else if (r.kind === 'task') {
                    const next = rowList[i + 1];
                    const nextRow = next?.original;
                    const sameBucket = !!nextRow
                      && nextRow.kind === 'task'
                      && nextRow.projectId === r.projectId
                      && nextRow.deliverableId === r.deliverableId;
                    if (!sameBucket) {
                      bucketProjectId = r.projectId;
                      bucketDeliverableId = r.deliverableId === '__unassigned__' ? null : r.deliverableId;
                      bucketDeliverableEntityId = r.deliverableId;
                    }
                  }

                  if (bucketProjectId && bucketDeliverableEntityId) {
                    const proj = data?.find((p) => p.id === bucketProjectId);
                    const deliv = proj?.deliverables.find((d) => d.id === bucketDeliverableEntityId);
                    const tasks = deliv?.tasks || [];
                    const dominantType = tasks.length > 0
                      ? tasks.reduce<Record<string, number>>((acc, t) => {
                          acc[t.type] = (acc[t.type] || 0) + 1; return acc;
                        }, {})
                      : null;
                    let inherited = 'General';
                    if (dominantType) {
                      let bestCount = 0;
                      for (const [type, count] of Object.entries(dominantType)) {
                        if (count > bestCount) { bestCount = count; inherited = type; }
                      }
                    }
                    out.push(
                      <AddTaskRow
                        key={`add:${bucketProjectId}:${bucketDeliverableEntityId}`}
                        projectId={bucketProjectId}
                        deliverableId={bucketDeliverableId}
                        siblingTasks={tasks}
                        taskColumnCount={8}
                        onCreate={(title, type) => mutations.createTask(bucketProjectId!, bucketDeliverableId, title, type)}
                        onOpenMoreFields={(title) => setAddTaskModalState({
                          projectId: bucketProjectId!,
                          deliverableId: bucketDeliverableId,
                          type: inherited,
                          initialTitle: title,
                        })}
                      />,
                    );
                  }

                  // Add-deliverable placeholder: emit when this row is the
                  // last visible row of an expanded project's subtree (i.e.
                  // the next row is either undefined or another project).
                  // Three trigger cases:
                  //   1. current row IS an expanded project with no deliverables
                  //   2. current row is the last child (deliverable or task)
                  //      AND the next row is a project or end-of-list
                  const next = rowList[i + 1];
                  const nextIsProjectOrEnd = !next || next.original.kind === 'project';

                  let addDelivProjectId: string | null = null;
                  if (r.kind === 'project') {
                    if (tr.getIsExpanded() && r.subRows.length === 0) {
                      addDelivProjectId = r.data.id;
                    }
                  } else if (nextIsProjectOrEnd) {
                    addDelivProjectId = r.kind === 'deliverable'
                      ? r.projectId
                      : r.projectId;
                  }

                  if (addDelivProjectId) {
                    out.push(
                      <AddDeliverableRow
                        key={`add-deliv:${addDelivProjectId}`}
                        projectId={addDelivProjectId}
                        taskColumnCount={8}
                        onCreate={(type, customType) =>
                          mutations.createDeliverable(addDelivProjectId!, type, customType)
                        }
                      />,
                    );
                  }
                }
                return out;
              })()}
            </tbody>
          </table>
        )}

        {/* Pagination footer — only renders when data is loaded. Hidden
            during initial loading and during the empty-result state
            (TuesdayPagination returns null when totalCount === 0). */}
        {data !== null && (
          <TuesdayPagination
            currentPage={serverPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={serverPageSize}
            refetching={refetching}
            onPageChange={filterControls.setPage}
          />
        )}
        </div>
      </div>

      <TaskDetailSideModal
        isOpen={!!openTask}
        task={openTask}
        onClose={() => setOpenTask(null)}
        allUsers={allUsers}
        getProjectName={getProjectName}
        initialTab={openTaskInitialTab}
        onTaskUpdate={(updated) => {
          // Patch local state with whatever fields the modal returns. We do a
          // best-effort merge — if the modal mutates fields we don't handle,
          // the next refetch (manual reload) will reconcile.
          if (!openTask?.projectId || !openTask?.deliverableId) return;
          setData((prev) => {
            if (!prev) return prev;
            return prev.map((p) => p.id !== openTask.projectId ? p : ({
              ...p,
              deliverables: p.deliverables.map((d) => d.id !== openTask.deliverableId ? d : ({
                ...d,
                tasks: d.tasks.map((t) => t.id !== updated.id ? t : ({
                  ...t,
                  title: updated.title ?? t.title,
                  status: updated.status ?? t.status,
                  isCompleted: updated.isCompleted ?? t.isCompleted,
                  description: updated.description ?? t.description,
                  dueDate: updated.dueDate ?? t.dueDate,
                })),
              })),
            }));
          });
        }}
      />

      {transferTask && (
        <TransferTaskModal
          task={transferTask}
          allUsers={allUsers}
          onClose={() => setTransferTask(null)}
          onTransferred={() => {
            // Transfer touches type + assignees + writes a transfer record.
            // Refetch in the background so the table stays mounted (preserves
            // scroll + expansion) while the new tree loads.
            setTransferTask(null);
            refetch();
          }}
        />
      )}

      {addTaskModalState && (
        <AddTaskModal
          isOpen={true}
          onClose={() => setAddTaskModalState(null)}
          projectId={addTaskModalState.projectId}
          taskType={addTaskModalState.type}
          initialTitle={addTaskModalState.initialTitle}
          initialDeliverableId={addTaskModalState.deliverableId ?? undefined}
          onTaskAdded={() => {
            setAddTaskModalState(null);
            refetch();
          }}
        />
      )}

      {pendingStatusChange && (
        <StatusChangeNotesModal
          isOpen={true}
          targetColumnLabel={pendingStatusChange.newColumnLabel}
          notesRequired={true}                    // Tuesday divergence — see CLAUDE.md
          attachmentMode="multi"
          saving={statusChangeSaving}
          onClose={() => {
            if (statusChangeSaving) return;
            setPendingStatusChange(null);
          }}
          onSave={async (notes, attachments) => {
            const ctx = pendingStatusChange;
            if (!ctx) return;
            setStatusChangeSaving(true);
            try {
              await mutations.editTaskStatus(
                ctx.projectId,
                ctx.deliverableId,
                ctx.task,
                ctx.newColumnLabel,
                notes,
                attachments,
              );
              setPendingStatusChange(null);
            } finally {
              setStatusChangeSaving(false);
            }
          }}
        />
      )}

      {showCreateProject && (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onSuccess={() => {
            setShowCreateProject(false);
            refetch();
          }}
          onBulkSuccess={() => {
            setShowCreateProject(false);
            refetch();
          }}
        />
      )}

      <LiveChatPanel
        isOpen={showLiveChatPanel}
        onClose={() => {
          setShowLiveChatPanel(false);
          refreshUnreadChat();
        }}
        accentColor="#667eea"
      />

      <SubmitTicketModal
        isOpen={showSubmitTicketModal}
        onClose={() => setShowSubmitTicketModal(false)}
        accentColor="#667eea"
      />

      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        onUpdate={loadUnreadCount}
        onOpenTaskConversation={handleOpenTaskConversationFromNotification}
        onMarkAllAsRead={() => {
          setUnreadNotifications(0);
          skipRefreshUntilRef.current = Date.now() + 5000;
          setTimeout(() => {
            skipRefreshUntilRef.current = null;
            loadUnreadCount();
          }, 5000);
        }}
      />
    </div>
  );
};

export default TuesdayView;
