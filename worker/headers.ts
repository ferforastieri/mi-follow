/** Security headers for every response, API and asset alike. */

const base = [
  "default-src 'self'",
  "script-src 'self'",
  // The kit sets inline `style` attributes and the theme switch injects one <style>.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
];

export function harden(response: Response, secure: boolean): Response {
  const headers = new Headers(response.headers);
  headers.set("content-security-policy", [...base, secure ? "upgrade-insecure-requests" : ""].filter(Boolean).join("; "));
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-origin");
  if (secure) headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
