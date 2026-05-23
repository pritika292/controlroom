import { ThemeToggle } from "./ThemeToggle.js";

function LogoMark(): JSX.Element {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/30 text-sm font-bold select-none">
      CR
    </span>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }): JSX.Element {
  return (
    <a
      href={href}
      className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
    >
      {children}
    </a>
  );
}

export function TopBar(): JSX.Element {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 dark:border-white/5 bg-white/75 dark:bg-slate-950/75 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-950/60">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center gap-6">
        <a href="/" className="flex items-center gap-2.5" aria-label="controlroom home">
          <LogoMark />
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            controlroom
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-1 text-sm ml-2">
          <NavLink href="/">Home</NavLink>
          <NavLink href="/about">About</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
