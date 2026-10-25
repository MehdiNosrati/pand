import type { PandConfig } from "./schema.js";

export interface ProjectPorts {
  basePort: number;
  gatewayPort: number;
  webPort: number;
  adminPort: number;
  postgresPort: number;
  valkeyPort: number;
  s3Port: number;
  grafanaPort: number;
  otlpHttpPort: number;
  services: Record<string, number>;
}

/**
 * Computes an unsigned 32-bit FNV-1a hash of the project name and maps it deterministically
 * to a port in [4000, 7900] in steps of 100.
 */
export function computeBasePort(projectName: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < projectName.length; i++) {
    hash ^= projectName.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return 4000 + (hash % 40) * 100;
}

export function resolveProjectPorts(config: PandConfig): ProjectPorts {
  const basePort = config.basePort ?? computeBasePort(config.name);
  const services: Record<string, number> = {};

  for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
    services[serviceName] = basePort + serviceConfig.portOffset;
  }

  return {
    basePort,
    gatewayPort: basePort + 1,
    webPort: basePort + 2,
    adminPort: basePort + 3,
    postgresPort: basePort + 32,
    valkeyPort: basePort + 79,
    s3Port: basePort + 90,
    grafanaPort: basePort + 80,
    otlpHttpPort: basePort + 18,
    services,
  };
}
