# Mechanics Change Protocol (Required)

Last updated: April 2026

This file is the required pre-change checklist for any edit that can affect engine behavior, mechanics interpretation, ranking logic, or battle outcomes.

## When this protocol is required

Read and follow this file **before coding** if your change touches any of:

- `src/evaluation/**`
- `src/mechanics.ts`
- `src/pokemon.ts`
- `src/data.ts`
- `src/constants.ts`
- `src/estimation.ts`
- `src/benchmark.ts`
- Any code path that changes damage, speed order, statuses, weather, hazards, setup logic, move effects, targeting, or generation/format behavior.

If unsure, treat the change as mechanics-sensitive and follow this protocol.

## Required workflow (do in order)

1. Define the mechanic contract
   - Write the expected behavior in plain language first.
   - Include fail conditions and edge cases.

2. Gather external evidence
   - Validate against at least one primary reference and one secondary reference.
   - Preferred references:
     - https://calc.pokemonshowdown.com/
     - https://www.serebii.net/games/damage.shtml
     - https://pokemondb.net/type

3. Add/adjust tests first when practical
   - Add focused tests for the intended behavior and edge cases.
   - Keep tests minimal and deterministic.

4. Implement the smallest viable code change
   - Avoid unrelated tuning in the same PR.
   - Keep generation/format gates explicit.

5. Validate locally
   - `npm run validate:all`
   - Plus targeted checks for changed mechanics.

6. Document evidence
   - In PR notes, include:
     - mechanic area,
     - scenario setup,
     - expected behavior from sources,
     - before/after behavior,
     - commands run,
     - known limitations.

## Definition of done (mechanics-sensitive changes)

A mechanics change is complete only when:

- Contract is documented and test-covered,
- Behavior matches chosen references for the covered cases,
- `validate:all` passes,
- Related docs are updated when assumptions changed.

## Required companion docs

Read these alongside this protocol:

- `docs/ENGINE_ACCURACY_VERIFICATION.md`
- `docs/MECHANICS_VALIDATION.md`

## Maintenance note

If process expectations change, update this file in the same PR.
