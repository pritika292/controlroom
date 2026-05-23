import helmet from "helmet";
import type { RequestHandler } from "express";

// Configured helmet middleware.
//
// Two things explicitly disabled because controlroom serves over plain HTTP
// until Tier 6 lands TLS via Caddy. Both would brick the live site:
//
// 1. `strictTransportSecurity` -- HSTS pinned over HTTP makes the browser
//    refuse to load the site once it has cached the directive.
// 2. `upgradeInsecureRequests` -- helmet adds this CSP directive by default.
//    It tells the browser to upgrade every asset request to HTTPS. Without
//    HTTPS on :3012 the JS bundle 404s and the page goes white.
//
// Both flip back on once a real domain + Caddy + cert are in place.
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // Tailwind in dev emits inline styles; keep unsafe-inline for style-src.
      styleSrc: ["'self'", "'unsafe-inline'"],
      // Override helmet's default; see comment above.
      upgradeInsecureRequests: null,
    },
  },
  frameguard: { action: "deny" },
  noSniff: true,
  referrerPolicy: { policy: "no-referrer" },
  permittedCrossDomainPolicies: false,
  strictTransportSecurity: false,
});
