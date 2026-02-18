export function isEmptyHtml(html: string): boolean {
  return !html || html === '<p></p>' || html.trim() === ''
}
