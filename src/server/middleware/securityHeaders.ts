import helmet from "helmet";
import type { RequestHandler } from "express";
import { config } from "../config.js";

// Configured helmet middleware.
// HSTS is enabled only in production because controlroom is HTTP-only until
// Tier 6 (Caddy + TLS) lands. Enabling HSTS before TLS would brick the site
// for visitors whose browsers cache the directive.
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
  strictTransportSecurity: config.NODE_ENV === "production" ? { maxAge: 31536000 } : false,
});
