/** Searchable checklist of teammates, used when scheduling a meeting and when inviting during a call. */
import React, { useState } from 'react';
import { Avatar } from '../hub/ui/Avatar';
import { useHubUsers } from '../hub/ui/users';

const PeoplePicker: React.FC<{
  selected: string[];
  onChange: (ids: string[]) => void;
  excludeIds?: string[];
}> = ({ selected, onChange, excludeIds = [] }) => {
  const { users, loading, error, reload } = useHubUsers();
  const [filter, setFilter] = useState('');
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = users
    .filter((u) => !excludeIds.includes(u.id))
    .filter((u) => words.every((w) => `${u.name} ${u.role || ''}`.toLowerCase().includes(w)));

  if (error) {
    return (
      <p className="mt-picker-note">
        Couldn't load your teammates.{' '}
        <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" onClick={reload}>
          Try again
        </button>
      </p>
    );
  }
  return (
    <div className="mt-picker">
      <input
        className="hub-inp"
        type="search"
        placeholder="Search by name or department"
        aria-label="Search teammates"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="mt-picker-list">
        {loading ? (
          <p className="mt-picker-note">Loading teammates…</p>
        ) : !shown.length ? (
          <p className="mt-picker-note">Nobody matches that search.</p>
        ) : (
          shown.map((u) => {
            const on = selected.includes(u.id);
            return (
              <label key={u.id} className="mt-picker-row">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => onChange(e.target.checked ? [...selected, u.id] : selected.filter((id) => id !== u.id))}
                />
                <Avatar user={u} size={24} />
                <span className="mt-picker-name">{u.name}</span>
                <span className="mt-picker-role">{u.role}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PeoplePicker;
