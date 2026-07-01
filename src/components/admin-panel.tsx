"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ExternalLink, Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { MetricCard } from "@/components/metric-card";
import { formatDate } from "@/lib/format";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  createdAt: Date | string;
  updatedAt: Date | string;
  lastLoginAt: Date | string | null;
  _count: { transactions: number; imports: number };
};

type AdminData = {
  users: AdminUser[];
  metrics: {
    userCount: number;
    transactionCount: number;
    importCount: number;
    admins: number;
    regularUsers: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    user: string;
    detail: string;
    date: string;
  }>;
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "USER" as "ADMIN" | "USER"
};

export function AdminPanel({ data }: { data: AdminData }) {
  const [users, setUsers] = useState(data.users);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !q || `${user.name} ${user.email}`.toLowerCase().includes(q);
      const matchesRole = !roleFilter || user.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [query, roleFilter, users]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm)
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No se pudo crear el usuario.");
      return;
    }

    setUsers((current) => [payload.user, ...current]);
    setCreateForm(emptyForm);
    setMessage("Usuario creado.");
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) {
      return;
    }

    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editing.name,
        email: editing.email,
        role: editing.role,
        password: editPassword || undefined
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No se pudo actualizar el usuario.");
      return;
    }

    setUsers((current) => current.map((user) => (user.id === payload.user.id ? payload.user : user)));
    setEditing(null);
    setEditPassword("");
    setMessage("Usuario actualizado.");
  }

  async function deleteUser(id: string) {
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error ?? "No se pudo eliminar el usuario.");
      return;
    }

    setUsers((current) => current.filter((user) => user.id !== id));
    setMessage("Usuario eliminado.");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Usuarios" value={String(data.metrics.userCount)} icon={ShieldCheck} />
        <MetricCard title="Movimientos" value={String(data.metrics.transactionCount)} icon={ShieldCheck} />
        <MetricCard title="Importaciones" value={String(data.metrics.importCount)} icon={ShieldCheck} />
        <MetricCard title="Administradores" value={String(data.metrics.admins)} icon={ShieldCheck} />
      </div>

      {error ? <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {message ? (
        <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{message}</p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <form onSubmit={createUser} className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold text-card-foreground">Crear usuario</h2>
          </div>
          <div className="space-y-3">
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Nombre</span>
              <Input
                value={createForm.name}
                onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Correo</span>
              <Input
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Contraseña</span>
              <Input
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Rol</span>
              <Select
                value={createForm.role}
                onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as "ADMIN" | "USER" })}
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </Select>
            </label>
            <Button type="submit" className="w-full">
              Crear
            </Button>
          </div>
        </form>

        <section className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-card-foreground">Usuarios</h2>
              <p className="text-sm text-muted-foreground">{filteredUsers.length} visibles</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" />
              </label>
              <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="sm:w-36">
                <option value="">Todos</option>
                <option value="ADMIN">ADMIN</option>
                <option value="USER">USER</option>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Movs.</th>
                  <th className="px-4 py-3 font-medium">Último acceso</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-card-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.role === "ADMIN" ? "success" : "neutral"}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user._count.transactions}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(user)}>
                          Editar
                        </Button>
                        <Link href={`/dashboard?userId=${user.id}`}>
                          <Button type="button" variant="ghost" size="icon" title="Abrir dashboard">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button type="button" variant="ghost" size="icon" onClick={() => void deleteUser(user.id)} title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editing ? (
        <form onSubmit={saveUser} className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground">Editar usuario</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Nombre</span>
              <Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Correo</span>
              <Input
                type="email"
                value={editing.email}
                onChange={(event) => setEditing({ ...editing, email: event.target.value })}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Rol</span>
              <Select value={editing.role} onChange={(event) => setEditing({ ...editing, role: event.target.value as "ADMIN" | "USER" })}>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </Select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Nueva contraseña</span>
              <Input type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} />
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <Button type="submit">Guardar</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-card-foreground">Actividad reciente</h2>
        <div className="mt-4 divide-y divide-border">
          {data.recentActivity.map((item) => (
            <div key={item.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[10rem_1fr_9rem]">
              <span className="font-medium text-card-foreground">{item.type}</span>
              <span className="min-w-0 truncate text-muted-foreground">
                {item.user} · {item.detail}
              </span>
              <span className="text-muted-foreground sm:text-right">{formatDate(item.date)}</span>
            </div>
          ))}
          {data.recentActivity.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sin actividad todavía</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
