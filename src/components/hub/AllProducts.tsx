/**
 * All products (/products): summary strip, products table with attention, filters
 * ("Only show products that need attention", "Show archived"), "Who's handling what" grid and
 * the Add product modal.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hubErrorMessage, hubService, ProductSummary } from '../../services/hub.service';
import { notificationService } from '../../services/notification.service';
import HubTopbar from './HubTopbar';
import ProductFormModal from './ProductFormModal';
import { Badge, ProductStatusBadge } from './ui/Badge';
import EmptyState from './ui/EmptyState';
import Icon from './ui/Icon';
import { Skeleton } from './ui/Skeleton';
import { Who } from './ui/Avatar';
import { useHubUsers } from './ui/users';
import { productPath, when } from './hubUtils';

const PREFS_KEY = 'hub-all-products-filters';

function readPrefs(): { attnOnly: boolean; showArchived: boolean } {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { attnOnly: false, showArchived: false, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { attnOnly: false, showArchived: false };
}

const needsAttention = (p: ProductSummary) => (p.attention || []).some((a) => a.level !== 'info');

const AllProducts: React.FC = () => {
  const navigate = useNavigate();
  const { byId } = useHubUsers();
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState(readPrefs);
  const [adding, setAdding] = useState(false);
  const [unread, setUnread] = useState<number | null | undefined>(undefined);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [active, archived] = await Promise.all([
        hubService.listProducts({ archived: false }),
        prefs.showArchived ? hubService.listProducts({ archived: true }) : Promise.resolve([] as ProductSummary[]),
      ]);
      const seen: Record<string, true> = {};
      const merged = [...(active || []), ...(archived || [])].filter((p) => (seen[p.id] ? false : (seen[p.id] = true)));
      merged.sort((a, b) => Number(!!a.archivedAt) - Number(!!b.archivedAt) || a.name.localeCompare(b.name));
      setProducts(merged);
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load the products."));
    }
  }, [prefs.showArchived]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    notificationService
      .getAll()
      .then((list) => {
        if (alive) setUnread(list.filter((n) => !n.isRead && String(n.type).startsWith('product_')).length);
      })
      .catch(() => alive && setUnread(null));
    return () => {
      alive = false;
    };
  }, []);

  const setPref = (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const active = useMemo(() => (products || []).filter((p) => !p.archivedAt), [products]);
  const stats = useMemo(() => {
    const open = active.reduce((a, p) => a + (p.openTickets || 0), 0);
    const high = active.reduce((a, p) => a + (p.highPriorityOpen || 0), 0);
    const expiring = active.reduce((a, p) => a + (p.attention || []).filter((x) => x.level === 'critical').length, 0);
    return { open, high, expiring };
  }, [active]);

  const rows = useMemo(() => (products || []).filter((p) => !prefs.attnOnly || needsAttention(p)), [products, prefs.attnOnly]);

  // Who's handling what: everyone on at least one active product.
  const grid = useMemo(() => {
    const people: Record<string, Record<string, string[]>> = {};
    active.forEach((p) =>
      (p.members || []).forEach((m) => {
        const row = (people[m.userId] = people[m.userId] || {});
        (row[p.id] = row[p.id] || []).push(m.area);
      }),
    );
    const ids = Object.keys(people).sort((a, b) => (byId(a)?.name || '').localeCompare(byId(b)?.name || ''));
    return { people, ids };
  }, [active, byId]);

  const open = (p: ProductSummary) => navigate(productPath(p.slug));

  return (
    <>
      <HubTopbar crumbs={[{ label: 'All products' }]} />
      <main className="hub-page" id="hub-main">
        <div className="hub-ph">
          <div className="hub-ph-text">
            <h1>All products</h1>
            <p>Status, owners and anything that needs attention across every internal product.</p>
          </div>
          <div className="hub-ph-actions">
            <button type="button" className="hub-btn hub-btn-primary" onClick={() => setAdding(true)}>
              <Icon name="plus" />
              Add product
            </button>
          </div>
        </div>

        <div className="hub-statbar" aria-busy={!products}>
          <div className="hub-stat">
            <b>{products ? active.length : <Skeleton width={28} height={22} />}</b>
            <span>Products</span>
          </div>
          <div className="hub-stat">
            <b>{products ? stats.open : <Skeleton width={28} height={22} />}</b>
            <span>Open tickets{products ? ` · ${stats.high} high priority` : ''}</span>
          </div>
          <div className="hub-stat">
            <b className={stats.expiring ? 'hub-crit-text' : undefined}>{products ? stats.expiring : <Skeleton width={28} height={22} />}</b>
            <span>Domains or SSL expiring in 30 days</span>
          </div>
          <div className="hub-stat">
            <b>{unread === undefined ? <Skeleton width={28} height={22} /> : unread === null ? '–' : unread}</b>
            <span>Unread for you</span>
          </div>
        </div>

        <section className="hub-sec" aria-labelledby="hub-products-h">
          <div className="hub-sec-h">
            <h2 id="hub-products-h">Products</h2>
            <div className="hub-sp">
              <label className="hub-toggle" htmlFor="hub-attn-only">
                <input id="hub-attn-only" type="checkbox" checked={prefs.attnOnly} onChange={(e) => setPref({ attnOnly: e.target.checked })} />
                <span className="hub-tg" aria-hidden="true" />
                <span>Only show products that need attention</span>
              </label>
              <label className="hub-toggle" htmlFor="hub-show-archived">
                <input
                  id="hub-show-archived"
                  type="checkbox"
                  checked={prefs.showArchived}
                  onChange={(e) => setPref({ showArchived: e.target.checked })}
                />
                <span className="hub-tg" aria-hidden="true" />
                <span>Show archived</span>
              </label>
            </div>
          </div>

          <div className="hub-card hub-tw">
            {error ? (
              <EmptyState icon="alert" title="Couldn't load the products" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
            ) : !products ? (
              <ProductsTableSkeleton />
            ) : !products.length ? (
              <EmptyState
                icon="grid"
                title="No products yet"
                text="Add each internal product to keep its updates, tickets, SOPs, logins and files in one place."
                actionLabel="Add product"
                onAction={() => setAdding(true)}
              />
            ) : !rows.length ? (
              <EmptyState icon="check" title="Nothing needs attention" text="Every product is up to date. Turn off the filter to see all products." />
            ) : (
              <table className="hub-tbl hub-rt">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Status</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Last update</th>
                    <th scope="col">Open tickets</th>
                    <th scope="col">Needs attention</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const flags = (p.attention || []).filter((a) => a.level !== 'info');
                    const crit = flags.some((a) => a.level === 'critical');
                    return (
                      <tr
                        key={p.id}
                        className={`hub-click${p.archivedAt ? ' hub-dim' : ''}`}
                        tabIndex={0}
                        onClick={() => open(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target === e.currentTarget) open(p);
                        }}
                      >
                        <td>
                          <Link className="hub-row-link" to={productPath(p.slug)} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
                            {p.name}
                          </Link>
                          {p.archivedAt ? (
                            <>
                              {' '}
                              <Badge plain>Archived</Badge>
                            </>
                          ) : null}
                          {p.description ? <div className="hub-cell-sub">{p.description}</div> : null}
                        </td>
                        <td data-l="Status">
                          <ProductStatusBadge status={p.status} /> {p.version ? <span className="hub-mono hub-muted">{p.version}</span> : null}
                        </td>
                        <td data-l="Owner">
                          <Who user={p.owner || byId(p.ownerId)} fallback="No owner" />
                        </td>
                        <td data-l="Last update">
                          {p.lastUpdate ? (
                            <>
                              {when(p.lastUpdate.at)}{' '}
                              {p.lastUpdate.author ? <span className="hub-cell-sub">by {p.lastUpdate.author.name}</span> : null}
                            </>
                          ) : (
                            <span className="hub-muted">None yet</span>
                          )}
                        </td>
                        <td data-l="Open tickets">{p.openTickets || 0}</td>
                        <td data-l="Attention">
                          {flags.length ? (
                            <>
                              <Badge tone={crit ? 'crit' : 'warn'}>
                                {flags.length} item{flags.length > 1 ? 's' : ''}
                              </Badge>{' '}
                              <span className="hub-cell-sub">{flags[0].message}</span>
                            </>
                          ) : (
                            <Badge tone="ok">All good</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {products && active.length > 0 && (
          <section className="hub-sec" aria-labelledby="hub-who-h">
            <div className="hub-sec-h">
              <h2 id="hub-who-h">Who's handling what</h2>
            </div>
            <div className="hub-card hub-tw">
              {grid.ids.length ? (
                <table className="hub-tbl">
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      {active.map((p) => (
                        <th scope="col" key={p.id}>
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.ids.map((uid) => {
                      const u = byId(uid);
                      return (
                        <tr key={uid}>
                          <th scope="row" className="hub-row-h">
                            <Who user={u || { id: uid, name: 'Unknown person' }} />
                            {u?.role ? (
                              <div className="hub-cell-sub" style={{ paddingLeft: 34 }}>
                                {u.role}
                              </div>
                            ) : null}
                          </th>
                          {active.map((p) => {
                            const areas = grid.people[uid][p.id];
                            return (
                              <td className="hub-small" key={p.id}>
                                {areas ? areas.join(', ') : <span className="hub-muted" aria-label="Not involved">–</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyState icon="users" title="No one assigned yet" text="Add people in each product's Team tab to see who handles what." />
              )}
            </div>
          </section>
        )}
      </main>

      {adding && (
        <ProductFormModal
          onClose={() => setAdding(false)}
          onSaved={(p) => {
            if (p?.slug) navigate(productPath(p.slug));
            else load();
          }}
        />
      )}
    </>
  );
};

const ProductsTableSkeleton: React.FC = () => (
  <div aria-busy="true" aria-label="Loading">
    {[0, 1, 2, 3].map((i) => (
      <div className="hub-list-row" key={i}>
        <div style={{ flex: 1, display: 'grid', gap: 6 }}>
          <Skeleton width={`${30 + i * 8}%`} />
          <Skeleton width="45%" height={10} />
        </div>
        <Skeleton width={70} height={22} />
        <Skeleton circle />
      </div>
    ))}
  </div>
);

export default AllProducts;
