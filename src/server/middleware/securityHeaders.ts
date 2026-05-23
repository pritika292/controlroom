import helmet from "helmet";
import type { RequestHandler } from "express";

// Configured helmet middleware.
//
// HSTS + upgrade-insecure-requests are now ON. Caddy fronts the site at
// https://controlroom.pritika.studio with auto-renewed Let's Encrypt certs.
//
// HSTS max-age starts at 1 hour. After we have ~24h of cert-pipeline
// stability, bump to 31536000 (1 year) and consider preload. The short
// window is a safety valve: if anything breaks in the cert chain,
// browsers fall back to HTTP within an hour instead of being locked
// out for a year.
const HSTS_MAX_AGE_SECONDS = 60 * 60;

export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // Tailwind in dev emits inline styles; keep unsafe-inline for style-src.
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  frameguard: { action: "deny" },
  noSniff: true,
  referrerPolicy: { policy: "no-referrer" },
  permittedCrossDomainPolicies: false,
  strictTransportSecurity: {
    maxAge: HSTS_MAX_AGE_SECONDS,
    includeSubDomains: true,
    preload: false,
  },
});
