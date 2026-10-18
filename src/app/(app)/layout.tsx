import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth";
import { shortcutsEnabled } from "@/lib/shortcuts";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  return <AppShell user={session.user} shortcutsAvailable={shortcutsEnabled()}>{children}</AppShell>;
}
