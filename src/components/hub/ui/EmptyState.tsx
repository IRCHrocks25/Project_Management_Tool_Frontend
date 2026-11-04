/**
 * EmptyState — explains what goes here and offers the main action.
 *
 *   <EmptyState icon="msg" title="No updates yet"
 *     text="Post progress, releases, blockers or questions. Mention people with @ to notify them."
 *     actionLabel="Post update" onAction={openPost} />
 *   Optional: actionIcon (default "plus"), children (rendered under the text, e.g. a secondary link).
 */
import React from 'react';
import Icon, { IconName } from './Icon';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  text?: React.ReactNode;
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  children?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'info', title, text, actionLabel, actionIcon = 'plus', onAction, children }) => (
  <div className="hub-empty">
    <span className="hub-ei">
      <Icon name={icon} size={20} />
    </span>
    <h3>{title}</h3>
    {text ? <p>{text}</p> : null}
    {actionLabel && onAction ? (
      <button type="button" className="hub-btn hub-btn-primary" onClick={onAction}>
        <Icon name={actionIcon} />
        {actionLabel}
      </button>
    ) : null}
    {children}
  </div>
);

export default EmptyState;
