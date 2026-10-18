"use client";

// Transport errors have the same response shape as API errors; mutations are never retried.
export async function request(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(abort, 60_000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  catch { return Response.json({ error: "No se pudo completar la conexión. Comprueba el estado de la operación antes de repetirla." }, { status: 503 }); }
  finally { window.clearTimeout(timeout); init.signal?.removeEventListener("abort", abort); }
}
