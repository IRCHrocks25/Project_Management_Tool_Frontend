/**
 * UserPicker — accessible native select of everyone from GET /auth/users, sorted by name.
 *
 *   <UserPicker id="owner" value={ownerId} onChange={setOwnerId}
 *     allowEmpty emptyLabel="Unassigned"      // optional empty option (value '')
 *     excludeIds={alreadyOnTeam}              // optional
 *     invalid={!!error} describedBy="owner-e" />
 *
 * Use <UserField> (FormModal.tsx) inside forms; it wraps this with a label and error.
 */
import React from 'react';
import { useHubUsers } from './users';

export interface UserPickerProps {
  id?: string;
  value: string;
  onChange: (userId: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  excludeIds?: string[];
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

const UserPicker: React.FC<UserPickerProps> = ({
  id,
  value,
  onChange,
  allowEmpty,
  emptyLabel = 'Nobody',
  excludeIds,
  invalid,
  describedBy,
  disabled,
  className = 'hub-inp hub-w-md',
  ariaLabel,
}) => {
  const { users, loading, error, me } = useHubUsers();
  const list = users.filter((u) => !excludeIds || u.id === value || excludeIds.indexOf(u.id) < 0);
  // Keep the current value selectable even before the list loads.
  const missing = value && !list.some((u) => u.id === value);
  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid ? 'true' : 'false'}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {(allowEmpty || !value) && <option value="">{allowEmpty ? emptyLabel : loading ? 'Loading people…' : 'Choose a person'}</option>}
      {missing && <option value={value}>{me && me.id === value ? me.name : loading ? 'Loading…' : 'Unknown person'}</option>}
      {list.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
          {u.role ? ` · ${u.role}` : ''}
          {me && me.id === u.id ? ' (you)' : ''}
        </option>
      ))}
      {!loading && error && !list.length ? <option disabled>Couldn't load people</option> : null}
    </select>
  );
};

export default UserPicker;
