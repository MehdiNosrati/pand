import "@methane-ui/ui/button";
import "@methane-ui/ui/sidebar-nav";
import { createPandAuthClient } from "@pands/auth/client";
import type React from "react";
import { useEffect, useState } from "react";
import { navItems } from "../nav.js";

export const authClient = createPandAuthClient();

export function RootLayout({
  currentPath,
  onNavigate,
  children,
}: {
  currentPath: string;
  onNavigate: (to: string) => void;
  children: React.ReactNode;
}) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.getAttribute("data-mth-theme") === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    void currentPath;
    authClient
      .getSession()
      .then((res: any) => {
        if (res?.data?.user?.email) {
          setUserEmail(res.data.user.email);
        }
      })
      .catch(() => {});
  }, [currentPath]);

  const handleSignOut = async () => {
    await authClient.signOut();
    setUserEmail(null);
    onNavigate("/login");
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-mth-theme", next);
    setTheme(next);
  };

  const allNavItems = [
    ...navItems,
    ...(userEmail
      ? []
      : [
          { label: "Sign In", to: "/login" },
          { label: "Sign Up", to: "/signup" },
        ]),
  ];

  return (
    <div className="mth-app-shell">
      <header className="mth-app-shell-header">
        <div className="pand-header-inner">
          <a
            href="/"
            className="pand-brand"
            onClick={(e) => {
              e.preventDefault();
              onNavigate("/");
            }}
          >
            Pand App
          </a>
          <mth-button variant="ghost" size="sm" onmth-press={toggleTheme}>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </mth-button>
        </div>
      </header>

      <aside className="mth-app-shell-sidebar pand-sidebar">
        <mth-sidebar-nav
          label="Navigation"
          activeValue={currentPath}
          items={allNavItems.map((item) => ({
            value: item.to,
            label: item.label,
          }))}
          onmth-select={(e) => onNavigate(e.detail.value)}
        />
        {userEmail ? (
          <div className="pand-sidebar-footer">
            <p className="pand-user-email" title={userEmail}>
              {userEmail}
            </p>
            <mth-button
              variant="outline"
              size="sm"
              className="pand-full-width"
              onmth-press={handleSignOut}
            >
              Sign Out
            </mth-button>
          </div>
        ) : null}
      </aside>

      <main className="mth-app-shell-main">
        <div className="pand-page">{children}</div>
      </main>
    </div>
  );
}
