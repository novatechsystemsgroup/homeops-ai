# Safety boundaries

HomeOps AI coordinates household work. It is **not** an emergency service, a diagnostician or a contractor,
and the product says so in the UI and in every emergency response.

## Deterministic triage

`assessSafety()` (`packages/agent-core/src/safety/rules.ts`) is a pure function over the intake text. It is
the only component allowed to decide whether a situation is dangerous.

| Rule | Trigger examples | Urgency | Mandatory content |
|---|---|---|---|
| `GAS_001` | "smell of gas", "gas leak", "hissing", "miros de gaz" | emergency | leave, do not switch anything, call 0800 111 999 |
| `FIRE_001` | "smoke", "burning", "flames", "fum" | emergency | evacuate, call 999 |
| `ELEC_001` | water near a socket, plug, fuse box or wiring | emergency | do not touch, isolate only if safe, call 999 if at risk |
| `CO_001` | "carbon monoxide", "CO alarm" | emergency | ventilate, leave, call 0800 111 999 |
| `HEAT_002` | no heat or hot water **and** a vulnerable occupant | urgent | warm room, Gas Safe engineer, check back |
| `HEAT_003` | no heat or hot water | urgent | contact an engineer, short-term plan |
| `BOILER_010` | boiler noise without gas, smoke or a leak | needs attention | do not open the casing, book a service |
| `VULNERABLE_001` | baby, infant, elderly, disabled, oxygen, dialysis | needs attention | (no standalone copy) |

Guard rails:

- **Negation aware.** "There is no smell of gas" does not fire `GAS_001`; the negation window is deliberately
  short so that "no heating and my elderly mother" still raises the vulnerable-occupant flag.
- **Counterfactual aware.** "I do not want to be without hot water" is a hope, not a loss of hot water.
- **The rules are a floor.** `URGENCY_RANK` decides; a model can only be overridden upwards, and the trace
  records `safety.override.applied` when that happens.
- **Emergencies skip the model.** The response is built from rule copy, marked `researchStatus: "skipped"`, and
  the trace shows `model.plan.skipped`.

## Product limits, stated in the UI

- No payments, no real bookings, no messages sent to third parties. Every state change is an internal record.
- Every action that would contact a third party carries `requiresConfirmation: true`, and mutating tools refuse
  to run without `confirm: true`.
- Research results always keep their URL and retrieval time; prices and availability are never invented.
- Demo data is synthetic (Hartley household, Bristol). "Delete demo data" removes the household, its plans, its
  actions and its trace events.

## What we deliberately did not build

- smart-home device control, or any integration with real Alexa devices, Ring or alarms;
- professional gas, electrical or structural diagnosis;
- guaranteed prices, availability or commercial recommendations presented as facts;
- accounts, multi-tenancy or a native mobile app.

