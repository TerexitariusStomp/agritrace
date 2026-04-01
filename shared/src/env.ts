export interface AppEnv {
  apiBaseUrl: string;
  appMode: "development" | "production" | "test";
}

type EnvSource = Record<string, string | undefined>;

const allowedNodeEnvs = ["development", "test", "production"] as const;

function requiredEnv(source: EnvSource, key: string, fallback?: string): string {
  const value = source[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

function defaultEnvSource(): EnvSource {
  if (typeof process !== "undefined" && process.env) {
    return process.env as EnvSource;
  }

  return {};
}

export function readAppEnv(source: EnvSource = defaultEnvSource()): AppEnv {
  const appModeCandidate = source.NODE_ENV ?? "development";
  if (!allowedNodeEnvs.includes(appModeCandidate as (typeof allowedNodeEnvs)[number])) {
    throw new Error(
      `Invalid NODE_ENV value: ${appModeCandidate}. Expected one of: ${allowedNodeEnvs.join(", ")}`
    );
  }

  const appMode = appModeCandidate as AppEnv["appMode"];

  return {
    apiBaseUrl: requiredEnv(source, "API_BASE_URL", "http://localhost:3000"),
    appMode
  };
}
