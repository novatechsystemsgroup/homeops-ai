import type { Source } from "@homeops/contracts";

export const FIXTURE_SOURCES: Source[] = [
  {
    title: "Gas Safe Register — find a registered engineer",
    url: "https://www.gassaferegister.co.uk/",
    retrievedAt: "2026-10-07T08:00:00.000Z",
    snippet: "Check that an engineer is Gas Safe registered before any boiler work."
  },
  {
    title: "Energy Saving Trust — boiler servicing advice",
    url: "https://energysavingtrust.org.uk/advice/boilers/",
    retrievedAt: "2026-10-07T08:00:01.000Z",
    snippet: "An annual service keeps a boiler safe and efficient."
  },
  {
    title: "Which? — boiler noises explained",
    url: "https://www.which.co.uk/reviews/boilers",
    retrievedAt: "2026-10-07T08:00:02.000Z",
    snippet: "Humming and banging usually point to a service or a part replacement."
  }
];
