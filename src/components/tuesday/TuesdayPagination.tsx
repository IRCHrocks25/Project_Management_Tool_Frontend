import React from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

/*
 * Pagination footer for Tuesday's server-paginated board view.
 *
 * Layout:
 *   "Showing X–Y of Z projects [spinner]"   |   [< Prev] [1] … [n] … [N] [Next >]
 *
 * Page-list pattern:
 *   totalPages ≤ 7 → all pages flat
 *   totalPages > 7 → first, last, current ± 2, with "…" between any
 *                    non-adjacent pair
 *
 * `refetching` keeps the controls visible+labeled but disables every
 * click target so the user can't fire a second navigation while the
 * first is still in flight. The small spinner next to the count is
 * the only visual indicator data is loading — the table itself stays
 * mounted (useBoardView preserves prior `data` during refetch).
 *
 * `onPageChange` should call `filterControls.setPage(n)`. Caller is
 * responsible for scrolling-to-top after the new data arrives (handled
 * via a useEffect on `currentPage` in TuesdayView).
 */

interface Props {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  refetching: boolean;
  onPageChange: (page: number) => void;
}

function buildPageList(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, total, current, current - 1, current - 2, current + 1, current + 2]);
  const sorted = Array.from(set).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis');
    out.push(sorted[i]);
  }
  return out;
}

const TuesdayPagination: React.FC<Props> = ({
  currentPage, totalPages, totalCount, pageSize, refetching, onPageChange,
}) => {
  // Empty result set — TuesdayView's "No matches" empty state covers
  // the visual; rendering nothing here avoids a "Showing 0 of 0" footer.
  if (totalCount === 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  // Single-page form: counts only, no buttons. Page numbers + Prev/Next
  // would all be no-ops and just visual noise.
  if (totalPages <= 1) {
    return (
      <div className="tuesday-pagination tuesday-pagination--single">
        <span className="tuesday-pagination-info">
          Showing {start}{end > start ? `–${end}` : ''} of {totalCount} projects
          {refetching && <span className="tuesday-pagination-spinner" aria-label="Refreshing" />}
        </span>
      </div>
    );
  }

  const pages = buildPageList(currentPage, totalPages);
  const prevDisabled = currentPage === 1 || refetching;
  const nextDisabled = currentPage === totalPages || refetching;

  return (
    <div className="tuesday-pagination">
      <span className="tuesday-pagination-info">
        Showing {start}&ndash;{end} of {totalCount} projects
        {refetching && <span className="tuesday-pagination-spinner" aria-label="Refreshing" />}
      </span>
      <div className="tuesday-pagination-controls">
        <button
          type="button"
          className="tuesday-pagination-btn"
          disabled={prevDisabled}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <FaChevronLeft size={11} />
          <span>Prev</span>
        </button>
        {pages.map((p, idx) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="tuesday-pagination-ellipsis" aria-hidden="true">&hellip;</span>
          ) : (
            <button
              type="button"
              key={`p-${p}`}
              className={`tuesday-pagination-btn tuesday-pagination-num ${p === currentPage ? 'tuesday-pagination-num--active' : ''}`}
              disabled={refetching}
              onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="tuesday-pagination-btn"
          disabled={nextDisabled}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <span>Next</span>
          <FaChevronRight size={11} />
        </button>
      </div>
    </div>
  );
};

export default TuesdayPagination;
