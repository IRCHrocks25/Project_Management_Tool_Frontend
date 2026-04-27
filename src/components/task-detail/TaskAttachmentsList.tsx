import React from 'react';
import { FaLink, FaFileAlt } from 'react-icons/fa';

interface TaskAttachmentsListProps {
  fileUrl?: string;
}

const TaskAttachmentsList: React.FC<TaskAttachmentsListProps> = ({ fileUrl }) => {
  if (!fileUrl) return null;

  return (
    <div className="tdsm-card" style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.04)' }}>
      <div className="tdsm-card-label" style={{ color: 'var(--td-accent-primary)' }}><FaLink /> Files & Links</div>
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="tdsm-file-link">
        <FaFileAlt style={{ fontSize: '13px', flexShrink: 0 }} />
        <span>{fileUrl}</span>
      </a>
    </div>
  );
};

export default TaskAttachmentsList;
