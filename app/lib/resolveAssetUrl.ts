/** Resolve a public/ asset path for static export and sub-path deployments. */
const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const normalizePath = (path: string): string => path.replace(/^\/+/, '');

export const resolveAssetUrl = (path: string): string => {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  const cleanPath = normalizePath(path);
  if (PUBLIC_BASE_PATH) {
    return `${PUBLIC_BASE_PATH.replace(/\/$/, '')}/${cleanPath}`;
  }
  return `./${cleanPath}`;
};
