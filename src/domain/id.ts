/**
 * Generate a random UUID v4.
 * Uses Math.random() — sufficient for local offline IDs before Wave 1 auth
 * provides server-assigned identifiers.
 */
export function newId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
