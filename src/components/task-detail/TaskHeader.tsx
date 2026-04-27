import React from 'react';
import { FaTimes, FaUser } from 'react-icons/fa';

interface TaskHeaderProps {
  loadingTask: boolean;
  title: string;
  projectId: string;
  getProjectPmName?: (projectId: string) => string;
  onClose: () => void;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({
  loadingTask,
  title,
  projectId,
  getProjectPmName,
  onClose,
}) => (
  <div className="tdsm-header">
    <div className="tdsm-header-top">
      <h2 className="tdsm-task-title">
        {loadingTask ? 'Loading…' : title}
      </h2>
      <button className="tdsm-close-btn" onClick={onClose}>
        <FaTimes />
      </button>
    </div>

    {getProjectPmName?.(projectId) && (
      <div className="tdsm-pm-row">
        <FaUser />
        PM: {getProjectPmName(projectId)}
      </div>
    )}
  </div>
);

export default TaskHeader;
