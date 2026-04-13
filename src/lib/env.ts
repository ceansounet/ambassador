import "server-only";

export function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (value === undefined || value === "") {
    throw new Error(`${name} is not set`);
  }

  return value;
}

export function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value !== undefined && value !== "" ? value : null;
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
