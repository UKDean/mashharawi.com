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
- Lower bound: max(Martello–Toth L2, ceil of the LP bound). The LP bound uses Farley's formula, so it stays valid even if column generation stops early.
- "Proven minimum" is shown only when bars = lower bound. Otherwise the page says heuristic and shows the maximum gap.

## Limits and honest caveats

- One stock length per run. Mixed stock (6, 9, 12, 18 m) is in RebarPlan, not here.
- Bent bars must be entered as their cut length; this tool does not compute shape codes.
- Weights are nominal, not delivered weight inside a standard's tolerance band.
- A planning aid, not a shop drawing and not a quotation.

## Privacy

Runs entirely in the browser. Nothing is stored or sent; no analytics added. User text is rendered with textContent only.

## Tests

`node --test tests/*.test.js` covers mass, unit conversion, kerf edge cases, grouping, offcuts, allowance, validation, LP/L2 bound validity against exhaustive search on 300 random small cases, a realistic villa schedule fixture, and a 20,000-piece performance case.
