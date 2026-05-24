import { ContactStrip } from "./ContactStrip.js";
import { ThemeToggle } from "./ThemeToggle.js";

function NavLink({ href, children }: { href: string; children: React.ReactNode }): JSX.Element {
  return (
    <a href={href} className="te-label hover:text-zinc-900 dark:hover:text-white transition-colors">
      {children}
    </a>
  );
}

export function TopBar(): JSX.Element {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80 dark:supports-[backdrop-filter]:bg-zinc-950/80">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-12 h-14 flex items-center gap-8">
        <a href="/" className="flex items-center gap-3" aria-label="controlroom home">
          <span aria-hidden className="inline-block h-4 w-4 bg-accent" />
          <span className="font-mono text-sm tracking-[0.2em] text-zinc-900 dark:text-white">
            CONTROLROOM
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-6">
          <NavLink href="/">STATUS</NavLink>
          <NavLink href="/about">ABOUT</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-5">
          <ContactStrip />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
