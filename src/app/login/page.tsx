import { CircleDollarSign, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="mb-10 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <CircleDollarSign className="h-6 w-6" />
        </span>
        <span className="text-xl font-semibold">
          Finanzas<span className="text-accent">.</span>
        </span>
      </div>
      <section className="w-full max-w-[400px]">
        <p className="eyebrow">Acceso privado</p>
        <h1 className="text-3xl font-semibold">
          Tu dinero.
          <br />
          Todo en su sitio.
        </h1>
        <p className="mb-8 mt-3 text-sm text-muted-foreground">
          Inicia sesión en Finanzas personales.
        </p>
        <LoginForm />
        <p className="mt-8 flex items-center justify-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
          <LockKeyhole className="h-3.5 w-3.5" />
          Tu espacio financiero personal
        </p>
      </section>
    </main>
  );
}
