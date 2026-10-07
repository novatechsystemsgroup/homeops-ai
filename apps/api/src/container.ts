import { randomUUID } from "node:crypto";
import { HomeOpsService, type ModelProvider, type SearchProvider } from "@homeops/agent-core";
import { createNebiusModelProvider } from "@homeops/adapters-nebius";
import { createTavilySearchProvider } from "@homeops/adapters-tavily";
import {
  DEMO_HOUSEHOLD,
  createDatabase,
  createHouseholdStore,
  createPlanRepository,
  createTraceRepository,
  seedDemoHousehold,
  type DatabaseHandle,
  type HouseholdStore,
  type PlanStore
} from "@homeops/persistence";
import { createFakeModelProvider, createFakeSearchProvider } from "@homeops/test-fixtures";
import type { Household } from "@homeops/contracts";
import type { Logger } from "./http/logger";
import type { ServerConfig } from "./config";

export const APP_VERSION = "0.1.0";

export interface Container {
  readonly config: ServerConfig;
  readonly logger: Logger;
  readonly handle: DatabaseHandle;
  readonly households: HouseholdStore;
  readonly plans: PlanStore;
  readonly service: HomeOpsService;
  readonly model: ModelProvider;
  readonly search: SearchProvider;
  readonly startedAt: string;
  ensureDemoHousehold(): Promise<Household>;
  close(): void;
}

export function createContainer(config: ServerConfig, logger: Logger): Container {
  const handle = createDatabase(config.databasePath);
  const households = createHouseholdStore(handle);
  const plans = createPlanRepository(handle);

  const ids = { uuid: () => randomUUID() };
  const clock = { now: () => new Date() };
  const trace = createTraceRepository(handle, ids, clock);

  const model: ModelProvider =
    config.MODEL_PROVIDER === "nebius"
      ? createNebiusModelProvider({
          apiKey: config.NEBIUS_API_KEY,
          baseUrl: config.NEBIUS_BASE_URL,
          planModel: config.NEBIUS_MODEL_PLAN,
          fastModel: config.NEBIUS_MODEL_FAST,
          timeoutMs: config.MODEL_TIMEOUT_MS
        })
      : createFakeModelProvider();

  const search: SearchProvider =
    config.SEARCH_PROVIDER === "tavily" ? createTavilySearchProvider({ apiKey: config.TAVILY_API_KEY }) : createFakeSearchProvider();

  for (const degraded of config.degradedProviders) {
    logger.warn({ provider: degraded }, "provider credentials missing: falling back to the deterministic fake provider");
  }

  const service = new HomeOpsService({
    model,
    search,
    plans,
    households,
    trace,
    clock,
    ids,
    config: {
      searchEnabled: config.SEARCH_ENABLED,
      maxClarifyingQuestions: 2,
      modelTimeoutMs: config.MODEL_TIMEOUT_MS,
      searchTimeoutMs: config.SEARCH_TIMEOUT_MS,
      fallbackHouseholdId: DEMO_HOUSEHOLD.id,
      searchResultLimit: config.SEARCH_RESULT_LIMIT
    }
  });

  const container: Container = {
    config,
    logger,
    handle,
    households,
    plans,
    service,
    model,
    search,
    startedAt: clock.now().toISOString(),

    async ensureDemoHousehold() {
      const existing = await households.getHousehold(DEMO_HOUSEHOLD.id);
      if (existing) return existing;
      return seedDemoHousehold(households, clock.now().toISOString());
    },

    close() {
      handle.close();
    }
  };

  return container;
}
