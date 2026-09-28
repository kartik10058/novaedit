export const basename = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;
export const dirname = (p: string) => {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i <= 0 ? p.slice(0, i + 1) || p : p.slice(0, i);
};
export function relativeTo(root: string, p: string) {
  return p.startsWith(root) ? p.slice(root.length).replace(/^[\\/]/, '') : p;
}
export const isInside = (parent: string, p: string) => p === parent || p.startsWith(parent + '\\') || p.startsWith(parent + '/');
