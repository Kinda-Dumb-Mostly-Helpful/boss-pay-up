import { useTranslation, translate } from "../i18n";
import { useEffect, useState, useRef, useContext } from "react";
import { currencies, isCurrency } from "../currency";
import { languages } from "../languages";
import type { ReactNode } from "react";
import { AuthContext, PreferencesContext, authRequest } from "../auth";
import type { LoginUser } from "../auth";

const devUsername = import.meta.env.DEV ? (import.meta.env.VITE_DEV_LOGIN_USERNAME || "") : "";
const devPassword = import.meta.env.DEV ? (import.meta.env.VITE_DEV_LOGIN_PASSWORD || "") : "";
const sessionHistoryKey = "reimbursement-session-started";
function rememberSession() { try { localStorage.setItem(sessionHistoryKey, "1"); } catch { /* Storage may be disabled. */ } }
function canAutoLogin() { try { return !localStorage.getItem(sessionHistoryKey); } catch { return false; } }

export default function LoginGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginUser | null>(null);
  const language = user?.language || "zh-CN";
  const t = (text: string) => translate(text, language);
  const logoSrc = `${import.meta.env.BASE_URL}branding/boss-pay-up-logo-${language}.png`;
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false);
  const [username, setUsername] = useState(devUsername);
  const [password, setPassword] = useState(devPassword);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const sessionVersion = useRef(0);
  useEffect(() => {
    if (!user) return;
    rememberSession();
    const deadline = Date.parse(user.expires_at || "");
    const expire = () => window.dispatchEvent(new Event("session-expired"));
    const timer = Number.isFinite(deadline) ? window.setTimeout(expire, Math.max(0, deadline - Date.now())) : undefined;
    const check = () => {
      if (Number.isFinite(deadline) && Date.now() >= deadline) expire();
      else void authRequest("me").catch(() => {});
    };
    const visible = () => { if (document.visibilityState === "visible") check(); };
    const interval = window.setInterval(check, 30000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", visible);
    return () => { clearTimeout(timer); clearInterval(interval); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", visible); };
  }, [user?.id, user?.expires_at]);
  useEffect(() => {
    document.documentElement.lang = user?.language || "zh-CN";
    document.title = translate("老板打钱", user?.language || "zh-CN");
  }, [user?.language]);
  useEffect(() => {
    const expired = () => { sessionVersion.current++; rememberSession(); setUser(null); setManage(false); setBusy(false); setSavingPreferences(false); setUsername(devUsername); setPassword(devPassword); setError("登录已过期，请重新登录"); };
    window.addEventListener("session-expired", expired);
    async function load() {
      try {
        const state = await authRequest("setup-status");
        setSetup(state.needs_setup);
        if (!state.needs_setup) {
          const allowDevLogin = import.meta.env.DEV && canAutoLogin();
          try { setUser(await authRequest("me")); } catch {
            if (allowDevLogin) {
              try { setUser(await authRequest("dev-login", {})); setError(""); } catch { /* Fall back to normal login when development login is disabled. */ }
            }
          }
        }
      } catch (error) { setError(error instanceof Error ? error.message : "连接失败，请刷新重试"); }
      finally { setLoading(false); }
    }
    load();
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (setup) { await authRequest("setup", { username, password, display_name: displayName }); setSetup(false); }
      setUser(await authRequest("login", { username, password }));
      setPassword("");
    } catch (error) { setError(error instanceof Error ? error.message : "登录失败"); }
    finally { setBusy(false); }
  }
  if (loading) return <div className="login-page">{t("正在检查登录状态…")}</div>;
  if (!user) return <div className="login-page"><form className="login-card" onSubmit={submit}>
    <div className="login-brand"><img className="login-logo" src={logoSrc} alt={t("老板打钱")} width={128} height={128} /><h1>{t("老板打钱")}</h1></div><h2>{setup ? t("首次使用 · 创建管理员") : t("账号登录")}</h2>
    {setup && <p>{t("创建管理员账号后，可在用户管理中添加其他用户。")}</p>}
    <label>{t("用户名")}<input required maxLength={64} autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} disabled={busy} /></label>
    {setup && <label>{t("姓名")}<input required maxLength={64} value={displayName} onChange={event => setDisplayName(event.target.value)} disabled={busy} /></label>}
    <label>{t("密码")}<input required type="password" minLength={setup ? 8 : 1} maxLength={128} autoComplete={setup ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>
    {error && <p role="alert" className="field-error">{t(error)}</p>}
    <button className="btn btn-primary" disabled={busy}>{busy ? t("处理中…") : setup ? t("创建管理员并登录") : t("登录")}</button>
  </form></div>;
  return <AuthContext.Provider value={user}>
    <PreferencesContext.Provider value={{ saving: savingPreferences, save: async (language, currency) => {
      const version = sessionVersion.current;
      setSavingPreferences(true); setError("");
      try { const updated = await authRequest("preferences", { language, currency }); if (version === sessionVersion.current) setUser(previous => previous ? { ...previous, ...updated } : null); }
      catch (error) { setError(error instanceof Error ? error.message : "设置保存失败"); throw error; }
      finally { setSavingPreferences(false); }
    } }}>
    <header className="account-bar">
      <div className="system-brand"><img className="project-logo" src={logoSrc} alt={t("老板打钱")} width={48} height={48} /><div><h1>{t("老板打钱")}</h1><p>{t("费用管理 · 批次审批 · 历史归档")}</p></div></div>
      <div className="account-actions"><div className="account-identity"><span className="user-avatar" aria-hidden="true">{user.display_name.slice(0, 1).toUpperCase()}</span><div><strong>{user.display_name}</strong><small>{user.username} · {user.role === "admin" ? t("管理员") : t("普通用户")}</small></div></div>
      <AccountMenu manage={manage} busy={busy} onManage={() => setManage(!manage)} onLogout={async () => {
        setBusy(true); setError("");
        try { await authRequest("logout", {}); sessionVersion.current++; rememberSession(); setUser(null); setManage(false); setUsername(devUsername); setPassword(devPassword); }
        catch (error) { setError(error instanceof Error ? error.message : "退出失败，请重试"); }
        finally { setBusy(false); }
      }} />
      </div>
    </header>
    {error && <p role="alert" className="field-error">{t(error)}</p>}
    {manage ? <UserManager /> : children}
    </PreferencesContext.Provider>
  </AuthContext.Provider>;
}

function AccountMenu({ manage, busy, onManage, onLogout }: { manage: boolean; busy: boolean; onManage: () => void; onLogout: () => Promise<void> }) {
  const user = useContext(AuthContext)!;
  const preferences = useContext(PreferencesContext);
  const t = useTranslation();
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const close = () => { if (menu.current) menu.current.open = false; };
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && menu.current?.open) { close(); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  return <details className="account-menu" ref={menu} onBlur={event => {
    // Native select popups can temporarily move focus outside the document.
    // Keep the menu mounted until focus reaches an actual external element.
    const next = event.relatedTarget;
    if (next instanceof Node && !event.currentTarget.contains(next)) close();
  }}>
    <summary ref={trigger} aria-label={t("账号菜单")} title={t("账号菜单")}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </summary>
    <div className="account-menu-panel">
      <div className="account-menu-heading">{t("账号设置")}</div>
      {user.role === "admin" && <button className="account-menu-action" onClick={() => { onManage(); close(); }}>{manage ? t("返回报销") : t("用户管理")}<span aria-hidden="true">↗</span></button>}
      <label>{t("语言")}<select value={user.language} disabled={preferences.saving} onChange={event => { void preferences.save(event.target.value as LoginUser["language"], user.currency).catch(() => {}); }}>{Object.entries(languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <label>{t("显示币种")}<select value={user.currency} disabled={preferences.saving} onChange={event => { if (isCurrency(event.target.value)) void preferences.save(user.language, event.target.value).catch(() => {}); }}>{Object.entries(currencies).map(([code, name]) => <option key={code} value={code}>{t(name)} ({code})</option>)}</select></label>
      <small role="status">{preferences.saving ? t("保存中…") : t("设置已保存到账号")}</small>
      <button className="account-menu-action account-menu-logout" disabled={busy || preferences.saving} onClick={() => { close(); void onLogout(); }}>{t("退出登录")}<span aria-hidden="true">↪</span></button>
    </div>
  </details>;
}

function UserManager() {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { authRequest("users").then(setUsers).catch(error => setError(error.message)).finally(() => setLoading(false)); }, []);
  const filtered = users.filter(user => (roleFilter === "all" || user.role === roleFilter) && `${user.username} ${user.display_name}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="user-manager">
    <div className="users-heading"><div><h2>{t("用户管理")}</h2><p>{t("管理登录账号与角色，审批操作自动关联用户身份。")}</p></div><span className="users-total">{users.length} {t("个账号 ·")}{users.filter(user => user.role === "admin").length} {t("位管理员")}</span></div>
    {error && <p className="users-alert error" role="alert">{t(error)}</p>}{message && <p className="users-alert success" role="status">{t(message)}</p>}
    <div className="users-layout">
    <aside className="user-create-card"><h3>{t("新增账号")}</h3><p>{t("填写账号信息，为团队成员开通访问。")}</p>
    <form className="user-create-form" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
      try {
        await authRequest("users", { username, display_name: name, password, role });
        setPassword(""); setUsername(""); setName(""); setMessage("用户已添加");
        setUsers(await authRequest("users"));
      } catch (error) { setError(error instanceof Error ? error.message : "添加失败"); }
      finally { setBusy(false); }
    }}>
      <label>{t("用户名")}<input required maxLength={64} value={username} disabled={busy} placeholder={t("用于登录，例如 zhangsan")} onChange={event => setUsername(event.target.value)} autoComplete="off" /></label>
      <label>{t("姓名")}<input required maxLength={64} value={name} disabled={busy} placeholder={t("用于审批记录的显示名称")} onChange={event => setName(event.target.value)} /></label>
      <label>{t("登录密码")}<input required type="password" minLength={8} maxLength={128} value={password} disabled={busy} placeholder={t("至少 8 位")} onChange={event => setPassword(event.target.value)} autoComplete="new-password" /></label>
      <label>{t("角色")}<select value={role} disabled={busy} onChange={event => setRole(event.target.value)}><option value="user">{t("普通用户")}</option><option value="admin">{t("管理员")}</option></select></label>
      <div className="role-description">{role === "admin" ? t("管理员可添加账号，并使用报销及审批功能。") : t("普通用户可使用报销及审批功能。")}</div>
      <button className="btn btn-primary" disabled={busy}>{busy ? t("正在创建…") : t("＋ 创建账号")}</button>
    </form>
    </aside>
    <div className="users-list-card">
      <div className="users-list-heading"><h3>{t("账号列表")}<span>{filtered.length}</span></h3><div className="users-list-filters"><input aria-label={t("搜索用户")} placeholder={t("搜索姓名或用户名")} value={query} onChange={event => setQuery(event.target.value)} /><select aria-label={t("按角色筛选")} value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="all">{t("全部角色")}</option><option value="admin">{t("管理员")}</option><option value="user">{t("普通用户")}</option></select></div></div>
      <div className="users-table-scroll"><table><thead><tr><th>{t("用户")}</th><th>{t("登录账号")}</th><th>{t("角色")}</th></tr></thead><tbody>{filtered.map(user => <tr key={user.id}><td><div className="user-cell"><span className="user-avatar" aria-hidden="true">{user.display_name.slice(0, 1).toUpperCase()}</span><strong>{user.display_name}</strong></div></td><td className="user-login-name">{user.username}</td><td><span className={`user-role ${user.role}`}>{user.role === "admin" ? t("管理员") : t("普通用户")}</span></td></tr>)}
      {!filtered.length && <tr><td colSpan={3} className="users-empty">{loading ? t("正在加载账号…") : t("暂无匹配的用户")}</td></tr>}
      </tbody></table></div>
      <p className="users-list-note">{t("所有登录用户共享现有报销数据；仅管理员可管理账号。")}</p>
    </div></div>
  </section>;
}
