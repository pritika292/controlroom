import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TopBar } from "./components/TopBar.js";
import { Home } from "./pages/Home.js";
import { About } from "./pages/About.js";
import { Project } from "./pages/Project.js";

function NotFound(): JSX.Element {
  return (
    <main className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">404</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Page not found.</p>
      <a
        href="/"
        className="mt-6 inline-block text-violet-600 dark:text-violet-400 hover:underline"
      >
        Back to home
      </a>
    </main>
  );
}

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
        <TopBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/p/:slug" element={<Project />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
