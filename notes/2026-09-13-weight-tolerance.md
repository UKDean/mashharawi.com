---
title: Weight tolerance is a commercial term, not a technical one
date: 2026-09-13
summary: Two mills can both meet the standard and still hand you a different invoice. The gap lives in the tolerance band.
lang: en
---

A rebar standard gives a nominal mass per metre and a tolerance around it. Both are technical. What happens inside that band is commercial.

An engineer checks that the bar is inside the band and moves on. A buyer should not, because the band is wide enough to move the invoice by several percent without anyone doing anything wrong.

## What the standards allow

The two standards most often named in Saudi specifications treat the band differently.

- **BS 4449** sets a tolerance on the nominal mass per metre of **±4.5%** for bars above 8 mm, and **±6%** for 8 mm and below. The band runs both ways.
- **ASTM A615/A615M** sets only a lower limit: an individual bar may weigh up to **6% under** its nominal weight. The standard does not cap the heavy side.

Always check the edition your specification names. The point here is not the exact figure, it is that every standard leaves a band, and the band has a price.

## What the band looks like in kilograms

Nominal mass per metre for a round bar is d² / 162, with d in millimetres. Here is the BS 4449 band of ±4.5% for common sizes:

| Diameter | Nominal (kg/m) | Light end (kg/m) | Heavy end (kg/m) |
|---|---|---|---|
| 12 mm | 0.888 | 0.848 | 0.928 |
| 16 mm | 1.578 | 1.507 | 1.649 |
| 20 mm | 2.466 | 2.355 | 2.577 |
| 25 mm | 3.853 | 3.680 | 4.026 |
| 32 mm | 6.313 | 6.029 | 6.597 |

Every value in that table is a compliant bar. A 32 mm bar 12 m long can weigh anywhere between 72.3 kg and 79.2 kg and pass. You can check any size with the [rebar weight calculator](/tools/rebar-weight/) or the full [rebar weight table](/writing/rebar-weight-table/).

## Two ways to bill the same steel

The tolerance only matters because of how the steel is invoiced. There are two common bases, and they react to the band in opposite ways.

- **Theoretical weight.** Pieces × length × nominal mass. The invoice is fixed by the count and the size. It does not move with how the mill rolled the bars.
- **Actual weight.** The weighbridge ticket. The invoice moves with every kilo the bars weigh above or below nominal.

Take 1,000 bars of 16 mm at 12 m. The theoretical weight is 1,000 × 12 × 1.578 = **18.936 t**.

Now suppose the batch was rolled 3% light, which is inside the band.

- Billed on theoretical weight, the buyer pays for 18.936 t and receives 18.368 t of steel. The 568 kg difference sits with the seller.
- Billed on actual weight, the buyer pays for 18.368 t. The buyer still gets 12,000 m of bar, which is what the drawing needs.

Turn it around: the same batch rolled 3% heavy weighs 19.504 t.

- On theoretical weight, the buyer pays for 18.936 t and the extra steel is the seller's cost.
- On actual weight, the buyer pays for 568 kg of steel the structure does not need.

Neither case is a defect. Both are inside the standard. The billing basis decides who carries the difference, and on large orders the difference is real money.

## Ordering by tonnes changes the problem

Many orders are placed in tonnes, not pieces. Then the tolerance stops being a money question and becomes a length question.

Order 20 t of 16 mm bars at 12 m:

- At nominal mass, 20 t is about **1,056 bars**.
- At the heavy end of the band, it is about **1,011 bars**: around 45 fewer.
- At the light end, it is about **1,106 bars**: around 50 more.

A site that ordered by tonnes against a bar bending schedule can run short of bars on a heavy batch, even though every bar complies. The note on [how many bars are in a tonne](/writing/bars-per-tonne/) works through the count for each size.

## Per bar, per sample, per batch

The tolerance is checked on test samples, not by weighing every bar. A mill can be inside the band on every test and still deliver a batch whose average sits close to one end of it.

That is why the certificate matters. Ask for a mill test certificate that shows the measured mass per metre, or the deviation from nominal, for each size and heat. It turns "within tolerance" from a claim into a number you can compare with the weighbridge.

## What to put in the contract

State the tolerance you expect, state how weight is verified, and state who witnesses it. In practice that means writing down:

1. **The standard and its edition**, so the band is defined and not argued about later.
2. **The billing basis**: theoretical or actual weight. If theoretical, name the nominal mass table, normally the one in the standard.
3. **The weighbridge**, if actual weight: whose it is, a current calibration certificate, and the ticket attached to the invoice.
4. **Who witnesses the weighing**, and whether a buyer's representative can attend.
5. **How a weight dispute is settled**: a re-weigh at an agreed weighbridge, and the difference above which it applies.
6. **For cut and bent bars**: whether weight comes from the bending schedule lengths at nominal mass, or from weighing the bundles after processing.

None of this is technical. The engineer has already accepted the bar. These lines decide who pays for the band the standard allows.
