/**
 * Drawer — side panel for detail views (ticket, credential, …). Same API as Modal minus `size`,
 * plus an optional `eyebrow` line above the title (e.g. the ticket key).
 *
 *   {openId && (
 *     <Drawer eyebrow="CF-12" title="Avatar preview fails" onClose={() => setOpenId(null)}
 *       footer={<div className="hub-acts">…</div>}>
 *       <dl className="hub-props">…</dl>
 *     </Drawer>
 *   )}
 */
export { Drawer } from './Modal';
export type { DrawerProps } from './Modal';
export { Drawer as default } from './Modal';
