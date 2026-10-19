"use client";
import { request } from "@/lib/client-request";

import { FormEvent, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, ShieldCheck, UserRound } from "lucide-react";

export function ProfileForm({ user }: { user: SessionUser }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const response = await request("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      }),
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo actualizar el perfil.");
      return;
    }
    if (payload.requiresLogin) {
      window.location.assign("/login");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setMessage("Perfil actualizado.");
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      <section className="grid gap-5 border-b border-border pb-7 lg:grid-cols-[240px_1fr]">
        <div>
          <UserRound className="mb-3 h-5 w-5 text-accent" />
          <h2 className="text-base font-semibold">Datos personales</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            La información de tu cuenta.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">Nombre</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">
              Correo electrónico
            </span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
        </div>
      </section>
      <section className="grid gap-5 border-b border-border pb-7 lg:grid-cols-[240px_1fr]">
        <div>
          <ShieldCheck className="mb-3 h-5 w-5 text-accent" />
          <h2 className="text-base font-semibold">Seguridad</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Deja los campos vacíos para mantener tu contraseña.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">
              Contraseña actual
            </span>
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">
              Nueva contraseña
            </span>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          {message}
        </p>
      ) : null}

      <Button type="submit" className="mt-5" disabled={loading}>
        <Save className="h-4 w-4" />
        {loading ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
