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

interface TaskDetailSideModalProps {
  isOpen: boolean;
  task: any | null;
  onClose: () => void;
  allUsers: any[];
  getProjectName: (projectId: string) => string;
  getProjectPmName?: (projectId: string) => string;
  onEditTask?: (task: any) => void;
  onTaskUpdate?: (updatedTask: any) => void;
  initialTab?: 'details' | 'conversation';
}

const TaskDetailSideModal: React.FC<TaskDetailSideModalProps> = ({
  isOpen,
  task,
  onClose,
  allUsers,
  getProjectName,
  getProjectPmName,
  onEditTask,
  onTaskUpdate,
  initialTab = 'details',
}) => {
  const navigate = useNavigate();
  const [resolvedTask, setResolvedTask] = useState<any | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [loadingTaskHistory, setLoadingTaskHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'conversation'>(initialTab);
  const displayTask = resolvedTask || task;

  const handleInternalClose = useCallback(() => {
    onClose();
    setResolvedTask(null);
    setTaskHistory([]);
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

  return (
    <div className="tdsm-root tdsm-light-theme">
      <div className="tdsm-backdrop" onClick={handleInternalClose} />

      <div className="tdsm-panel" onClick={(e) => e.stopPropagation()}>

        <TaskHeader
          loadingTask={loadingTask}
          title={displayTask?.title ?? task?.title ?? ''}
          projectId={displayTask?.projectId ?? task?.projectId}
          getProjectPmName={getProjectPmName}
          onClose={handleInternalClose}
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
                onTaskUpdate={(updated) => {
                  setResolvedTask(updated);
                  onTaskUpdate?.(updated);
                }}
              />
              <TaskAttachmentsList fileUrl={displayTask?.fileUrl ?? task?.fileUrl} />
              <TaskActivityHistory
                parsedStatusChanges={parsedStatusChanges}
                taskHistory={taskHistory}
                loadingTaskHistory={loadingTaskHistory}
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
                {onEditTask && (
                  <button
                    className="tdsm-btn-primary"
                    onClick={() => { handleInternalClose(); onEditTask(displayTask || task); }}
                  >
                    Edit Task
                  </button>
                )}
              </div>
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
      </div>
    </div>
  );
};

export default TaskDetailSideModal;
