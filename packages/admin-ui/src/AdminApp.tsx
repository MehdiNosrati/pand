import "@methane-ui/react";
import "@methane-ui/ui/alert";
import "@methane-ui/ui/badge";
import "@methane-ui/ui/button";
import "@methane-ui/ui/card";
import "@methane-ui/ui/checkbox";
import "@methane-ui/ui/dialog";
import "@methane-ui/ui/empty-state";
import "@methane-ui/ui/input";
import "@methane-ui/ui/number-input";
import "@methane-ui/ui/password-input";
import "@methane-ui/ui/search-input";
import "@methane-ui/ui/select";
import "@methane-ui/ui/sidebar-nav";
import "@methane-ui/ui/textarea";
import "@methane-ui/ui/toast";
import { createPandAuthClient } from "@pands/auth/client";
import type React from "react";
import { useEffect, useState } from "react";

export interface AdminFieldMeta {
  name: string;
  label: string;
  type: "string" | "text" | "int" | "float" | "boolean" | "datetime" | "uuid" | "json" | "enum";
  required: boolean;
  enumValues?: string[];
}

export interface AdminEntityMeta {
  service: string;
  entity: string;
  pluralTitle: string;
  table: string;
  basePath: string;
  primaryKey: string;
  searchableFields: string[];
  fields: AdminFieldMeta[];
}

export interface DynamicEntityCrudProps {
  meta: AdminEntityMeta;
}

function renderAdminFieldControl(
  f: AdminFieldMeta,
  value: unknown,
  onChange: (next: unknown) => void,
) {
  if (f.type === "boolean") {
    return (
      <mth-checkbox
        key={f.name}
        label={f.label}
        checked={Boolean(value)}
        onmth-change={(e) => onChange(e.detail.checked)}
      />
    );
  }
  if (f.type === "enum" && f.enumValues) {
    return (
      <mth-select
        key={f.name}
        label={f.label}
        value={String(value ?? "")}
        options={f.enumValues.map((v) => ({ label: v, value: v }))}
        onmth-change={(e) => onChange(e.detail.value)}
      />
    );
  }
  if (f.type === "text") {
    return (
      <mth-textarea
        key={f.name}
        label={f.label}
        value={String(value ?? "")}
        onmth-input={(e) => onChange(e.detail.value)}
      />
    );
  }
  if (f.type === "int" || f.type === "float") {
    return (
      <mth-number-input
        key={f.name}
        label={f.label}
        step={f.type === "float" ? 0.01 : undefined}
        value={value === "" || value === undefined || value === null ? "" : String(value)}
        onmth-input={(e) =>
          onChange(Number.isNaN(e.detail.valueAsNumber) ? 0 : e.detail.valueAsNumber)
        }
      />
    );
  }
  return (
    <mth-input
      key={f.name}
      label={f.label}
      value={String(value ?? "")}
      onmth-input={(e) => onChange(e.detail.value)}
    />
  );
}

export function DynamicEntityCrud({ meta }: DynamicEntityCrudProps) {
  const [items, setItems] = useState<Array<Record<string, any>>>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, any> | null>(null);
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [toast, setToast] = useState<string | null>(null);

  const loadItems = async () => {
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${meta.basePath}${qs}`);
      const json = (await res.json()) as any;
      const list = json?.items ?? json?.data ?? (Array.isArray(json) ? json : []);
      setItems(list);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    loadItems();
  }, [meta.basePath, search]);

  const editableFields = meta.fields.filter(
    (f) =>
      f.name !== "id" && f.name !== "createdAt" && f.name !== "updatedAt" && !(f as any).readOnly,
  );

  const openCreate = () => {
    const initial: Record<string, any> = {};
    for (const f of editableFields) {
      initial[f.name] = f.type === "boolean" ? false : (f.enumValues?.[0] ?? "");
    }
    setFormState(initial);
    setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(meta.basePath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(formState),
    });
    setCreateOpen(false);
    setToast(`Created ${meta.entity}`);
    await loadItems();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    const id = editItem[meta.primaryKey];
    await fetch(`${meta.basePath}/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(formState),
    });
    setEditItem(null);
    setToast(`Updated ${meta.entity}`);
    await loadItems();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${meta.basePath}/${id}`, { method: "DELETE" });
    setToast(`Deleted ${meta.entity}`);
    await loadItems();
  };

  return (
    <div className="mth-stack" data-gap="6">
      <div className="mth-flex" data-justify="between" data-align="center" data-wrap>
        <div>
          <h2 className="pand-admin-title">
            {meta.pluralTitle}
            <mth-badge variant="accent" pill>
              {meta.service}.{meta.table}
            </mth-badge>
          </h2>
          <p className="pand-admin-subtitle">{meta.basePath}</p>
        </div>
        <mth-button variant="solid" onmth-press={openCreate}>
          New {meta.entity}
        </mth-button>
      </div>

      <mth-card variant="outlined">
        <mth-search-input
          placeholder={`Search ${meta.pluralTitle} (${meta.searchableFields.join(", ") || "id"})...`}
          clearable
          value={search}
          onmth-input={(e) => setSearch(e.detail.value)}
          onmth-clear={() => setSearch("")}
        />
      </mth-card>

      {items.length === 0 ? (
        <mth-empty-state
          variant="card"
          heading={`No ${meta.pluralTitle} found`}
          description={`Create your first ${meta.entity} or adjust your search filter.`}
        >
          <mth-button slot="actions" variant="solid" onmth-press={openCreate}>
            New {meta.entity}
          </mth-button>
        </mth-empty-state>
      ) : (
        <div className="pand-admin-table-wrap">
          <table className="pand-admin-table">
            <thead>
              <tr>
                {meta.fields.map((f) => (
                  <th key={f.name}>{f.label}</th>
                ))}
                <th className="pand-admin-text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={String(row[meta.primaryKey])}>
                  {meta.fields.map((f) => (
                    <td key={f.name}>
                      {typeof row[f.name] === "boolean" ? (
                        <mth-badge variant={row[f.name] ? "success" : "neutral"} pill>
                          {row[f.name] ? "true" : "false"}
                        </mth-badge>
                      ) : (
                        String(row[f.name] ?? "—")
                      )}
                    </td>
                  ))}
                  <td className="pand-admin-text-right">
                    <div className="pand-admin-actions">
                      <mth-button
                        variant="outline"
                        size="sm"
                        onmth-press={() => {
                          setEditItem(row);
                          setFormState({ ...row });
                        }}
                      >
                        Edit
                      </mth-button>
                      <mth-button
                        variant="danger"
                        size="sm"
                        onmth-press={() => handleDelete(String(row[meta.primaryKey]))}
                      >
                        Delete
                      </mth-button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <mth-dialog
        open={createOpen}
        modal
        label={`Create ${meta.entity}`}
        onmth-close={() => setCreateOpen(false)}
      >
        <form onSubmit={handleCreate} className="mth-stack" data-gap="4">
          {editableFields.map((f) =>
            renderAdminFieldControl(f, formState[f.name], (next) =>
              setFormState((s) => ({ ...s, [f.name]: next })),
            ),
          )}
          <div className="mth-flex" data-justify="end" data-gap="2">
            <mth-button variant="outline" type="button" onmth-press={() => setCreateOpen(false)}>
              Cancel
            </mth-button>
            <mth-button type="submit" variant="solid">
              Create
            </mth-button>
          </div>
        </form>
      </mth-dialog>

      <mth-dialog
        open={Boolean(editItem)}
        modal
        label={`Edit ${meta.entity}`}
        onmth-close={() => setEditItem(null)}
      >
        <form onSubmit={handleUpdate} className="mth-stack" data-gap="4">
          {editableFields.map((f) =>
            renderAdminFieldControl(f, formState[f.name], (next) =>
              setFormState((s) => ({ ...s, [f.name]: next })),
            ),
          )}
          <div className="mth-flex" data-justify="end" data-gap="2">
            <mth-button variant="outline" type="button" onmth-press={() => setEditItem(null)}>
              Cancel
            </mth-button>
            <mth-button type="submit" variant="solid">
              Save Changes
            </mth-button>
          </div>
        </form>
      </mth-dialog>

      <mth-toast
        open={Boolean(toast)}
        variant="success"
        message={toast ?? ""}
        closable
        onmth-close={() => setToast(null)}
      />
    </div>
  );
}

export interface AdminAppProps {
  initialUser?: { id: string; email: string; role?: string } | null;
  initialEntities?: AdminEntityMeta[];
  initialLinks?: {
    grafanaUrl: string;
    posthogUrl: string;
    docsUrl: string;
  };
  [key: string]: unknown;
}

export function AdminApp(props: AdminAppProps) {
  const { initialUser, initialEntities, initialLinks } = props;
  const authClient = createPandAuthClient();
  const [user, setUser] = useState<{ id: string; email: string; role?: string } | null | undefined>(
    initialUser,
  );
  const [entities, setEntities] = useState<AdminEntityMeta[]>(initialEntities ?? []);
  const [links, setLinks] = useState(
    initialLinks ?? {
      grafanaUrl: "https://grafana.mahdins.dev",
      posthogUrl: "https://eu.posthog.com",
      docsUrl: "/api/docs",
    },
  );
  const [activeTab, setActiveTab] = useState<string>("entities");
  const [selectedEntityKey, setSelectedEntityKey] = useState<string | null>(
    initialEntities?.[0] ? `${initialEntities[0].service}.${initialEntities[0].entity}` : null,
  );
  const [usersList, setUsersList] = useState<Array<Record<string, any>>>([]);
  const [adminToast, setAdminToast] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-mth-theme") === "dark"
      ? "dark"
      : "light",
  );

  useEffect(() => {
    if (initialUser !== undefined) return;
    authClient
      .getSession()
      .then((res: any) => {
        setUser(res?.data?.user ?? null);
      })
      .catch(() => setUser(null));
  }, [initialUser]);

  useEffect(() => {
    if (initialEntities !== undefined) return;
    fetch("/api/admin/meta")
      .then((r) => r.json())
      .then((res: any) => {
        const raw = Array.isArray(res)
          ? res
          : (res?.data?.entities ?? res?.entities ?? res?.data ?? []);
        const list = raw.map((e: any) => ({
          ...e,
          pluralTitle: e.pluralTitle || (e.entity.endsWith("s") ? e.entity : `${e.entity}s`),
          searchableFields: e.searchableFields || (e.displayField ? [e.displayField] : ["id"]),
        })) as AdminEntityMeta[];
        setEntities(list);
        if (list[0]) {
          setSelectedEntityKey(`${list[0].service}.${list[0].entity}`);
        }
      })
      .catch(() => {});

    fetch("/api/config")
      .then((r) => r.json())
      .then((res: any) => {
        if (res?.data?.links) {
          setLinks(res.data.links);
        }
      })
      .catch(() => {});
  }, [initialEntities]);

  const loadUsers = async () => {
    try {
      if ((authClient as any).admin?.listUsers) {
        const res = await (authClient as any).admin.listUsers({ query: { limit: 100 } });
        const list = res?.data?.users ?? res?.data ?? res?.users ?? [];
        if (Array.isArray(list)) {
          setUsersList(list);
          return;
        }
      }
      const r = await fetch("/api/auth/admin/list-users?limit=100");
      if (r.ok) {
        const json = await r.json();
        const list = json?.users ?? json?.data?.users ?? (Array.isArray(json) ? json : []);
        setUsersList(list);
      }
    } catch {
      setUsersList([]);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      loadUsers();
    }
  }, [activeTab]);

  const handleToggleRole = async (targetUser: Record<string, any>) => {
    const newRole = targetUser.role === "admin" ? "user" : "admin";
    try {
      if ((authClient as any).admin?.setRole) {
        await (authClient as any).admin.setRole({ userId: targetUser.id, role: newRole });
      } else {
        await fetch("/api/auth/admin/set-role", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: targetUser.id, role: newRole }),
        });
      }
      setAdminToast(`Updated role for ${targetUser.email} to ${newRole}`);
      await loadUsers();
    } catch {
      setAdminToast("Failed to update role");
    }
  };

  const handleToggleBan = async (targetUser: Record<string, any>) => {
    const isBanned = Boolean(targetUser.banned);
    try {
      if (isBanned) {
        if ((authClient as any).admin?.unbanUser) {
          await (authClient as any).admin.unbanUser({ userId: targetUser.id });
        } else {
          await fetch("/api/auth/admin/unban-user", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userId: targetUser.id }),
          });
        }
        setAdminToast(`Unbanned ${targetUser.email}`);
      } else {
        if ((authClient as any).admin?.banUser) {
          await (authClient as any).admin.banUser({ userId: targetUser.id });
        } else {
          await fetch("/api/auth/admin/ban-user", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userId: targetUser.id }),
          });
        }
        setAdminToast(`Banned ${targetUser.email}`);
      }
      await loadUsers();
    } catch {
      setAdminToast("Failed to update ban status");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = await authClient.signIn.email({ email, password });
    if (res?.error) {
      setAuthError(res.error.message ?? "Sign in failed");
    } else if (res?.data?.user) {
      setUser(res.data.user);
    }
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-mth-theme", next);
    }
    setTheme(next);
  };

  if (user === null) {
    return (
      <div className="pand-admin-auth">
        <mth-card variant="outlined">
          <h1 className="pand-admin-title">Pand Admin Sign In</h1>
          <form onSubmit={handleLogin} className="mth-stack" data-gap="4">
            <mth-input
              label="Admin Email"
              type="email"
              required
              value={email}
              onmth-input={(e) => setEmail(e.detail.value)}
            />
            <mth-password-input
              label="Password"
              toggleable
              required
              value={password}
              onmth-input={(e) => setPassword(e.detail.value)}
            />
            {authError ? (
              <mth-alert variant="danger" open>
                {authError}
              </mth-alert>
            ) : null}
            <mth-button type="submit" variant="solid" className="pand-admin-full">
              Sign In
            </mth-button>
          </form>
        </mth-card>
      </div>
    );
  }

  if (user && user.role !== "admin") {
    return (
      <div className="pand-admin-auth">
        <mth-card variant="outlined">
          <mth-alert variant="danger" open>
            403 Admin role required
          </mth-alert>
          <p className="pand-admin-muted">
            Signed in as {user.email} (role: {user.role ?? "user"}). Add your email to{" "}
            <code>auth.adminEmails</code> in <code>pand.config.ts</code> or{" "}
            <code>PAND_ADMIN_EMAILS</code>.
          </p>
        </mth-card>
      </div>
    );
  }

  const selectedEntity =
    entities.find((e) => `${e.service}.${e.entity}` === selectedEntityKey) ?? entities[0];

  return (
    <div className="mth-app-shell">
      <header className="mth-app-shell-header">
        <div className="pand-admin-header-inner">
          <span className="pand-admin-brand">Pand Admin</span>
          <mth-button variant="ghost" size="sm" onmth-press={toggleTheme}>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </mth-button>
        </div>
      </header>

      <aside className="mth-app-shell-sidebar pand-admin-sidebar">
        <div className="pand-admin-sidebar-section">
          <div className="pand-admin-sidebar-heading">Entities</div>
          <mth-sidebar-nav
            label="Entities"
            activeValue={activeTab === "entities" ? (selectedEntityKey ?? undefined) : undefined}
            items={entities.map((e) => ({
              value: `${e.service}.${e.entity}`,
              label: e.pluralTitle,
              badge: e.service,
            }))}
            onmth-select={(e) => {
              setActiveTab("entities");
              setSelectedEntityKey(e.detail.value);
            }}
          />
        </div>

        <div className="pand-admin-sidebar-section">
          <div className="pand-admin-sidebar-heading">System</div>
          <mth-sidebar-nav
            label="System"
            activeValue={activeTab !== "entities" ? activeTab : undefined}
            items={[
              { value: "users", label: "Users & Auth" },
              { value: "observability", label: "Observability & Docs" },
            ]}
            onmth-select={(e) => setActiveTab(e.detail.value)}
          />
        </div>
      </aside>

      <main className="mth-app-shell-main">
        <div className="pand-admin-main">
          {activeTab === "entities" && selectedEntity ? (
            <DynamicEntityCrud meta={selectedEntity} />
          ) : activeTab === "users" ? (
            <div className="mth-stack" data-gap="6">
              <div className="mth-flex" data-justify="between" data-align="center" data-wrap>
                <div>
                  <h2 className="pand-admin-title">Users & Auth</h2>
                  <p className="pand-admin-muted">
                    Better Auth User Management ({usersList.length} users registered)
                  </p>
                </div>
                <mth-button variant="outline" size="sm" onmth-press={loadUsers}>
                  Refresh Users
                </mth-button>
              </div>

              {usersList.length === 0 ? (
                <mth-empty-state
                  variant="card"
                  heading="No users loaded"
                  description="No users loaded or failed to fetch users list."
                />
              ) : (
                <div className="pand-admin-table-wrap">
                  <table className="pand-admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th className="pand-admin-text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div className="pand-admin-user-name">{u.name || "No name"}</div>
                            <div className="pand-admin-user-email">{u.email}</div>
                          </td>
                          <td>
                            <mth-badge variant={u.role === "admin" ? "warning" : "neutral"} pill>
                              {u.role ?? "user"}
                            </mth-badge>
                          </td>
                          <td>
                            <mth-badge variant={u.banned ? "danger" : "success"} pill>
                              {u.banned ? "Banned" : "Active"}
                            </mth-badge>
                          </td>
                          <td className="pand-admin-user-email">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="pand-admin-text-right">
                            <div className="pand-admin-actions">
                              <mth-button
                                variant="outline"
                                size="sm"
                                onmth-press={() => handleToggleRole(u)}
                              >
                                {u.role === "admin" ? "Demote to User" : "Make Admin"}
                              </mth-button>
                              <mth-button
                                variant={u.banned ? "outline" : "danger"}
                                size="sm"
                                onmth-press={() => handleToggleBan(u)}
                              >
                                {u.banned ? "Unban" : "Ban"}
                              </mth-button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <mth-toast
                open={Boolean(adminToast)}
                variant="success"
                message={adminToast ?? ""}
                closable
                onmth-close={() => setAdminToast(null)}
              />
            </div>
          ) : activeTab === "observability" ? (
            <div className="mth-stack" data-gap="4">
              <h2 className="pand-admin-title">Observability & Docs</h2>
              <div className="mth-grid" data-cols="3" data-gap="4">
                <mth-card variant="outlined">
                  <h3 className="pand-admin-card-title">OpenAPI Reference</h3>
                  <a
                    href={links.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="pand-admin-link"
                  >
                    Open Scalar Docs →
                  </a>
                </mth-card>
                <mth-card variant="outlined">
                  <h3 className="pand-admin-card-title">Grafana (Logs, Metrics, Traces)</h3>
                  <a
                    href={links.grafanaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="pand-admin-link"
                  >
                    Open Grafana →
                  </a>
                </mth-card>
                <mth-card variant="outlined">
                  <h3 className="pand-admin-card-title">PostHog EU Product Analytics</h3>
                  <a
                    href={links.posthogUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="pand-admin-link"
                  >
                    Open PostHog →
                  </a>
                </mth-card>
              </div>
            </div>
          ) : (
            <mth-empty-state
              variant="card"
              heading="No entities registered yet"
              description="Run pand add entity to add one."
            />
          )}
        </div>
      </main>
    </div>
  );
}
