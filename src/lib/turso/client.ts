import { createClient } from "@libsql/client";
import { configApp } from "../config/config";

let clientInstance: ReturnType<typeof createClient> | null = null;

export function getClient() {
  if (clientInstance) {
    return clientInstance;
  }

  const url = configApp.turso.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not configured. Set Turso env before using database features."
    );
  }

  clientInstance = createClient({
    url,
    authToken: configApp.turso.TURSO_AUTH_TOKEN,
  });

  return clientInstance;
}
