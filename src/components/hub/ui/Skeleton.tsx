/**
 * Skeletons shown while data loads (announced to screen readers as "Loading").
 *
 *   <Skeleton width="60%" height={12} />       one bar (width: number px or any CSS length)
 *   <Skeleton circle size={26} />
 *   <SkeletonFeed count={3} />                 update cards
 *   <SkeletonRows rows={4} />                  list/table card
 *   <SkeletonPage />                           two-column product page body
 */
import React from 'react';

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  circle?: boolean;
  size?: number;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 12, circle, size = 26, style }) => (
  <div
    className="hub-sk"
    aria-hidden="true"
    style={circle ? { width: size, height: size, borderRadius: '50%', flex: 'none', ...style } : { width, height, ...style }}
  />
);

export const SkeletonFeed: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="hub-feed" aria-busy="true" aria-label="Loading">
    {Array.from({ length: count }).map((_, i) => (
      <div className="hub-card hub-post" key={i}>
        <div className="hub-sk-row">
          <Skeleton circle />
          <Skeleton width={120} />
        </div>
        <Skeleton width="92%" />
        <Skeleton width="70%" />
      </div>
    ))}
  </div>
);

export const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="hub-card" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div className="hub-list-row" key={i}>
        <Skeleton circle />
        <div style={{ flex: 1, display: 'grid', gap: 6 }}>
          <Skeleton width={`${50 + ((i * 17) % 35)}%`} />
          <Skeleton width="30%" height={10} />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonPage: React.FC = () => (
  <div className="hub-cols" aria-busy="true" aria-label="Loading">
    <div className="hub-stack">
      <SkeletonFeed count={3} />
    </div>
    <div className="hub-stack">
      <div className="hub-card hub-post">
        <Skeleton width="40%" />
        <Skeleton width="80%" />
        <Skeleton width="60%" />
      </div>
      <div className="hub-card hub-post">
        <Skeleton width="50%" />
        <Skeleton width="75%" />
      </div>
    </div>
  </div>
);

export default Skeleton;
