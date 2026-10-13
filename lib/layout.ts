/** Sizing rules for the resizable chat / board split (desktop layout). */

export const CHAT_WIDTH_DEFAULT = 440;
export const CHAT_WIDTH_MIN = 300;
export const CHAT_WIDTH_MAX = 760;
/** The board column never goes below this while dragging. */
export const BOARD_MIN_WIDTH = 380;
export const CHAT_WIDTH_STORAGE_KEY = "coverage-agent-chat-width";

/**
 * Clamp a requested chat-column width so the chat stays usable and the
 * board keeps at least BOARD_MIN_WIDTH. On containers too narrow to
 * satisfy both, the chat minimum wins.
 */
export function clampChatWidth(width: number, containerWidth: number): number {
  const max = Math.max(
    CHAT_WIDTH_MIN,
    Math.min(CHAT_WIDTH_MAX, containerWidth - BOARD_MIN_WIDTH),
  );
  return Math.round(Math.min(Math.max(width, CHAT_WIDTH_MIN), max));
}

/** Parse a persisted chat width; returns null when missing or invalid. */
export function parseStoredChatWidth(raw: string | null): number | null {
  const v = Number(raw);
  return Number.isFinite(v) && v >= CHAT_WIDTH_MIN && v <= CHAT_WIDTH_MAX
    ? Math.round(v)
    : null;
}
