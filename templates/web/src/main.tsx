import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@pands/ui/styles.css";
import { RootLayout } from "./routes/__root.js";
import IndexPage from "./routes/index.js";
import LoginPage from "./routes/login.js";
import SignupPage from "./routes/signup.js";

const queryClient = new QueryClient();

const routeModules = (import.meta as any).glob("./routes/*.tsx", { eager: true }) as Record<
  string,
  { default?: React.ComponentType<any> }
>;

function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || "/");

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname || "/");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setCurrentPath(to);
  };

  let PageComponent: React.ComponentType<any> = IndexPage;
  if (currentPath === "/login") {
    PageComponent = LoginPage;
  } else if (currentPath === "/signup") {
    PageComponent = SignupPage;
  } else if (currentPath !== "/") {
    const key = `./routes${currentPath}.tsx`;
    const matched = routeModules[key]?.default;
    if (matched) {
      PageComponent = matched;
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayout currentPath={currentPath} onNavigate={navigate}>
        <PageComponent onNavigate={navigate} />
      </RootLayout>
    </QueryClientProvider>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
