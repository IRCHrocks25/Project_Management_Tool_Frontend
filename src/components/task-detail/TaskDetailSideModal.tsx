import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRight, FaRegCommentDots } from 'react-icons/fa';
import { deliverableService } from '../../services/deliverable.service';
import { taskService } from '../../services/task.service';
import './TaskDetailSideModal.css';
import TaskHeader from './TaskHeader';
import TaskMetaPanel from './TaskMetaPanel';
import TaskAttachmentsList from './TaskAttachmentsList';
import TaskActivityHistory from './TaskActivityHistory';
import TaskConversation from './TaskConversation';
import TransferTaskModal from './TransferTaskModal';

interface TaskDetailSideModalProps {
  isOpen: boolean;
  task: any | null;
  onClose: () => void;
  allUsers: any[];
  getProjectName: (projectId: string) => string;
  getProjectPmName?: (projectId: string) => string;
  onTaskUpdate?: (updatedTask: any) => void;
  onTaskDeleted?: (taskId: string) => void;
  initialTab?: 'details' | 'conversation';
  /** Pinned below the scrolling body, e.g. the task's next-step actions */
  footer?: React.ReactNode;
}

const TaskDetailSideModal: React.FC<TaskDetailSideModalProps> = ({
  isOpen,
  task,
  onClose,
  allUsers,
  getProjectName,
  getProjectPmName,
  onTaskUpdate,
  onTaskDeleted,
  initialTab = 'details',
  footer,
}) => {
  const navigate = useNavigate();
  const [resolvedTask, setResolvedTask] = useState<any | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [loadingTaskHistory, setLoadingTaskHistory] = useState(false);
  const [taskTransfers, setTaskTransfers] = useState<any[]>([]);
  const [loadingTaskTransfers, setLoadingTaskTransfers] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'conversation'>(initialTab);
  const displayTask = resolvedTask || task;

  const handleInternalClose = useCallback(() => {
    onClose();
    setResolvedTask(null);
    setTaskHistory([]);
    setTaskTransfers([]);
    setShowTransfer(false);
  }, [onClose]);

  useEffect(() => { if (isOpen) setActiveTab(initialTab); }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || !task?.id) {
      setResolvedTask(null);
      return;
    }
    setLoadingTask(true);
    setResolvedTask(null);
    taskService
      .getOne(task.id)
      .then((full) => setResolvedTask(full))
      .catch(() => setResolvedTask(null))
      .finally(() => setLoadingTask(false));
  }, [isOpen, task?.id]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!isOpen || !displayTask) return;
      const deliverableId = displayTask.deliverableId;
      if (!deliverableId) {
        setTaskHistory([]);
        setLoadingTaskHistory(false);
        return;
      }
      setLoadingTaskHistory(true);
      setTaskHistory([]);
      try {
        const history = await deliverableService.getHistory(deliverableId);
        setTaskHistory(Array.isArray(history) ? history : []);
      } catch {
        setTaskHistory([]);
      } finally {
        setLoadingTaskHistory(false);
      }
    };
    loadHistory();
  }, [isOpen, displayTask, displayTask?.id, displayTask?.deliverableId]);

  useEffect(() => {
    setAttachments([]);
    setConversations([]);
    setActivityLogs([]);
  }, [task?.id]);

  // Reloads when returning to Details so new questions and replies show up.
  useEffect(() => {
    if (!isOpen || !task?.id || activeTab !== 'details') return;
    let cancelled = false;
    taskService
      .getConversations(task.id)
      .then((data) => { if (!cancelled) setConversations(Array.isArray(data) ? data : []); })
      .catch((err) => { console.error('Failed to load conversation activity', err); });
    return () => { cancelled = true; };
  }, [isOpen, task?.id, activeTab]);

  // Reloads after a description edit or a removed attachment so the entry appears right away.
  const description = displayTask?.description;
  const attachmentCount = attachments.length;
  useEffect(() => {
    if (!isOpen || !task?.id) return;
    let cancelled = false;
    taskService
      .getActivity(task.id)
      .then((data) => { if (!cancelled) setActivityLogs(Array.isArray(data) ? data : []); })
      .catch((err) => { console.error('Failed to load activity log', err); });
    return () => { cancelled = true; };
  }, [isOpen, task?.id, description, displayTask?.title, displayTask?.dueDate, activeTab, attachmentCount]);

  useEffect(() => {
    if (!isOpen || !task?.id) {
      setTaskTransfers([]);
      return;
    }
    setLoadingTaskTransfers(true);
    taskService
      .getTransfers(task.id)
      .then((transfers) => setTaskTransfers(Array.isArray(transfers) ? transfers : []))
      .catch((err) => { console.error('Failed to load transfer history', err); setTaskTransfers([]); })
      .finally(() => setLoadingTaskTransfers(false));
  }, [isOpen, task?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleInternalClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleInternalClose]);

  const getUserName = useCallback(
    (userId: string): string => {
      if (!userId) return 'Unassigned';
      const user = allUsers.find((u: any) => u.id === userId);
      return user?.name || 'Unassigned';
    },
    [allUsers]
  );

  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        urlRegex.lastIndex = 0;
        return (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--td-accent-primary)', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // tech-debt: status-history embedded in description text; parsed by regex until proper history table is added
  const parsedStatusChanges = useMemo(() => {
    const desc = displayTask?.description ?? task?.description ?? '';
    if (!desc.includes('--- Status Change ---')) return [];
    const blocks = desc.split(/\n\n--- Status Change ---/);
    const out: { by: string; column: string; at: string; notes?: string; index: number }[] = [];
    blocks.forEach((block: string, i: number) => {
      if (i === 0) return;
      const newCol = block.match(/\nNew Column:\s*(.+?)(?:\n|$)/);
      const by = block.match(/\nBy:\s*(.+?)(?:\n|$)/);
      const at = block.match(/\nAt:\s*(.+?)(?:\n|$)/);
      const notesMatch = block.match(/\nNotes:\s*([\s\S]+?)(?=\nAttachments:|\n\n|$)/);
      out.push({
        column: (newCol?.[1] ?? '').trim(),
        by: (by?.[1] ?? 'Unknown').trim(),
        at: (at?.[1] ?? '').trim(),
        notes: notesMatch?.[1]?.trim() || undefined,
        index: i,
      });
    });
    return out.reverse();
  }, [displayTask?.description, task?.description]);

  if (!isOpen || !task) return null;

  const taskId = displayTask?.id ?? task?.id;

  return (
    <div className="tdsm-root tdsm-light-theme">
      <div className="tdsm-backdrop" onClick={handleInternalClose} />

      <div className="tdsm-panel" onClick={(e) => e.stopPropagation()}>

        <TaskHeader
          loadingTask={loadingTask}
          title={displayTask?.title ?? task?.title ?? ''}
          taskId={taskId}
          projectId={displayTask?.projectId ?? task?.projectId}
          getProjectPmName={getProjectPmName}
          onClose={handleInternalClose}
          onTitleSaved={(newTitle) => {
            const updated = { ...(resolvedTask ?? task), title: newTitle };
            setResolvedTask(updated);
            onTaskUpdate?.(updated);
          }}
          onDeleteTask={onTaskDeleted ? () => {
            const deletedId = taskId;
            handleInternalClose();
            onTaskDeleted(deletedId);
          } : undefined}
          onOpenTransfer={() => setShowTransfer(true)}
        />

        <div className="tdsm-tabs">
          <button
            className={`tdsm-tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            className={`tdsm-tab ${activeTab === 'conversation' ? 'active' : ''}`}
            onClick={() => setActiveTab('conversation')}
          >
            <FaRegCommentDots style={{ fontSize: '12px' }} />
            Conversation
          </button>
        </div>

        <div className="tdsm-body">
          {activeTab === 'details' ? (
            <>
              <TaskMetaPanel
                key={displayTask?.id ?? task?.id}
                displayTask={displayTask}
                task={task}
                allUsers={allUsers}
                getUserName={getUserName}
                getProjectName={getProjectName}
                renderTextWithLinks={renderTextWithLinks}
                parsedStatusChanges={parsedStatusChanges}
                taskTransfers={taskTransfers}
                onTaskUpdate={(updated) => {
                  setResolvedTask(updated);
                  onTaskUpdate?.(updated);
                }}
              />
              <TaskAttachmentsList taskId={displayTask?.id ?? task?.id} onAttachmentsChange={setAttachments} />
              <TaskActivityHistory
                parsedStatusChanges={parsedStatusChanges}
                attachments={attachments}
                conversations={conversations}
                activityLogs={activityLogs}
                taskHistory={taskHistory}
                loadingTaskHistory={loadingTaskHistory}
                taskTransfers={taskTransfers}
                loadingTaskTransfers={loadingTaskTransfers}
                deliverableId={displayTask?.deliverableId}
                renderTextWithLinks={renderTextWithLinks}
              />
              <div className="tdsm-actions">
                <button
                  className="tdsm-btn-outline"
                  onClick={() => { handleInternalClose(); navigate(`/project/${displayTask?.projectId ?? task?.projectId}`); }}
                >
                  View Full Project <FaArrowRight style={{ fontSize: '11px' }} />
                </button>
              </div>
              {showTransfer && (
                <TransferTaskModal
                  task={displayTask ?? task}
                  allUsers={allUsers}
                  onClose={() => setShowTransfer(false)}
                  onTransferred={(updatedTask) => {
                    setShowTransfer(false);
                    setResolvedTask(updatedTask);
                    onTaskUpdate?.(updatedTask);
                  }}
                />
              )}
            </>
          ) : (
            <TaskConversation
              isOpen={isOpen}
              task={task}
              allUsers={allUsers}
              activeTab={activeTab}
            />
          )}
        </div>
        {footer}
      </div>
    </div>
  );
};

export default TaskDetailSideModal;
