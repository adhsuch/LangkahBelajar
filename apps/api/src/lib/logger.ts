export function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  console[level](JSON.stringify({ time: new Date().toISOString(), level, service: "core-api", event, ...fields }));
}
