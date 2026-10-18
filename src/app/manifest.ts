import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Finanzas personales", short_name: "Finanzas", lang: "es",
    start_url: "/dashboard", scope: "/", display: "standalone",
    background_color: "#111318", theme_color: "#111318",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }]
  };
}
