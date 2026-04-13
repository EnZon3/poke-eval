# Benchmark Accuracy Spot Check (Protocol)

Date: 2026-04-12

Scope: quick protocol-driven verification of current benchmark expectations in `src/benchmark.ts` (13 scenarios).

## Protocol steps executed

1. **Defined contract**
   - Benchmarks should reflect broadly accepted matchup guidance:
     - ADV singles: expected answer types/roles into common threats.
     - VGC doubles: expected lead-pair archetype responses (tempo/disruption/positioning).

2. **Gathered external evidence**
   - Primary/competitive strategy references:
     - Smogon ADV analyses:
       - https://www.smogon.com/dex/rs/pokemon/skarmory/
       - https://www.smogon.com/dex/rs/pokemon/blissey/
       - https://www.smogon.com/dex/rs/pokemon/tyranitar/
       - https://www.smogon.com/dex/rs/pokemon/aerodactyl/
       - https://www.smogon.com/dex/rs/pokemon/salamence/
   - Secondary/mechanics/context references:
       - https://www.serebii.net/games/damage.shtml
       - https://www.vgcguide.com/battling
       - https://www.vgcguide.com/teambuilding

3. **Validation command run**
   - `npm run validate:bench`
   - Result: **13 / 13 PASS**.

## Evidence summary by benchmark area

### ADV singles checks (5 scenarios)

Observed benchmark outcomes align with Smogon checks/counters guidance:

- **Skarmory**: Electric/Fire pressure and Magneton trapping themes are supported by Skarmory’s Fire/Electric vulnerability and Magneton trap context.
- **Blissey**: physical/Fighting pressure (e.g., Heracross) is explicitly identified as a key way to punish Blissey.
- **Tyranitar**: Fighting and bulky Ground/Water pressure (e.g., Heracross/Swampert) is repeatedly called out in checks-and-counters sections.
- **Aerodactyl**: bulky Water responses and Ice/Water pressure are cited as practical checks.
- **Salamence**: Ice-based revenge pressure and strong neutral special pressure are common anti-Salamence patterns.

### VGC doubles archetype checks (8 scenarios)

Observed benchmark outcomes are directionally consistent with VGC Guide’s battle-planning framework:

- **Fake Out pressure / tempo shells**: disruption + positioning responses are emphasized.
- **Speed-control (Tailwind / fast pressure)**: speed control and board-position tools are central.
- **Trick Room**: explicit “battling against Trick Room” concept is present.
- **Redirection + setup**: utility/disruption and game-plan pressure align with guide principles.
- **Weather + pivot archetypes**: archetype/counterplay framing and role-based planning are supported.

## Outcome

- Current benchmark expectations are **reasonable and source-consistent at a strategic level**.
- Doubles scenarios now validate both inclusion expectations and numeric tolerance signals (`minTop1Score`, `minTop1VsTop2Gap`).
- This was a **spot check**, not frame-perfect cartridge simulation verification.

## Limitations (important)

- VGC evidence here is archetype/framework-level; it does not prove each exact pair ranking is uniquely optimal in all metagame contexts.
- No engine logic changed in this verification pass.

## Recommended follow-up (if stricter accuracy is desired)

1. Add per-scenario evidence links directly in `src/benchmark.ts` comments.
2. Add a periodic revalidation note per regulation/gen to prevent stale metagame assumptions.
