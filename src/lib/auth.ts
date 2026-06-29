// Auth/token storage. The web build uses a bearer token from the PHP API;
// the Tauri build (next chunk) will verify a local password instead.

import { isTauri } from "./env";

const TOKEN_KEY = "fv_api_token";
const API_BASE = ((import.meta as any).env?.VITE_API_URL as string) || "/api";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Web login: exchanges the password for a bearer token via the API. */
export async function loginWeb(password: string): Promise<boolean> {
  try {
    const res = await fetch(API_BASE + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { token?: string };
    if (!data.token) return false;
    setToken(data.token);
    return true;
  } catch {
    return false;
  }
}

/** Whether the current build has a valid-looking session. */
export function isAuthed(): boolean {
  // Tauri local-auth gate is added in the next chunk; for now the desktop build
  // is always considered authed (offline, no server). Web requires a token.
  if (isTauri()) return true;
  return !!getToken();
}

export function logout(): void {
  clearToken();
}
