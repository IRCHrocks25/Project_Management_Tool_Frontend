/** Fresh links for a file's private pictures. Links expire, so what's drawn comes from here rather than stored state. */
const links = new Map<string, string>();

export function setAssetLinks(next: Record<string, string> | undefined) {
  Object.entries(next || {}).forEach(([id, url]) => links.set(id, url));
}

export const setAssetLink = (assetId: string, url: string) => links.set(assetId, url);

export const resolveSrc = (assetId: string | null | undefined, src: string | null | undefined) =>
  (assetId && links.get(assetId)) || src || null;

/** Copies a document's JSON with every picture pointing at a working link, for exports. */
export function withResolvedPictures<T>(node: T): T {
  if (Array.isArray(node)) return node.map(withResolvedPictures) as unknown as T;
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(node as Record<string, unknown>).forEach(([k, v]) => (out[k] = withResolvedPictures(v)));
    if (typeof out.assetId === 'string') out.src = resolveSrc(out.assetId as string, out.src as string);
    return out as T;
  }
  return node;
}
