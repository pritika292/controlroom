import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TopBar } from "./components/TopBar.js";
import { Home } from "./pages/Home.js";
import { About } from "./pages/About.js";
import { Project } from "./pages/Project.js";

function NotFound(): JSX.Element {
  return (
    <main className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
      <p className="te-label">ERROR / 404</p>
      <h1 className="mt-2 font-mono text-3xl text-zinc-900 dark:text-white">Page not found.</h1>
      <a href="/" className="mt-6 inline-block te-label text-accent hover:underline">
        BACK TO STATUS BOARD
      </a>
    </main>
  );
}

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white">
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
