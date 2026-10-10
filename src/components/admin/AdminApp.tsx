"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CarFront,
  ChevronRight,
  Clock3,
  FileDown,
  FlaskConical,
  Gauge,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import type { Catalogue } from "@/lib/types";
import { api, ApiError } from "@/lib/client-api";
import { Brand, Button, Notice } from "@/components/ui";
import { AdminContext, type AdminData } from "./context";
import { Dashboard } from "./Dashboard";
import { BookingManager } from "./BookingManager";
import { CatalogueEditors } from "./CatalogueEditors";
import { SettingsEditors } from "./SettingsEditors";
import { AdminSignIn } from "./AdminSignIn";
const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["bookings", "Appointments", CalendarDays],
  ["services", "Services & tiers", Sparkles],
  ["products", "Treatment materials", FlaskConical],
  ["vehicles", "Vehicle library", CarFront],
  ["prices", "Pricing matrix", Gauge],
  ["packages", "Care packages", Layers3],
  ["schedule", "Studio schedule", Clock3],
  ["site", "Site editor", Palette],
  ["staff", "Team & access", UsersRound],
  ["reports", "Reports & exports", FileDown],
  ["audit", "Activity log", Activity],
] as const;
export function AdminApp({
  section = "overview",
  demo,
}: {
  section?: string;
  demo: boolean;
}) {
  const [actor, setActor] = useState<{
    name: string;
    role: string;
    mfa?: boolean;
  } | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [draft, setDraft] = useState<Catalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [mobile, setMobile] = useState(false);
  const reload = useCallback(async () => {
    const d = await api<AdminData>("admin/data");
    setData(d);
    setDraft(d.draft);
    setDirty(false);
  }, []);
  useEffect(() => {
    api<{ actor: { name: string; role: string; mfa?: boolean } | null }>(
      "session"
    )
      .then(async (s) => {
        if (s.actor && s.actor.role !== "customer" && s.actor.mfa) {
          setActor(s.actor);
          await reload();
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [reload]);
  async function run(
    task: () => Promise<unknown>,
    success: string,
    refresh = true
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      if (refresh) await reload();
      setMessage(success);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function login(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("auth/demo-owner", "POST", {});
      const s = await api<{
        actor: { name: string; role: string; mfa?: boolean };
      }>("session");
      setActor(s.actor);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(fn: (c: Catalogue) => void) {
    if (!draft) return;
    const next = structuredClone(draft);
    fn(next);
    setDraft(next);
    setDirty(true);
    setMessage("");
  }
  async function save() {
    if (!draft || !data) return;
    await run(
      () =>
        api("admin/catalogue", "PUT", {
          catalogue: draft,
          baseRevisionId: data.activeRevisionId,
          draftVersion: data.draftVersion,
        }),
      "Draft saved. Public content is unchanged."
    );
  }
  async function publish() {
    if (!draft || !data) return;
    await run(async () => {
      let draftVersion = data.draftVersion;
      if (dirty) {
        const saved = await api<{ draftVersion: number }>(
          "admin/catalogue",
          "PUT",
          {
            catalogue: draft,
            baseRevisionId: data.activeRevisionId,
            draftVersion,
          }
        );
        draftVersion = saved.draftVersion;
        // The draft save succeeded even if the subsequent publication fails.
        // Keep the editor's optimistic version in sync so corrections can save.
        setData(current => current ? {
          ...current,
          draft: structuredClone(draft),
          draftVersion,
          draftBaseRevisionId: data.activeRevisionId,
        } : current);
        setDirty(false);
      }
      try {
        return await api("admin/publish", "POST", {
          baseRevisionId: data.activeRevisionId,
          draftVersion,
        });
      } catch (error) {
        if (error instanceof ApiError && error.code === "PUBLICATION_INVALID") {
          setMessage("Draft saved. Publication was blocked; your live site is unchanged. Resolve the issues below. For missing prices, fill in the pricing matrix or disable the affected offers before publishing.");
        }
        throw error;
      }
    }, "Published. Your storefront now reflects these changes.");
  }
  if (loading)
    return (
      <main className="admin-login">
        <Brand />
        <p className="loading-label">Opening your studio workspace…</p>
      </main>
    );
  if (!actor || !data)
    return (
      <main className="admin-login">
        <div className="admin-login-card">
          <Brand />
          <div className="admin-login-icon">
            <ShieldCheck size={31} />
          </div>
          <span className="section-kicker">THE STUDIO WORKSPACE</span>
          <h1>
            GOOD CARE.
            <br />
            BEHIND THE SCENES.
          </h1>
          <p>
            Manage treatments, appointments and the details that keep your
            studio moving.
          </p>
          {error && <Notice error>{error}</Notice>}
          {demo ? (
            <>
              <Notice>
                Local demo dashboard. Changes are saved on this computer. Live
                access requires a verified staff account and two-factor
                authentication.
              </Notice>
              <Button onClick={() => login()} disabled={busy}>
                {busy ? "Opening…" : "Open demo dashboard"}
                <ArrowUpRight size={16} />
              </Button>
            </>
          ) : (
            <AdminSignIn onAuthenticated={async () => {
              const s = await api<{ actor: { name: string; role: string; mfa?: boolean } }>("session");
              await reload();
              setActor(s.actor);
            }} />
          )}
          <Link href="/" className="back-link">
            Back to the storefront <ArrowUpRight size={14} />
          </Link>
        </div>
      </main>
    );
  const selected = nav.find((n) => n[0] === section) ?? nav[0];
  const editable = [
    "services",
    "products",
    "vehicles",
    "prices",
    "packages",
    "schedule",
    "site",
  ].includes(section);
  const staffOnly = actor.role === "staff";
  return (
    <AdminContext.Provider
      value={{ data, draft, demo, role: actor.role, busy, edit, run, reload }}
    >
      <div className="admin-shell">
        <aside className={`admin-sidebar ${mobile ? "sidebar-open" : ""}`}>
          <div className="admin-brand">
            <Brand small />
            <button
              className="admin-mobile-close"
              onClick={() => setMobile(false)}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>
          <div className="studio-switch">
            <span className="studio-initials">BS</span>
            <div>
              <strong>Studio workspace</strong>
              <small>
                {demo ? "Local demonstration" : "Single-location studio"}
              </small>
            </div>
            <Settings2 size={15} />
          </div>
          <div className="sidebar-section">YOUR STUDIO</div>
          <nav aria-label="Studio navigation">
            {nav
              .filter(
                (n) => !staffOnly || ["overview", "bookings"].includes(n[0])
              )
              .map(([id, label, Icon], i) => (
                <Link
                  key={id}
                  href={id === "overview" ? "/admin" : `/admin/${id}`}
                  onClick={() => setMobile(false)}
                  className={section === id ? "active" : ""}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {id === "bookings" && (
                    <small>
                      {
                        data.bookings.filter((b) => b.status === "confirmed")
                          .length
                      }
                    </small>
                  )}
                  {i === 1 && <span className="nav-section-break" />}
                </Link>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <Link href="/" target="_blank">
              View storefront <ArrowUpRight size={15} />
            </Link>
            <div className="admin-user">
              <span>{actor.name.slice(0, 1)}</span>
              <div>
                <strong>{actor.name}</strong>
                <small>
                  {actor.role} {demo ? "· Demo" : "· Verified"}
                </small>
              </div>
              <button
                aria-label="Sign out"
                onClick={async () => {
                  await api("auth/logout", "POST", {});
                  setActor(null);
                  setData(null);
                }}
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>
        <div className="admin-workspace">
          <header className="admin-header">
            <div>
              <button
                className="admin-menu-toggle"
                onClick={() => setMobile(!mobile)}
                aria-label="Open studio navigation"
              >
                <Menu size={20} />
              </button>
              <span>Studio</span>
              <ChevronRight size={12} />
              <strong>{selected[1]}</strong>
            </div>
            <div>
              <span className="admin-ready">
                <i />
                {demo ? "DEMO STUDIO" : "STUDIO WORKSPACE"}
              </span>
              <Link href="/" target="_blank">
                View site <ArrowUpRight size={13} />
              </Link>
            </div>
          </header>
          <main className="admin-content">
            <div className="admin-page-heading">
              <div>
                <div className="section-kicker">
                  {section === "overview"
                    ? "YOUR STUDIO, AT A GLANCE"
                    : "STUDIO / " + selected[1].toUpperCase()}
                </div>
                <h1>
                  {section === "overview"
                    ? "A GOOD DAY FOR GREAT CARE."
                    : selected[1]}
                </h1>
                <p>
                  {section === "overview"
                    ? `Welcome back, ${actor.name}. Here’s what’s happening at your studio.`
                    : editable
                    ? "Make your changes here. Save a draft, then publish when everything looks right."
                    : "All the details that keep your studio moving."}
                </p>
              </div>
              {editable && (
                <div className="admin-top-actions">
                  <span className={`draft-indicator ${dirty ? "unsaved" : ""}`}>
                    <i />
                    {dirty
                      ? "Unsaved changes"
                      : `Published v${data.revisions.at(-1)?.number ?? 0}`}
                  </span>
                  <Link
                    className="btn btn-ghost"
                    href="/preview"
                    target="_blank"
                  >
                    Preview saved draft
                  </Link>
                  <Button variant="ghost" disabled={busy} onClick={save}>
                    Save draft
                  </Button>
                  {actor.role === "owner" && (
                    <Button disabled={busy} onClick={publish}>
                      Publish changes <ArrowUpRight size={14} />
                    </Button>
                  )}
                </div>
              )}
            </div>
            {message && <Notice>{message}</Notice>}
            {error && <Notice error>{error}</Notice>}
            {staffOnly && !["overview", "bookings"].includes(section) ? (
              <Notice error>
                Your role has access to assigned appointments only.
              </Notice>
            ) : section === "overview" ? (
              <Dashboard />
            ) : section === "bookings" ? (
              <BookingManager />
            ) : [
                "services",
                "products",
                "vehicles",
                "prices",
                "packages",
              ].includes(section) ? (
              <CatalogueEditors section={section} />
            ) : ["schedule", "site", "staff", "reports", "audit"].includes(
                section
              ) ? (
              <SettingsEditors section={section} />
            ) : (
              <Notice>Select a studio module from the sidebar.</Notice>
            )}
          </main>
          <footer className="admin-bottom">
            <span>Balaji Studio / STUDIO WORKSPACE</span>
            <span>Asia/Kolkata · INR</span>
          </footer>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
