import { rmSync } from "node:fs";
import { join } from "node:path";

/** Each E2E run starts from an empty database, so tests never inherit earlier state. */
export default function globalSetup(): void {
  const dataDir = join(process.cwd(), ".data");
  for (const file of ["e2e.db", "e2e.db-shm", "e2e.db-wal"]) {
    rmSync(join(dataDir, file), { force: true });
  }
  rmSync(join(dataDir, "evidence"), { recursive: true, force: true });
}
