import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export interface PandAuthClient {
  signIn: {
    email: (opts: { email: string; password: string; [key: string]: any }) => Promise<any>;
    [key: string]: any;
  };
  signUp: {
    email: (opts: {
      email: string;
      password: string;
      name: string;
      [key: string]: any;
    }) => Promise<any>;
    [key: string]: any;
  };
  signOut: (opts?: any) => Promise<any>;
  useSession: () => {
    data: { user: { id: string; email: string; name: string; role?: string } } | null;
    isPending: boolean;
    error: any;
  };
  getSession: (opts?: any) => Promise<any>;
  [key: string]: any;
}

export function createPandAuthClient(baseURL?: string): PandAuthClient {
  const win = (globalThis as any).window as { location?: { origin?: string } } | undefined;
  return createAuthClient({
    baseURL:
      baseURL ??
      (win?.location?.origin
        ? `${win.location.origin}/api/auth`
        : "http://localhost:4001/api/auth"),
    plugins: [adminClient()],
  }) as unknown as PandAuthClient;
}
