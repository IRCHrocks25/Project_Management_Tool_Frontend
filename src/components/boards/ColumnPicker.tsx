import React, { useState } from 'react';
import { FaCalendarAlt, FaCheckSquare, FaFont, FaHashtag, FaLink, FaListUl, FaUser } from 'react-icons/fa';
import { BoardColumnType } from '../../services/board.service';

const TYPES: { type: BoardColumnType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'status', label: 'Status', icon: <FaListUl />, color: '#15803d' },
  { type: 'text', label: 'Text', icon: <FaFont />, color: '#b45309' },
  { type: 'people', label: 'People', icon: <FaUser />, color: '#0f766e' },
  { type: 'date', label: 'Date', icon: <FaCalendarAlt />, color: '#475569' },
  { type: 'number', label: 'Numbers', icon: <FaHashtag />, color: '#a16207' },
  { type: 'checkbox', label: 'Checkbox', icon: <FaCheckSquare />, color: '#57534e' },
  { type: 'link', label: 'Link', icon: <FaLink />, color: '#b91c1c' },
];

const DEFAULT_LABELS = 'To do, Doing, Done';

const ColumnPicker: React.FC<{
  onAdd: (input: { name: string; type: BoardColumnType; labels?: string[] }) => Promise<unknown>;
  onDone: () => void;
}> = ({ onAdd, onDone }) => {
  const [type, setType] = useState<(typeof TYPES)[number] | null>(null);
  const [name, setName] = useState('');
  const [labels, setLabels] = useState(DEFAULT_LABELS);
  const [saving, setSaving] = useState(false);

  if (!type) {
    return (
      <div className="bv-col-picker">
        <div className="bv-menu-title">Add a column</div>
        <div className="bv-col-grid">
          {TYPES.map((option) => (
            <button
              key={option.type}
              type="button"
              className="bv-col-type"
              onClick={() => {
                setType(option);
                setName(option.label);
              }}
            >
              <span className="bv-col-icon" style={{ background: option.color }}>{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    await onAdd({
      name: name.trim(),
      type: type.type,
      labels: type.type === 'status' ? labels.split(',').map((l) => l.trim()).filter(Boolean) : undefined,
    });
    setSaving(false);
    onDone();
  };

  return (
    <form className="bv-col-form" onSubmit={submit}>
      <label>
        Column name
        <input autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {type.type === 'status' && (
        <label>
          Labels, separated by commas
          <input value={labels} onChange={(e) => setLabels(e.target.value)} />
        </label>
      )}
      <div className="bv-col-form-actions">
        <button type="button" className="bv-btn" onClick={() => setType(null)}>Back</button>
        <button type="submit" className="bv-btn bv-btn-primary" disabled={saving || !name.trim()}>
          {saving ? 'Adding…' : 'Add column'}
        </button>
      </div>
    </form>
  );
};

export default ColumnPicker;
