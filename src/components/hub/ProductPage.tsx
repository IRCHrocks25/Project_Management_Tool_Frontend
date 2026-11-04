/**
 * Product page: /products/:slug and /products/:slug/:tab
 *
 * Header (name, description, status / owner badges, Edit product, archive / restore, the tab's
 * primary action), tabs with counts, and the active tab.
 *
 * ── Tab contract (for helpers building tabs) ─────────────────────────────────────────────────
 *   Each tab is `React.FC<HubTabProps>` with props `{ product: ProductDetail; onChanged: () => void }`.
 *     - `product` is the ProductDetail from GET /products/by-slug/:slug (id = uuid for API calls).
 *     - call `onChanged()` after any write so the header counts, attention and members refresh
 *       (it refetches quietly, without a skeleton).
 *
 *   Primary header action: the header's primary button belongs to the active tab. Register it from
 *   inside the tab with the hook from ./primaryAction:
 *
 *       import { usePrimaryAction } from '../primaryAction';
 *       const [creating, setCreating] = useState(false);
 *       usePrimaryAction({ label: 'Create ticket', icon: 'plus', onClick: () => setCreating(true) });
 *
 *   It is removed automatically when the tab unmounts. Pass null for no button.
 *   Labels by tab: Overview / Updates "Post update", Tickets "Create ticket", SOPs "Create SOP",
 *   Demo accounts "Add demo account", Vault "Add credential", Files & links "Upload files"
 *   (icon "upload"), Team "Add person".
 *
 *   Deep links: read your own query param with useSearchParams() (?ticket=<key>, ?sop=<id>,
 *   ?credential=<id>, ?update=<id>). Links to other tabs: productPath(slug, tab, query) from hubUtils.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { hubErrorMessage, hubErrorStatus, hubService, HubTab, ProductDetail } from '../../services/hub.service';
import HubTopbar from './HubTopbar';
import ProductFormModal from './ProductFormModal';
import { PrimaryAction, PrimaryActionProvider } from './primaryAction';
import { Badge, ProductStatusBadge } from './ui/Badge';
import ConfirmDialog from './ui/ConfirmDialog';
import EmptyState from './ui/EmptyState';
import Icon from './ui/Icon';
import OverflowMenu from './ui/OverflowMenu';
import { Skeleton, SkeletonPage } from './ui/Skeleton';
import { useToast } from './ui/Toast';
import { useHubUsers } from './ui/users';
import { HUB_TABS, productPath } from './hubUtils';
import OverviewTab from './tabs/OverviewTab';
import UpdatesTab from './tabs/UpdatesTab';
import TicketsTab from './tabs/TicketsTab';
import SopsTab from './tabs/SopsTab';
import DemoAccountsTab from './tabs/DemoAccountsTab';
import VaultTab from './tabs/VaultTab';
import FilesTab from './tabs/FilesTab';
import TeamTab from './tabs/TeamTab';

export interface HubTabProps {
  product: ProductDetail;
  onChanged: () => void;
}

const TAB_COMPONENTS: Record<HubTab, React.FC<HubTabProps>> = {
  overview: OverviewTab,
  updates: UpdatesTab,
  tickets: TicketsTab,
  sops: SopsTab,
  'demo-accounts': DemoAccountsTab,
  vault: VaultTab,
  files: FilesTab,
  team: TeamTab,
};

const tabCount = (p: ProductDetail, tab: HubTab): number => {
  const c = p.counts || ({} as ProductDetail['counts']);
  switch (tab) {
    case 'updates':
      return c.updates || 0;
    case 'tickets':
      return c.openTickets || 0;
    case 'sops':
      return c.sops || 0;
    case 'demo-accounts':
      return c.demoAccounts || 0;
    case 'vault':
      return c.credentials || 0;
    case 'files':
      return c.files || 0;
    case 'team':
      return c.members ?? (p.members || []).length;
    default:
      return 0;
  }
};

const ProductPage: React.FC = () => {
  const { slug = '', tab: tabParam } = useParams<{ slug: string; tab?: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { byId } = useHubUsers();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [primary, setPrimary] = useState<PrimaryAction | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const tab: HubTab | null = !tabParam ? 'overview' : HUB_TABS.some((t) => t.key === tabParam) ? (tabParam as HubTab) : null;

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setProduct(null);
        setError(null);
      }
      try {
        const p = await hubService.getProductBySlug(slug);
        setProduct(p);
        setError(null);
      } catch (err) {
        if (!quiet) {
          const status = hubErrorStatus(err);
          setError({
            notFound: status === 404,
            message: status === 404 ? "There's no product at this address. It may have been renamed." : hubErrorMessage(err, "Couldn't load this product."),
          });
        }
      }
    },
    [slug],
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  const setPrimaryStable = useCallback((a: PrimaryAction | null) => setPrimary(a), []);

  if (!tab) return <Navigate to={productPath(slug)} replace />;

  const goTab = (t: HubTab) => navigate(productPath(slug, t));

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % HUB_TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + HUB_TABS.length) % HUB_TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = HUB_TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const key = HUB_TABS[next].key;
    tabRefs.current[key]?.focus();
    goTab(key);
  };

  const archive = async () => {
    if (!product) return;
    await hubService.archiveProduct(product.id);
    await load(true);
    toast.show(`${product.name} archived`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          try {
            await hubService.restoreProduct(product.id);
            await load(true);
            toast.show(`${product.name} restored`);
          } catch (err) {
            toast.error(`Couldn't restore ${product.name}. ${hubErrorMessage(err, '')}`.trim());
          }
        },
      },
    });
  };

  const restore = async () => {
    if (!product || restoring) return;
    setRestoring(true);
    try {
      await hubService.restoreProduct(product.id);
      await load(true);
      toast.show(`${product.name} restored`);
    } catch (err) {
      toast.error(`Couldn't restore ${product.name}. ${hubErrorMessage(err, '')}`.trim(), {
        action: { label: 'Retry', onClick: restore },
      });
    } finally {
      setRestoring(false);
    }
  };

  const tabLabel = HUB_TABS.find((t) => t.key === tab)?.label || '';
  const crumbs = [
    { label: 'All products', to: '/products' },
    { label: product?.name || (error ? 'Product' : 'Loading…'), to: productPath(slug) },
    ...(tab !== 'overview' ? [{ label: tabLabel }] : []),
  ];

  if (error) {
    return (
      <>
        <HubTopbar crumbs={crumbs.slice(0, 2)} />
        <main className="hub-page">
          <div className="hub-card">
            {error.notFound ? (
              <EmptyState
                icon="grid"
                title="Product not found"
                text={error.message}
                actionLabel="Go to All products"
                actionIcon="grid"
                onAction={() => navigate('/products')}
              />
            ) : (
              <EmptyState icon="alert" title="Couldn't load this product" text={error.message} actionLabel="Try again" actionIcon="refresh" onAction={() => load()} />
            )}
          </div>
        </main>
      </>
    );
  }

  const TabComponent = TAB_COMPONENTS[tab];
  const owner = product ? product.owner || byId(product.ownerId) : null;

  return (
    <>
      <HubTopbar crumbs={crumbs} />
      <main className="hub-page">
        <div className="hub-ph">
          <div className="hub-ph-text">
            {product ? (
              <>
                <h1>{product.name}</h1>
                {product.description ? <p>{product.description}</p> : null}
                <div className="hub-ph-meta">
                  <ProductStatusBadge status={product.status} version={product.version} />
                  <Badge plain>Owner: {owner?.name || 'Not set'}</Badge>
                  {product.code ? (
                    <Badge plain title="Ticket prefix">
                      <span className="hub-mono">{product.code}</span>
                    </Badge>
                  ) : null}
                  {product.archivedAt ? <Badge tone="warn">Archived</Badge> : null}
                </div>
              </>
            ) : (
              <div aria-busy="true" aria-label="Loading" style={{ display: 'grid', gap: 8 }}>
                <Skeleton width={220} height={26} />
                <Skeleton width={320} />
                <div className="hub-sk-row">
                  <Skeleton width={90} height={22} />
                  <Skeleton width={110} height={22} />
                </div>
              </div>
            )}
          </div>
          {product && (
            <div className="hub-ph-actions">
              <button type="button" className="hub-btn" onClick={() => setEditing(true)}>
                <Icon name="edit" />
                Edit product
              </button>
              {product.archivedAt ? (
                <button type="button" className="hub-btn" onClick={restore} disabled={restoring}>
                  {restoring ? <span className="hub-spin" aria-hidden="true" /> : <Icon name="restore" />}
                  {restoring ? 'Restoring…' : 'Restore'}
                </button>
              ) : (
                <OverflowMenu
                  size="md"
                  label={`More actions for ${product.name}`}
                  items={[{ label: 'Archive product', icon: 'archive', danger: true, onSelect: () => setConfirmArchive(true) }]}
                />
              )}
              {primary && !product.archivedAt ? (
                <button type="button" className="hub-btn hub-btn-primary" onClick={primary.onClick} disabled={primary.disabled} title={primary.title}>
                  <Icon name={primary.icon || 'plus'} />
                  {primary.label}
                </button>
              ) : null}
            </div>
          )}
        </div>

        {product?.archivedAt ? (
          <div className="hub-notice hub-warn">
            <Icon name="archive" />
            <div className="hub-grow">
              <b>This product is archived.</b> It's hidden from All products and search. Restore it to work on it again.
            </div>
          </div>
        ) : null}

        <div className="hub-tabs" role="tablist" aria-label={product ? `${product.name} sections` : 'Product sections'}>
          {HUB_TABS.map((t, i) => {
            const n = product ? tabCount(product, t.key) : 0;
            const selected = t.key === tab;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[t.key] = el;
                }}
                type="button"
                role="tab"
                id={`hub-tab-${t.key}`}
                aria-selected={selected}
                aria-controls="hub-tabpanel"
                tabIndex={selected ? 0 : -1}
                className="hub-tab"
                onClick={() => goTab(t.key)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {t.label}
                {n ? (
                  <span className="hub-n">
                    {n}
                    <span className="hub-sr"> {t.key === 'tickets' ? 'open' : 'items'}</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id="hub-tabpanel" aria-labelledby={`hub-tab-${tab}`}>
          {product ? (
            <PrimaryActionProvider value={setPrimaryStable}>
              <TabComponent key={`${product.id}-${tab}`} product={product} onChanged={refresh} />
            </PrimaryActionProvider>
          ) : (
            <SkeletonPage />
          )}
        </div>
      </main>

      {editing && product && (
        <ProductFormModal
          product={product}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            if (saved?.slug && saved.slug !== product.slug) navigate(productPath(saved.slug, tab), { replace: true });
            else refresh();
          }}
        />
      )}
      {confirmArchive && product && (
        <ConfirmDialog
          title={`Archive ${product.name}?`}
          body={
            <>
              It disappears from All products and search. Nothing is deleted, and you can restore it any time with <b>Show archived</b>.
            </>
          }
          confirmLabel="Archive product"
          busyLabel="Archiving…"
          onConfirm={archive}
          onClose={() => setConfirmArchive(false)}
        />
      )}
    </>
  );
};

export default ProductPage;
