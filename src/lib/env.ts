// Which data backend this build is talking to.
// Tauri desktop build → native SQLite (offline). Web/PWA build → PHP REST API.

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}
