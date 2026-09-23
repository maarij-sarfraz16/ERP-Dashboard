/** `"2026-09-18"` → `"Fri 18 Sept"`, the day an attendance figure describes. */
export function formatAttendanceDate(iso: string | null): string {
  if (!iso) return "no attendance posted";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
