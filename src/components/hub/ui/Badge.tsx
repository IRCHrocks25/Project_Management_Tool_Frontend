/**
 * Badges.
 *
 *   <Badge tone="ok" | "warn" | "crit" | "info" | "acc" | "neutral" plain?>Live</Badge>
 *     `plain` drops the leading dot.
 *   <ProductStatusBadge status="live" version="v2.4" />    → "Live · v2.4"
 *   <ExpiryBadge date="2026-11-28" />                       → "In 24 days" (crit ≤30, warn ≤60, ok) / "Today" / "Expired"
 *   <UpdateTypeBadge type="heads_up" />                     → "Heads-up"
 */
import React from 'react';
import type { ProductStatus, UpdateType } from '../../../services/hub.service';
import { daysUntil, PRODUCT_STATUS, UPDATE_TYPE } from '../hubUtils';

export type BadgeTone = 'ok' | 'warn' | 'crit' | 'info' | 'acc' | 'neutral';

export interface BadgeProps {
  tone?: BadgeTone;
  plain?: boolean;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', plain, children, title, className = '' }) => (
  <span
    className={`hub-badge${tone !== 'neutral' ? ` hub-${tone}` : ''}${plain ? ' hub-plain' : ''} ${className}`.trim()}
    title={title}
  >
    {children}
  </span>
);

export const ProductStatusBadge: React.FC<{ status: ProductStatus; version?: string | null }> = ({ status, version }) => {
  const s = PRODUCT_STATUS[status] || PRODUCT_STATUS.building;
  return (
    <Badge tone={s.tone}>
      {s.label}
      {version ? ` · ${version}` : ''}
    </Badge>
  );
};

export const ExpiryBadge: React.FC<{ date: string | null | undefined }> = ({ date }) => {
  if (!date) return <Badge plain>Not set</Badge>;
  const n = daysUntil(date);
  const tone: BadgeTone = n <= 30 ? 'crit' : n <= 60 ? 'warn' : 'ok';
  const label = n < 0 ? `Expired ${-n} day${n === -1 ? '' : 's'} ago` : n === 0 ? 'Today' : `In ${n} day${n === 1 ? '' : 's'}`;
  return <Badge tone={tone}>{label}</Badge>;
};

export const UpdateTypeBadge: React.FC<{ type: UpdateType }> = ({ type }) => {
  const t = UPDATE_TYPE[type] || UPDATE_TYPE.progress;
  return <Badge tone={t.tone}>{t.label}</Badge>;
};

export default Badge;
