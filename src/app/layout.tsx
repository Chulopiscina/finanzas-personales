import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzas Personales",
  description: "Finanzas personales privadas con importación de extractos bancarios.",
  manifest: "/manifest.webmanifest",
  applicationName: "Finanzas personales",
  appleWebApp: { capable: true, title: "Finanzas", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-180.png" },
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light"
};

function ThemeScript() {
  const code = `
    try {
      const stored = localStorage.getItem('theme');
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      const useLight = stored === 'light' || (!stored && prefersLight === true && false);
      document.documentElement.classList.toggle('dark', !useLight);
    } catch (_) {
      document.documentElement.classList.add('dark');
    }
  `;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body>
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
