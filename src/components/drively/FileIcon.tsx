/** The file-type mark. Colours follow the app's meanings loosely and stay away from blue and purple. */
import React from 'react';
import { DriveKind } from '../../services/drively.service';

export const KIND_COLORS: Record<DriveKind | 'form', string> = {
  folder: 'var(--fg-2)',
  doc: 'var(--color-action)',
  grid: 'var(--color-done)',
  slides: 'var(--color-attention)',
  pdf: 'var(--crit)',
  file: 'var(--muted)',
  form: 'var(--fg-2)',
};

const GLYPH: Record<DriveKind | 'form', React.ReactNode> = {
  folder: <path d="M3 7a2 2 0 0 1 2-2h4.2a1 1 0 0 1 .7.3L12 7.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" />,
  doc: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="currentColor" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="currentColor" />
      <path d="M8 8h8v9H8zM8 12.5h8M12 8v9" fill="none" stroke="#fff" strokeWidth="1.5" />
    </>
  ),
  slides: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="currentColor" />
      <rect x="7.5" y="8" width="9" height="7.5" rx="1" fill="none" stroke="#fff" strokeWidth="1.6" />
    </>
  ),
  pdf: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="currentColor" />
      <text x="12" y="15" textAnchor="middle" fontSize="6.6" fontWeight="700" fontFamily="Arial, sans-serif" fill="#fff">PDF</text>
    </>
  ),
  file: (
    <>
      <path d="M14 2.5H6.5A2.5 2.5 0 0 0 4 5v14a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 19V8.5z" fill="currentColor" />
      <path d="M14 2.5v6h6" fill="none" stroke="#fff" strokeWidth="1.4" />
    </>
  ),
  form: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="currentColor" />
      <path d="M11 8.5h5M11 12h5M11 15.5h5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8" cy="8.5" r="1" fill="#fff" />
      <circle cx="8" cy="12" r="1" fill="#fff" />
      <circle cx="8" cy="15.5" r="1" fill="#fff" />
    </>
  ),
};

const FileIcon: React.FC<{ kind: DriveKind | 'form'; size?: number }> = ({ kind, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ color: KIND_COLORS[kind], flex: 'none' }}>
    {GLYPH[kind]}
  </svg>
);

export default FileIcon;
