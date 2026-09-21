/**
 * Headline markup: *word* becomes the serif italic aside — the one
 * decoration the copy is allowed. Everything else is escaped.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const emph = (s: string) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
export const plain = (s: string) => s.replace(/\*/g, '');
