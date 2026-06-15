/** Resolve a public/ asset path for static export and sub-path deployments. */
export const resolveAssetUrl = (path: string): string => {
  if (typeof window === 'undefined') return `/${path}`;
  const loc = window.location;
  let dir = loc.pathname;
  if (!dir.endsWith('/')) {
    dir = dir.replace(/[^/]*$/, '') + '/';
  }
  return new URL(path, loc.origin + dir).href;
};
