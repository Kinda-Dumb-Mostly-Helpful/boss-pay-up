import { createContext, useContext } from "react";

export interface LoginUser { expires_at?: string; id: string; username: string; display_name: string; role: "admin" | "user"; language: import("./languages").Language; currency: import("./currency").Currency; }
export const PreferencesContext = createContext<{ save: (language: LoginUser["language"], currency: LoginUser["currency"]) => Promise<void>; saving: boolean }>({ save: async () => {}, saving: false });
export const AuthContext = createContext<LoginUser | null>(null);
export const useLoginUser = () => useContext(AuthContext);
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { ...init, credentials: "include" });
  if (response.status === 401 && !String(input).endsWith("/auth/login")) {
    window.dispatchEvent(new Event("session-expired"));
  }
  return response;
}
export async function authRequest(path: string, body?: unknown) {
  const response = await apiFetch(`/api/auth/${path}`, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "请检查输入内容（密码至少 8 位）");
  return data;
}
