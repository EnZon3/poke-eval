# Gimmicks Policy Benchmark Verification (2026-04-12)

## Scope

Verification for newly added benchmark scenarios covering:

- Mega Evolution policy behavior (enabled by generation vs disabled override)
- Dynamax policy behavior (enabled by generation vs disabled override)
- Terastallization policy behavior (enabled by generation vs disabled override)

Scenarios live in:

- `src/benchmark.ts`

## Sources used

Primary implementation reference: Pokémon Showdown simulator source/tests.

- Mega Evolution execution path:
  - https://github.com/smogon/pokemon-showdown/blob/master/sim/battle-actions.ts
  - https://github.com/smogon/pokemon-showdown/blob/master/test/sim/misc/megaevolution.js
- Dynamax execution/condition behavior:
  - https://github.com/smogon/pokemon-showdown/blob/master/data/conditions.ts
  - https://github.com/smogon/pokemon-showdown/blob/master/test/sim/misc/dynamax.js
- Terastallization behavior:
  - https://github.com/smogon/pokemon-showdown/blob/master/sim/battle-actions.ts
  - https://github.com/smogon/pokemon-showdown/blob/master/test/sim/misc/terastal.js

## Verification method

1. Added benchmark scenarios for each gimmick under two policies:
   - `generation-default`
   - `disable-all`
2. Validated benchmark pass/fail behavior with `npm run validate:bench`.
3. Computed policy delta spot-checks via direct `evaluateTeams()` runs for the same scenario inputs.

## Spot-check results

Measured top-1 score deltas (same inputs, policy only changed):

- Dynamax scenario (Gen 8):
  - `generation-default`: `-0.5832`
  - `disable-all`: `-0.9442`
  - Interpretation: enabling Dynamax materially improves the line (less negative).

- Terastallization scenario (Gen 9):
  - `generation-default`: `0.9684`
  - `disable-all`: `0.8058`
  - Interpretation: enabling Tera materially improves offensive pressure.

- Mega scenario (Gen 6):
  - `generation-default`: candidate resolves to `Charizard-Mega-X`.
  - `disable-all`: candidate remains `Charizard`.
  - Interpretation: policy toggle correctly gates Mega form conversion.

## Acceptance outcome

- `npm run validate:bench` passed with all gimmick scenarios.
- Policy-aware benchmark coverage is now present and source-backed.
