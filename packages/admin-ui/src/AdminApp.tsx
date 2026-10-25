import { createPandAuthClient } from "@pand/auth/client";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  Input,
  Select,
  Table,
  Textarea,
  Toast,
} from "@pand/ui";
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

  const openCreate = () => {
    const initial: Record<string, any> = {};
    for (const f of meta.fields) {
      if (f.name === "id" || f.name === "createdAt" || f.name === "updatedAt" || (f as any).readOnly) continue;
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

  const editableFields = meta.fields.filter(
    (f) => f.name !== "id" && f.name !== "createdAt" && f.name !== "updatedAt" && !(f as any).readOnly,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {meta.pluralTitle}{" "}
            <Badge variant="default" className="ml-2">
              {meta.service}.{meta.table}
            </Badge>
          </h2>
          <p className="text-xs text-slate-500">{meta.basePath}</p>
        </div>
        <Button onClick={openCreate}>New {meta.entity}</Button>
      </div>

      <Card className="p-4">
        <Input
          placeholder={`Search ${meta.pluralTitle} (${meta.searchableFields.join(", ") || "id"})...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Table>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {meta.fields.map((f) => (
              <th key={f.name} className="px-4 py-3 font-semibold text-slate-700">
                {f.label}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((row) => (
            <tr key={String(row[meta.primaryKey])} className="hover:bg-slate-50">
              {meta.fields.map((f) => (
                <td key={f.name} className="px-4 py-3">
                  {typeof row[f.name] === "boolean" ? (
                    <Badge variant={row[f.name] ? "success" : "default"}>
                      {row[f.name] ? "true" : "false"}
                    </Badge>
                  ) : (
                    String(row[f.name] ?? "—")
                  )}
                </td>
              ))}
              <td className="space-x-2 px-4 py-3 text-right">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditItem(row);
                    setFormState({ ...row });
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(String(row[meta.primaryKey]))}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Dialog
        open={createOpen}
        title={`Create ${meta.entity}`}
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {editableFields.map((f) =>
            f.type === "boolean" ? (
              <Checkbox
                key={f.name}
                id={`create-${f.name}`}
                label={f.label}
                checked={Boolean(formState[f.name])}
                onChange={(e) => setFormState((s) => ({ ...s, [f.name]: e.target.checked }))}
              />
            ) : f.type === "enum" && f.enumValues ? (
              <Select
                key={f.name}
                id={`create-${f.name}`}
                label={f.label}
                value={String(formState[f.name] ?? "")}
                options={f.enumValues.map((v) => ({ label: v, value: v }))}
                onChange={(e) => setFormState((s) => ({ ...s, [f.name]: e.target.value }))}
              />
            ) : f.type === "text" ? (
              <Textarea
                key={f.name}
                id={`create-${f.name}`}
                label={f.label}
                value={String(formState[f.name] ?? "")}
                onChange={(e) => setFormState((s) => ({ ...s, [f.name]: e.target.value }))}
              />
            ) : (
              <Input
                key={f.name}
                id={`create-${f.name}`}
                label={f.label}
                type={f.type === "int" || f.type === "float" ? "number" : "text"}
                value={String(formState[f.name] ?? "")}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    [f.name]:
                      f.type === "int" || f.type === "float"
                        ? Number(e.target.value)
                        : e.target.value,
                  }))
                }
              />
            ),
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editItem)}
        title={`Edit ${meta.entity}`}
        onClose={() => setEditItem(null)}
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          {editableFields.map((f) => (
            <Input
              key={f.name}
              id={`edit-${f.name}`}
              label={f.label}
              value={String(formState[f.name] ?? "")}
              onChange={(e) => setFormState((s) => ({ ...s, [f.name]: e.target.value }))}
            />
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Dialog>

      <Toast message={toast} variant="success" onDismiss={() => setToast(null)} />
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

  if (user === null) {
    return (
      <div className="mx-auto max-w-md pt-16">
        <Card>
          <h1 className="mb-4 text-xl font-bold text-slate-900">Pand Admin Sign In</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              id="admin-email"
              label="Admin Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              id="admin-password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {authError ? <p className="text-xs text-red-600">{authError}</p> : null}
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (user && user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md pt-16">
        <Card>
          <h1 className="text-lg font-bold text-red-600">403 Admin role required</h1>
          <p className="mt-2 text-sm text-slate-600">
            Signed in as {user.email} (role: {user.role ?? "user"}). Add your email to{" "}
            <code>auth.adminEmails</code> in <code>pand.config.ts</code> or{" "}
            <code>PAND_ADMIN_EMAILS</code>.
          </p>
        </Card>
      </div>
    );
  }

  const selectedEntity =
    entities.find((e) => `${e.service}.${e.entity}` === selectedEntityKey) ?? entities[0];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <span className="text-lg font-bold text-slate-900">Pand Admin</span>
        </div>
        <div className="flex-1 space-y-6 p-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Entities
            </div>
            <div className="space-y-1">
              {entities.map((e) => {
                const key = `${e.service}.${e.entity}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setActiveTab("entities");
                      setSelectedEntityKey(key);
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium cursor-pointer ${
                      activeTab === "entities" && selectedEntityKey === key
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {e.pluralTitle} <span className="text-xs text-slate-400">({e.service})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              System
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium cursor-pointer ${
                  activeTab === "users"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Users & Auth
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("observability")}
                className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium cursor-pointer ${
                  activeTab === "observability"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Observability & Docs
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {activeTab === "entities" && selectedEntity ? (
          <DynamicEntityCrud meta={selectedEntity} />
        ) : activeTab === "users" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Users & Auth</h2>
                <p className="text-xs text-slate-500">
                  Better Auth User Management ({usersList.length} users registered)
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={loadUsers}>
                Refresh Users
              </Button>
            </div>

            {usersList.length === 0 ? (
              <Card className="p-6 text-center text-slate-500">
                No users loaded or failed to fetch users list.
              </Card>
            ) : (
              <Table>
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-700">User</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Role</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Created</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{u.name || "No name"}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.role === "admin" ? "warning" : "default"}>
                          {u.role ?? "user"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.banned ? "danger" : "success"}>
                          {u.banned ? "Banned" : "Active"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="space-x-2 px-4 py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleToggleRole(u)}
                        >
                          {u.role === "admin" ? "Demote to User" : "Make Admin"}
                        </Button>
                        <Button
                          variant={u.banned ? "secondary" : "danger"}
                          size="sm"
                          onClick={() => handleToggleBan(u)}
                        >
                          {u.banned ? "Unban" : "Ban"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            <Toast message={adminToast} variant="success" onDismiss={() => setAdminToast(null)} />
          </div>
        ) : activeTab === "observability" ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Observability & Docs</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <h3 className="font-semibold text-slate-900">OpenAPI Reference</h3>
                <a
                  href={links.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                >
                  Open Scalar Docs →
                </a>
              </Card>
              <Card>
                <h3 className="font-semibold text-slate-900">Grafana (Logs, Metrics, Traces)</h3>
                <a
                  href={links.grafanaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                >
                  Open Grafana →
                </a>
              </Card>
              <Card>
                <h3 className="font-semibold text-slate-900">PostHog EU Product Analytics</h3>
                <a
                  href={links.posthogUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                >
                  Open PostHog →
                </a>
              </Card>
            </div>
          </div>
        ) : (
          <Card>No entities registered yet. Run pand add entity to add one.</Card>
        )}
      </main>
    </div>
  );
}
