import React, { useEffect, useState } from 'react';
import { FaFlag } from 'react-icons/fa';
import {
  departmentProjectFocusService,
  DepartmentProjectFocusRow,
} from '../../services/departmentProjectFocus.service';

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface TodaysPrioritiesCardProps {
  taskType: string;
  /** Bump to reload, e.g. after the full priorities panel closes */
  refreshKey: number;
  onManage: () => void;
  onOpenRow: (row: DepartmentProjectFocusRow) => void;
}

/** Compact rail summary of today's department priorities; the full editor opens in a modal. */
const TodaysPrioritiesCard: React.FC<TodaysPrioritiesCardProps> = ({ taskType, refreshKey, onManage, onOpenRow }) => {
  const [rows, setRows] = useState<DepartmentProjectFocusRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    departmentProjectFocusService
      .getByDateAndDepartment(todayYmd(), taskType)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [taskType, refreshKey]);

  return (
    <section className="rd-panel rd-rail-card">
      <div className="rd-rail-title">
        <h3>Today's priorities</h3>
        <FaFlag style={{ color: '#6555e9' }} aria-hidden="true" />
      </div>
      {state === 'loading' && <p className="rd-rail-note">Loading priorities…</p>}
      {state === 'error' && (
        <p className="rd-rail-note">
          Priorities could not be loaded.{' '}
          <button type="button" className="rd-link" onClick={onManage}>Try the full view</button>
        </p>
      )}
      {state === 'ready' && rows.length === 0 && (
        <div className="rd-focus-empty">
          <b>No priorities set for today</b>
          <p>Priorities set by a PM or team lead show up here.</p>
          <button type="button" className="rd-btn rd-btn-subtle" onClick={onManage}>Open priorities</button>
        </div>
      )}
      {state === 'ready' && rows.length > 0 && (
        <>
          <ol className="rd-focus-list">
            {rows.slice(0, 3).map((row, i) => (
              <li key={row.id}>
                <button type="button" onClick={() => onOpenRow(row)}>
                  <span className="rd-focus-rank">{i + 1}</span>
                  <span className="rd-focus-text">
                    <b>{row.taskTitle || row.clientName}</b>
                    {row.taskTitle && <small>{row.clientName}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="rd-link" onClick={onManage}>
            {rows.length > 3 ? `View all ${rows.length} priorities` : 'Manage priorities'}
          </button>
        </>
      )}
    </section>
  );
};

export default TodaysPrioritiesCard;
