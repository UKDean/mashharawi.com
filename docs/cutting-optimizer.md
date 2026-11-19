# Rebar cutting optimizer

Pages: `/tools/cutting-optimizer/` (EN), `/ar/tools/cutting-optimizer/` (AR), `/zh/rebar-cutting-optimizer/` (ZH).
Code: `assets/cutopt/engine.js` (all arithmetic), `assets/cutopt/app.js` (UI, three languages), `assets/cutopt/cutopt.css`.

## What it computes

Input: stock bar length (default 12 m), kerf (mm), optional allowance per piece (mm), reusable-offcut threshold (m), and a cut list of diameter, grade, length and pieces. Lines can be typed or pasted from Excel (diameter, length m, pieces, grade).

Output per diameter and grade: number of stock bars, cutting patterns with counts, required / purchased / waste length, waste % and utilisation %, kerf and allowance loss, reusable offcuts by length and count, and nominal weight (0.006165 x d² kg/m, the same formula as the rebar weight calculator). Report: print / PDF, CSV (formula-injection safe), and a WhatsApp summary that asks for confirmation first.

## Algorithm

- All lengths in integer millimetres. Diameters and grades are never mixed (grade compared case-insensitively).
- Kerf: each piece is modelled as length + kerf on a bar of stock + kerf, which is exactly "n cuts, or n − 1 when the last piece ends at the bar end". A leftover shorter than one kerf is counted as kerf loss.
- Plans tried: LP relaxation by column generation (Gilmore–Gomory, revised simplex, bounded-knapsack pricing) rounded down with the remainder finished heuristically; sequential best-fill patterns; first fit decreasing; best fit decreasing (up to 6,000 pieces). The plan with the fewest bars wins; ties go to more reusable offcut, then fewer distinct patterns.
- Lower bound: max(Martello–Toth L2, certified LP bound).
- Certified LP bound (`certifiedBound`): the simplex duals are only a guide. They are clipped to ≥ 0, scaled so the largest is 10⁹ and floored to integers Y. By LP duality (Farley), for any Y ≥ 0, bars ≥ ceil(Y·d / V) with V = max Y·a over feasible patterns. V comes from an exact integer bounded knapsack, Y·d from integer sums, both checked to be safe integers, and the ceiling is taken in integers. So the bound is valid whether the LP converged, hit the iteration limit (400) or the time budget (1.5 s per diameter/grade), or drifted numerically. Patterns are capped at the demand per length, which keeps it a relaxation (surplus pieces can always be dropped).
- Kerf is folded in exactly (piece + kerf on stock + kerf), so both bounds apply to the kerf problem unchanged.
- "Proven minimum" is shown only when bars = lower bound. Otherwise the page says heuristic and shows the maximum gap.

## Product range shown

The diameter suggestions are Al Rajhi Steel's straight rebar sizes: 10, 12, 14, 16, 18, 20, 25, 32 mm. The engine still calculates any diameter from 4 to 60 mm, and the page says other sizes are outside the quoted range. Commercial text says "cut to length"; bending shapes are confirmed before pricing (same wording as `/ar/rebar/`).

## Limits and honest caveats

- One stock length per run. Mixed stock (6, 9, 12, 18 m) is in RebarPlan, not here.
- Bent bars must be entered as their cut length; this tool does not compute shape codes.
- Weights are nominal, not delivered weight inside a standard's tolerance band.
- A planning aid, not a shop drawing and not a quotation.

## Privacy

Runs entirely in the browser. Nothing is stored or sent; no analytics added. User text is rendered with textContent only.

## Tests

`node --test tests/*.test.js` (25 tests in two files; `tests/helpers.js` holds the shared plan checker and an exhaustive solver) covers mass, unit conversion, kerf edge cases, grouping, offcuts, allowance, validation, LP/L2 bound validity against exhaustive search on 300 random small cases, a realistic villa schedule fixture, and a 20,000-piece performance case. The adversarial file adds: the certified bound against exhaustive search for random, negative, tiny and huge dual vectors; forced LP stops after 0, 1, 2 and 5 iterations and a zero time budget; exact-triplet instances; kerf and allowance boundaries; 100,000-piece lines and the 200,000-piece limit; 150 distinct lengths; and 300 random jobs with kerf and allowance where every "proven minimum" is checked to equal the true optimum. A deliberate +1 error in the bound makes 19 of the 25 tests fail.
