import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  // Fast-glob inside Tailwind resolves relative paths from CWD, not from the
  // config file. Using an absolute path keeps the scan working regardless of
  // where the build is invoked from.
  content: [path.join(repoRoot, "src/client/**/*.{ts,tsx,html}")],
  theme: {
    extend: {
      fontFamily: {
        // Technical mono in the Teenage Engineering tradition. System stack
        // is good enough; no web-font load tax.
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        // One bright accent, the rest is neutral. Close to Pantone 1655C.
        accent: {
          DEFAULT: "#FF6A13",
          400: "#FF8A47",
          500: "#FF6A13",
          600: "#E55400",
        },
      },
    },
  },
  plugins: [],
};
