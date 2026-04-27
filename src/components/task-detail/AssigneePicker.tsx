import React, { useState, useRef, useEffect } from 'react';
import { FaPlus, FaTimes, FaUsers } from 'react-icons/fa';
import UserAvatar from '../UserAvatar';
import { DEPARTMENTS, filterUsersByDepartment } from '../../utils/roleMapping';

interface AssigneePickerProps {
  allUsers: any[];
  assigneeIds: string[];
  getUserName: (id: string) => string;
  onAssigneesChange: (ids: string[]) => void;
  disabled?: boolean;
}

const AssigneePicker: React.FC<AssigneePickerProps> = ({
  allUsers, assigneeIds, getUserName, onAssigneesChange, disabled,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [department, setDepartment] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setPickerOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  useEffect(() => {
    if (focusedIndex >= 0) {
      rowRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  const visibleUsers = showAll ? allUsers : filterUsersByDepartment(allUsers, department);

  const handleToggle = (userId: string) => {
    const next = assigneeIds.includes(userId)
      ? assigneeIds.filter(id => id !== userId)
      : [...assigneeIds, userId];
    onAssigneesChange(next);
  };

  const handlePickerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'SELECT' || tag === 'INPUT') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => visibleUsers.length === 0 ? -1 : (i + 1) % visibleUsers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => visibleUsers.length === 0 ? -1 : (i - 1 + visibleUsers.length) % visibleUsers.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < visibleUsers.length) {
        handleToggle(visibleUsers[focusedIndex].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setPickerOpen(false);
      setFocusedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {assigneeIds.length === 0 && (
          <span style={{ fontSize: '13.5px', color: 'var(--td-text-tertiary)' }}>Unassigned</span>
        )}
        {assigneeIds.map(id => {
          const user = allUsers.find(u => u.id === id);
          return (
            <div key={id} className="tdsm-assignee-row" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <UserAvatar name={user?.name || getUserName(id)} avatarUrl={user?.avatarUrl} size={28} color="#6366f1" />
              <span className="tdsm-assignee-name">{getUserName(id)}</span>
              {!disabled && (
                <button
                  className="tdsm-assignee-remove"
                  onMouseDown={e => { e.preventDefault(); handleToggle(id); }}
                  title="Remove assignee"
                >
                  <FaTimes style={{ fontSize: '9px' }} />
                </button>
              )}
            </div>
          );
        })}
        {!disabled && (
          <button
            className="tdsm-add-assignee-btn"
            onClick={() => {
              const opening = !pickerOpen;
              setPickerOpen(opening);
              setFocusedIndex(opening ? (visibleUsers.length > 0 ? 0 : -1) : -1);
            }}
          >
            <FaPlus style={{ fontSize: '10px' }} /> Add
          </button>
        )}
      </div>

      {pickerOpen && (
        <div className="tdsm-assignee-picker" onKeyDown={handlePickerKeyDown}>
          <div className="tdsm-picker-filters">
            <select
              className="tdsm-picker-dept-select"
              value={department}
              onChange={e => { setDepartment(e.target.value); setShowAll(false); setFocusedIndex(0); }}
            >
              <option value="">Filter by dept…</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button
              className={`tdsm-picker-showall${showAll ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); setShowAll(v => !v); setDepartment(''); setFocusedIndex(0); }}
            >
              <FaUsers style={{ fontSize: '11px' }} /> All
            </button>
          </div>
          <div className="tdsm-picker-list">
            {visibleUsers.length === 0 ? (
              <div className="tdsm-picker-empty">No users in this department</div>
            ) : (
              visibleUsers.map((user, index) => {
                const selected = assigneeIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    ref={el => { rowRefs.current[index] = el; }}
                    className={`tdsm-picker-user${selected ? ' selected' : ''}${index === focusedIndex ? ' focused' : ''}`}
                    onMouseDown={e => { e.preventDefault(); handleToggle(user.id); }}
                  >
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={24} color="#6366f1" />
                    <span>{user.name}</span>
                    <span className="tdsm-picker-role">{user.role}</span>
                    {selected && <span className="tdsm-picker-check">✓</span>}
                  </div>
                );
              })
            )}
          </div>
          <button
            className="tdsm-picker-done"
            onMouseDown={e => { e.preventDefault(); setPickerOpen(false); setFocusedIndex(-1); }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default AssigneePicker;
