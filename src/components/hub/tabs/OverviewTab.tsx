/**
 * Overview tab — Needs attention, latest 3 updates, "Start here" SOP (if any), environments and
 * who to ask. Header action: "Post update".
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hubErrorMessage, hubService, ProductDetail, ProductSop, ProductUpdate } from '../../../services/hub.service';
import { usePrimaryAction } from '../primaryAction';
import EmptyState from '../ui/EmptyState';
import Icon from '../ui/Icon';
import { SkeletonFeed } from '../ui/Skeleton';
import { Who } from '../ui/Avatar';
import { currentHubUser, useHubUsers } from '../ui/users';
import { productPath } from '../hubUtils';
import { UpdatePost } from './UpdatesTab';
import { PostUpdateModal } from './UpdateModals';

export interface OverviewTabProps {
  product: ProductDetail;
  onChanged: () => void;
}

const ATTN_ICON = { critical: 'alert', warning: 'alert', info: 'info' } as const;
const ATTN_CLASS = { critical: 'hub-crit', warning: 'hub-warn', info: 'hub-info' } as const;

const OverviewTab: React.FC<OverviewTabProps> = ({ product, onChanged }) => {
  const navigate = useNavigate();
  const { byId } = useHubUsers();
  const [updates, setUpdates] = useState<ProductUpdate[] | null>(null);
  const [updatesError, setUpdatesError] = useState<string | null>(null);
  const [startSop, setStartSop] = useState<ProductSop | null>(null);
  const [posting, setPosting] = useState(false);

  usePrimaryAction({ label: 'Post update', icon: 'plus', onClick: () => setPosting(true) });

  const loadUpdates = useCallback(async () => {
    setUpdatesError(null);
    try {
      const list = await hubService.listUpdates(product.id);
      setUpdates((list || []).slice(0, 3));
    } catch (err) {
      setUpdatesError(hubErrorMessage(err, "Couldn't load the updates."));
    }
  }, [product.id]);

  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

  useEffect(() => {
    let alive = true;
    // SOPs come from another module; if it isn't available yet the card is simply not shown.
    hubService
      .listSops(product.id)
      .then((list) => alive && setStartSop((list || [])[0] || null))
      .catch(() => alive && setStartSop(null));
    return () => {
      alive = false;
    };
  }, [product.id]);

  const attention = product.attention || [];
  const envs = (product.links || []).filter((l) => l.kind === 'environment').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const members = product.members || [];

  return (
    <div className="hub-cols">
      <div className="hub-stack">
        {attention.length > 0 && (
          <section className="hub-sec" aria-labelledby="hub-attn-h">
            <div className="hub-sec-h">
              <h2 id="hub-attn-h">Needs attention</h2>
            </div>
            <div className="hub-card">
              {attention.map((a, i) => (
                <div className="hub-attn-row" key={`${a.message}-${i}`}>
                  <Icon name={ATTN_ICON[a.level] || 'info'} className={ATTN_CLASS[a.level]} />
                  <span>{a.message}</span>
                  <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" onClick={() => navigate(productPath(product.slug, a.tab))}>
                    View<span className="hub-sr">: {a.message}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="hub-sec" aria-labelledby="hub-latest-h">
          <div className="hub-sec-h">
            <h2 id="hub-latest-h">Latest updates</h2>
            <div className="hub-sp">
              <Link className="hub-link" to={productPath(product.slug, 'updates')}>
                View all updates
              </Link>
            </div>
          </div>
          {updatesError ? (
            <div className="hub-card">
              <EmptyState icon="alert" title="Couldn't load the updates" text={updatesError} actionLabel="Try again" actionIcon="refresh" onAction={loadUpdates} />
            </div>
          ) : !updates ? (
            <SkeletonFeed count={2} />
          ) : updates.length ? (
            <div className="hub-feed">
              {updates.map((u) => (
                <UpdatePost key={u.id} update={u} compact openTo={productPath(product.slug, 'updates', `update=${u.id}`)} />
              ))}
            </div>
          ) : (
            <div className="hub-card">
              <EmptyState
                icon="msg"
                title="No updates yet"
                text="Updates keep everyone in the loop on progress, releases and blockers."
                actionLabel="Post the first update"
                onAction={() => setPosting(true)}
              />
            </div>
          )}
        </section>
      </div>

      <div className="hub-stack">
        {startSop && (
          <section className="hub-card" style={{ padding: 'var(--s4)', display: 'grid', gap: 'var(--s2)' }}>
            <span className="hub-muted hub-small">New to {product.name}? Start here</span>
            <Link className="hub-link" style={{ fontSize: 15 }} to={productPath(product.slug, 'sops', `sop=${startSop.id}`)}>
              <Icon name="book" />
              {startSop.title}
            </Link>
            <span className="hub-muted hub-small">
              {(startSop.steps || []).length} steps
              {startSop.owner || startSop.ownerId ? ` · maintained by ${(startSop.owner || byId(startSop.ownerId))?.name || 'someone'}` : ''}
            </span>
          </section>
        )}

        <section className="hub-sec" aria-labelledby="hub-env-h">
          <div className="hub-sec-h">
            <h2 id="hub-env-h">Environments</h2>
            <div className="hub-sp">
              <Link className="hub-link" to={productPath(product.slug, 'files')}>
                Files & links
              </Link>
            </div>
          </div>
          <div className="hub-card">
            {envs.length ? (
              envs.map((e) => (
                <div className="hub-list-row" key={e.id}>
                  <span className="hub-grow">
                    <div className="hub-t">{e.label}</div>
                    <a className="hub-s hub-mono" href={e.url} target="_blank" rel="noopener noreferrer">
                      {e.url.replace(/^https?:\/\//, '')}
                    </a>
                  </span>
                  <a className="hub-icon-btn hub-sm" href={e.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${e.label} in a new tab`}>
                    <Icon name="ext" />
                  </a>
                </div>
              ))
            ) : (
              <div className="hub-list-row hub-muted">No environments yet. Add them in Files & links.</div>
            )}
          </div>
        </section>

        <section className="hub-sec" aria-labelledby="hub-ask-h">
          <div className="hub-sec-h">
            <h2 id="hub-ask-h">Who to ask</h2>
            <div className="hub-sp">
              <Link className="hub-link" to={productPath(product.slug, 'team')}>
                Team
              </Link>
            </div>
          </div>
          <div className="hub-card">
            {members.length ? (
              members.map((m) => (
                <div className="hub-list-row" key={m.id}>
                  <span className="hub-grow">
                    <div className="hub-t">{m.area}</div>
                    {m.askAbout ? <div className="hub-s">{m.askAbout}</div> : null}
                  </span>
                  <Who user={m.user || byId(m.userId)} fallback="Unknown person" />
                </div>
              ))
            ) : (
              <div className="hub-list-row hub-muted">No one assigned yet. Add people in Team.</div>
            )}
          </div>
        </section>
      </div>

      {posting && (
        <PostUpdateModal
          product={product}
          onClose={() => setPosting(false)}
          onPosted={(u) => {
            if (u && u.id) setUpdates((list) => [{ ...u, comments: u.comments || [], files: u.files || [], author: u.author || currentHubUser() }, ...(list || [])].slice(0, 3));
            else loadUpdates();
            onChanged();
          }}
        />
      )}
    </div>
  );
};

export default OverviewTab;
