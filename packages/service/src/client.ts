import crypto from "node:crypto";
import { PandError } from "./errors.js";
import { signInternalToken } from "./internal-jwt.js";

export interface ServiceClientOptions {
  callerService?: string;
  baseUrl?: string;
  secret?: string;
  customFetch?: typeof fetch;
}

export interface ServiceClient {
  request: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
}

export function resolveServiceUrl(targetService: string, explicitBaseUrl?: string): string {
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "");
  }
  const rawMap = process.env.PAND_SERVICE_URLS;
  if (rawMap) {
    const parsed = JSON.parse(rawMap) as Record<string, string>;
    const url = parsed[targetService];
    if (url) {
      return url.replace(/\/$/, "");
    }
  }
  throw new Error(
    `Cannot resolve URL for service "${targetService}". Set PAND_SERVICE_URLS or pass baseUrl.`,
  );
}

export function createServiceClient(
  targetService: string,
  options: ServiceClientOptions = {},
): ServiceClient {
  const caller = options.callerService ?? process.env.PAND_SERVICE ?? "unknown";
  const fetchImpl = options.customFetch ?? fetch;

  return {
    async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
      const baseUrl = resolveServiceUrl(targetService, options.baseUrl);
      const reqId = crypto.randomUUID();
      const token = await signInternalToken(
        {
          sub: `service:${caller}`,
          authenticated: true,
          caller: `service:${caller}`,
          reqId,
        },
        options.secret,
      );

      const headers = new Headers(init.headers);
      headers.set("x-pand-internal-token", token);
      headers.set("x-request-id", reqId);
      if (init.body && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }

      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const res = await fetchImpl(`${baseUrl}${normalizedPath}`, {
        ...init,
        headers,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw PandError.upstream(
          `Upstream call to ${targetService}${normalizedPath} failed with ${res.status}`,
          { status: res.status, body },
        );
      }

      if (res.status === 204) {
        return undefined as T;
      }
      return (await res.json()) as T;
    },
  };
}
