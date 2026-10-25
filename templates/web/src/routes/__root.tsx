import { createPandAuthClient } from "@pands/auth/client";
import { AppShell } from "@pands/ui";
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

  return (
    <AppShell
      title="Pand App"
      navItems={[
        ...navItems,
        ...(userEmail
          ? []
          : [
              { label: "Sign In", to: "/login" },
              { label: "Sign Up", to: "/signup" },
            ]),
      ]}
      currentPath={currentPath}
      onNavigate={onNavigate}
      userEmail={userEmail}
      onSignOut={handleSignOut}
    >
      {children}
    </AppShell>
  );
}
