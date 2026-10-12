"use client";

import { useEffect, useState } from "react";
import { isCommonAssetRequest } from "msw";
import { MOCKS_ENABLED } from "@/lib/api";

/**
 * Starts the mock API so the UI can be built and demoed before the backend
 * exists. Set `NEXT_PUBLIC_ENABLE_MOCKS=false` to turn it off and send every
 * request to the real API instead.
 *
 * Both modules are imported dynamically because `msw/browser` cannot run on the
 * server, and this file is still evaluated while the page is prerendered.
 */
let started: Promise<void> | undefined;

/**
 * The payload of an HTTP frame. `AnyNetworkFrame` types `data` as `unknown`, so
 * the narrowing happens here, in one place, rather than in the callback below.
 * Returns `null` for a WebSocket frame, which carries a connection instead.
 */
function httpRequest(frame: { protocol: string; data: unknown }): Request | null {
  if (frame.protocol === "ws") return null;
  return (frame.data as { request: Request }).request;
}

/**
 * Traffic that belongs to the Next.js dev server, not to our API: the HMR
 * WebSocket, `/_next/` chunks and source maps. It must reach the server
 * untouched, and MSW has no handler for it, so it is passed through silently.
 * Every other unhandled frame is a real gap between the app and the mock API,
 * so that still warns.
 */
function isDevServerFrame(url: string): boolean {
  return /\/(_next|__nextjs|__next)(\/|$)/.test(url) || url.includes("sockjs-node");
}

export function MockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!MOCKS_ENABLED);

  useEffect(() => {
    if (!MOCKS_ENABLED) return;

    started ??= Promise.all([import("msw/browser"), import("@/mocks/api")]).then(
      ([{ setupWorker }, { handlers }]) =>
        setupWorker(...handlers)
          .start({
            quiet: true,
            // MSW 3 replaced `onUnhandledRequest` with `onUnhandledFrame`, which
            // also covers WebSockets. The dev server's HMR socket arrives here
            // with no matching handler, hence the warning on every page load.
            onUnhandledFrame({ frame, defaults }) {
              // HMR and any other socket: ours to bypass, never to mock.
              const request = httpRequest(frame);
              if (!request) return;
              // Static assets (images, fonts, scripts) stay ignored, the same
              // as they are under the default strategy. A custom handle has
              // to check for this itself.
              if (isCommonAssetRequest(request)) return;
              if (isDevServerFrame(request.url)) return;
              // Everything left is an endpoint the mock API does not define —
              // worth knowing about.
              defaults.warn();
            },
          })
          .then(() => undefined),
      );

    // On failure we still render: the app will show its own error states, which
    // is more useful than sitting on this screen forever.
    started.then(() => setReady(true)).catch(() => setReady(true));
  }, []);

  // Nothing renders until the worker is in place. Without this the app's own
  // data requests can fire on a fresh page load before the worker controls the
  // page, and they would fall through to the Next.js server and 404.
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Starting demo environment…</p>
      </div>
    );
  }

  return <>{children}</>;
}