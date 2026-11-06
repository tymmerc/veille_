// Client-safe (no fs): Claude Desktop deep link that opens Claude Code with the composer
// prefilled. Nothing is sent until the user presses Enter.
export function claudeLink(prompt: string): string {
  return `claude://code/new?q=${encodeURIComponent(prompt)}`;
}
