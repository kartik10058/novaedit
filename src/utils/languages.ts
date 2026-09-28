export const LANGUAGES: { id: string; label: string }[] = [
  { id: 'javascript', label: 'JavaScript' }, { id: 'typescript', label: 'TypeScript' }, { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' }, { id: 'json', label: 'JSON' }, { id: 'python', label: 'Python' }, { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' }, { id: 'java', label: 'Java' }, { id: 'csharp', label: 'C#' }, { id: 'php', label: 'PHP' },
  { id: 'go', label: 'Go' }, { id: 'rust', label: 'Rust' }, { id: 'sql', label: 'SQL' }, { id: 'markdown', label: 'Markdown' },
  { id: 'xml', label: 'XML' }, { id: 'yaml', label: 'YAML' }, { id: 'shell', label: 'Shell' }, { id: 'powershell', label: 'PowerShell' },
  { id: 'scss', label: 'SCSS' }, { id: 'plaintext', label: 'Plain Text' },
];
const EXT: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', tsx: 'typescript', mts: 'typescript',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', json: 'json', jsonc: 'json', py: 'python', c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', java: 'java', cs: 'csharp', php: 'php', go: 'go', rs: 'rust',
  sql: 'sql', md: 'markdown', markdown: 'markdown', xml: 'xml', svg: 'xml', yml: 'yaml', yaml: 'yaml',
  sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell', txt: 'plaintext', log: 'plaintext',
};
export function detectLanguage(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower === 'dockerfile' || lower === 'makefile') return 'shell';
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : '';
  return EXT[ext] ?? 'plaintext';
}
export const languageLabel = (id: string) => LANGUAGES.find((l) => l.id === id)?.label ?? id;
