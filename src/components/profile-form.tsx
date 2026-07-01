"use client";

import { FormEvent, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined
      })
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo actualizar el perfil.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setMessage("Perfil actualizado.");
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-muted-foreground">Nombre</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-muted-foreground">Correo electrónico</span>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-muted-foreground">Contraseña actual</span>
          <Input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-muted-foreground">Nueva contraseña</span>
          <Input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>
      </div>

      {error ? <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mt-4 rounded-md bg-success/10 px-3 py-2 text-sm text-success">{message}</p> : null}

      <Button type="submit" className="mt-5" disabled={loading}>
        {loading ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
