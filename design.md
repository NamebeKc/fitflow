# AdimFit — Design System

**Version:** 1.0 · 9 October 2026
**Direction:** Nigerian-rooted editorial · light-first · open-source type
**Status:** Specification. Nothing in here is implemented yet.

This file is the single source of truth for every visual decision in the
product. If a value is not in here, it does not go in a component. If a
component needs a value this file does not have, the value gets added
here first, with a reason.

Read §2 before arguing with §4. The audit is why the system looks the
way it does.

---

## 1. How to use this document

| If you are… | Read |
|---|---|
| Implementing a component | §4 (foundations), §6 (components) |
| Adding a colour | §4.1, then stop — you almost certainly don't need one |
| Picking a font size | §4.2.4. There are seven. That is all of them. |
| Reviewing a PR | §9 (enforcement), §10 (anti-patterns) |
| Migrating existing screens | §8 |

Every number in §4.1 and §4.2 was verified by script, not chosen by eye.
The scripts are in §11 so you can re-run them when you change something.

---

## 2. The audit this replaces

Measured against `NamebeKc/fitflow` at commit `23a963c`.

**There was no design system.** `src/app/globals.css` contained the
untouched shadcn default — every colour token was `oklch(x 0 0)`, pure
zero chroma. The product's actual appearance was painted on top of it in
arbitrary Tailwind values.

| Finding | Count |
|---|---|
| Component references to the shadcn tokens | **19 total** |
| Arbitrary bracket values in `.tsx` | **1,893** |
| `#CCFF00` hardcoded | **376×** across 56 files |
| Distinct font sizes | **18** |
| `white/[0.0x]` hairlines | 247× |
| `text-white/50` | 176× |
| `rounded-full` | 98× (6 radii in use) |
| Hardcoded near-duplicate greys | `#14161A` 61×, `#090A0C` 23×, `#0D0F13` 7×, `#1F2228` 5×, `#0D0F12` 4×, `#101216` 2× |

Three findings are worth stating plainly because they are not matters of
taste:

**`#0D0F13` and `#0D0F12` differ by one in the blue channel.** Nobody
chose both. They accumulated. Six near-identical dark greys is not a
palette, it is sediment.

**`text-sm` (102×) coexists with `text-[14px]` (21×)** — the same size
expressed two ways. And the pixel sizes in use run 9, 10, 11, 12, 13,
14, 15, 16, 17: nine consecutive one-pixel steps. That is not a type
scale, it is a record of individual nudges.

**The typeface was Geist, and Geist has no ₦ glyph.** Verified against
the upstream font binary: `U+20A6 NAIRA SIGN` is absent from its cmap.
Every price on the live site — ₦3,500, ₦2,500, ₦2,370 — has been
rendering its currency symbol in whatever the browser substituted. On a
product that sells in Naira. See §4.2.2.

### Why this reads as machine-made

The specific combination — Geist, a single neon accent on near-black,
`rounded-full` on everything, and coloured glow shadows
(`shadow-[0_10px_30px_-10px_rgba(204,255,0,0.5)]`) — is the most
recognisable default output of code-generating models in 2025–26. It is
not ugly. It is *generic*, which is worse for a paid product, because it
signals that no one made a decision.

The structural tell is the ratio: 1,893 arbitrary values against 19
token references. Human design teams converge on a small vocabulary
because they have to maintain it. Generated code has no such pressure,
so every component invents its own greys.

---

## 3. The direction

### 3.1 What we are making

A product that looks like it was made by people, in Lagos, for people
training in Nigeria. Editorial in structure — the rigour of a
well-designed sports magazine — and Nigerian in material.

The brand name is already doing this work and the old UI contradicted
it. **AdimFit** comes from the Igbo *a dị m*, "I am". Identity, not
obligation. A lime-on-black palette shared with every American fitness
app says the opposite: that this came from somewhere else.

### 3.2 Where the colour comes from

Not decoration, and not a mood board. Two materials:

**Indigo.** West African indigo dyeing is among the oldest continuous
textile crafts on the continent. The Kofar Mata pits in Kano's Old City
are described as the oldest dye pits in Africa; the signboard at the
entrance reads 1498, though Ibn Battuta is reported to have documented
the site in the fourteenth century, so the date is contested. Yoruba
*adire* — from *adi*, to tie, and *re*, to dye — was worked in natural
indigo alone until synthetic dyes arrived in the 1960s. Indigo is the
primary colour. It is deep, it is textile rather than screen, and it is
the opposite of neon.

**Laterite.** The red earth. Secondary and emphasis. Warm, mineral,
unmistakably not a Silicon Valley gradient.

**Ochre** is the third and is rationed — harmattan light, palm oil.
Highlights and chips only.

### 3.3 Non-negotiables

- No neon. No glow. No coloured shadow. Ever. (§10)
- Light is the default theme and gets the design attention. Dark is a
  proper second theme, not an inversion. (§4.1.3)
- Photography is of Nigerian bodies in Nigerian spaces. Stock images of
  American gyms undo everything above at zero notice.
- The typeface must be able to spell the brand name and the currency.
  This is a hard gate, not a preference. (§4.2.2)
- Restraint reads as expensive. When a screen feels unfinished, the fix
  is almost always *less*: more space, fewer weights, one accent.

---

## 4. Foundations

### 4.1 Colour

#### 4.1.1 Principles

1. **Neutrals are warm, never neutral-grey.** Every neutral carries
   hue 62–83 and chroma 0.004–0.014. Pure grey (`chroma 0`) is what the
   old build had and it is why it read as cold and machine-made.
2. **Tokens are semantic, never literal.** `--ink-muted`, not
   `--grey-500`. A component asks for a role; the theme decides the
   value.
3. **Foregrounds are paired with their surface.** See §4.1.4 — this is
   the rule that makes dark mode work, and the one most often missed.
4. **Defined in OKLCH, shipped as OKLCH.** Perceptually uniform
   lightness means a 10% step looks like a 10% step at every hue, which
   is what makes the elevation ladder consistent.

#### 4.1.2 Light theme — "paper"

```css
/* src/app/globals.css */
:root {
  /* Surfaces — warm, unbleached. Never #FFFFFF. */
  --paper:         oklch(97.8% 0.006 83);  /* #FAF7F3  page */
  --paper-raised:  oklch(99.2% 0.004 83);  /* #FEFCF9  cards, popovers */
  --paper-sunken:  oklch(95.4% 0.008 83);  /* #F2EFEA  wells, code, table stripe */

  /* Lines */
  --rule:          oklch(89%   0.009 83);  /* #DEDAD4  decorative divider */
  --rule-strong:   oklch(80%   0.012 83);  /* #C1BDB5  structural divider */
  --field-border:  oklch(63%   0.013 78);  /* #8E8881  input borders — WCAG 1.4.11 */

  /* Text */
  --ink:           oklch(22%   0.014 62);  /* #1F1914  body, headings */
  --ink-muted:     oklch(47%   0.012 70);  /* #5F5A54  secondary, icons */
  --ink-faint:     oklch(55%   0.012 74);  /* #76716A  meta, timestamps */

  /* Indigo — primary */
  --indigo:        oklch(38%   0.115 266); /* #253D7F */
  --indigo-deep:   oklch(27%   0.095 268); /* #132154  pressed, headers */
  --indigo-lift:   oklch(55%   0.120 264); /* #4D6FB7  hover on dark fills */
  --indigo-wash:   oklch(94%   0.022 266); /* #E4EBFB  selected rows, info */

  /* Laterite — secondary / emphasis */
  --laterite:      oklch(52%   0.135 40);  /* #A74824 */
  --laterite-wash: oklch(94%   0.025 45);  /* #FBE6DE */

  /* Ochre — highlight, rationed */
  --ochre:         oklch(72%   0.115 72);  /* #D1984C */

  /* States — deliberately desaturated */
  --success:       oklch(48%   0.085 150); /* #376B43 */
  --warning:       oklch(52%   0.105 62);  /* #93591D */
  --danger:        oklch(50%   0.150 25);  /* #A83634 */

  /* Paired foregrounds — see 4.1.4 */
  --on-indigo:     oklch(97.8% 0.006 83);  /* #FAF7F3 */
  --on-laterite:   oklch(97.8% 0.006 83);  /* #FAF7F3 */
  --on-ochre:      oklch(22%   0.014 62);  /* #1F1914 */
}
```

#### 4.1.3 Dark theme — "press"

Not an inversion. Elevation goes *up* in lightness, surfaces stay warm,
and the accents are re-picked rather than re-used — an indigo that works
at 38% lightness on paper is invisible at 17% lightness on press.

```css
/* src/app/globals.css */
:root[data-theme="dark"] {
  --paper:         oklch(17.5% 0.010 70); /* #13100C  page — not black */
  --paper-raised:  oklch(21.5% 0.011 70); /* #1D1914 */
  --paper-sunken:  oklch(14%   0.009 70); /* #0C0906 */

  --rule:          oklch(28%   0.011 70); /* #2C2823 */
  --rule-strong:   oklch(37%   0.013 70); /* #443F38 */
  --field-border:  oklch(53%   0.014 72); /* #716B63 */

  --ink:           oklch(94%   0.008 83); /* #EEEBE5  never pure white */
  --ink-muted:     oklch(74%   0.011 78); /* #AFAAA3 */
  --ink-faint:     oklch(62%   0.012 76); /* #8A857E */

  --indigo:        oklch(72%   0.105 262); /* #80A5E7 */
  --indigo-deep:   oklch(30%   0.075 266); /* #1C2B53 */
  --indigo-lift:   oklch(82%   0.075 260); /* #A8C6F5 */
  --indigo-wash:   oklch(26%   0.050 266); /* #19233C */

  --laterite:      oklch(70%   0.120 44);  /* #DC855E */
  --laterite-wash: oklch(27%   0.055 42);  /* #3C1C0F */
  --ochre:         oklch(78%   0.105 74);  /* #E0AD68 */

  --success:       oklch(72%   0.090 150); /* #7BB587 */
  --warning:       oklch(76%   0.100 68);  /* #DBA569 */
  --danger:        oklch(70%   0.135 28);  /* #E67B6E */

  /* Inverted: a LIGHT fill in dark mode needs a DARK foreground */
  --on-indigo:     oklch(14%   0.009 70);  /* #0C0906 */
  --on-laterite:   oklch(14%   0.009 70);  /* #0C0906 */
  --on-ochre:      oklch(14%   0.009 70);  /* #0C0906 */
}
```

#### 4.1.4 The paired-foreground rule

**A naive dark mode flips `--ink` and `--paper` globally and breaks
every coloured fill.** This was caught during verification, not in
review, and it is the single most valuable rule in this section.

In light mode an ochre chip is dark text on a light-amber fill: `--ink`
on `--ochre` measures **6.86:1**. Invert `--ink` for dark mode and the
same chip becomes near-white text on light amber — **1.70:1**, failing
by a factor of three, while every automated check that only looks at
body text still passes.

So each fill colour ships with its own foreground token, resolved per
theme. Components reference the pair, never `--ink` directly on a fill:

```tsx
// Correct — the pair travels together
<span className="bg-ochre text-on-ochre">Founding</span>

// Wrong — breaks silently in dark mode
<span className="bg-ochre text-ink">Founding</span>
```

#### 4.1.5 Verified contrast

WCAG 2.1. Body text ≥ 4.5:1 (1.4.3), icons and component boundaries
≥ 3:1 (1.4.11). All 30 pairings pass in both themes.

| Pairing | Light | Dark | Floor |
|---|---:|---:|---|
| body (`ink`/`paper`) | 16.28 | 15.92 | 4.5 |
| secondary (`ink-muted`) | 6.42 | 8.22 | 4.5 |
| meta (`ink-faint`) | 4.56 | 5.21 | 4.5 |
| link (`indigo`) | 9.60 | 7.61 | 4.5 |
| emphasis (`laterite`) | 5.49 | 6.81 | 4.5 |
| success | 5.89 | 7.94 | 4.5 |
| warning | 5.33 | 8.69 | 4.5 |
| error (`danger`) | 6.08 | 6.71 | 4.5 |
| icon (`ink-muted`) | 6.42 | 8.22 | 3.0 |
| input border (`field-border`) | 3.29 | 3.59 | 3.0 |
| solid primary (`on-indigo`/`indigo`) | 9.60 | 7.99 | 4.5 |
| solid secondary (`on-laterite`) | 5.49 | 7.15 | 4.5 |
| ochre chip (`on-ochre`) | 6.86 | 9.82 | 4.5 |
| text on indigo wash | 14.54 | 13.09 | 4.5 |
| text on laterite wash | 14.46 | 12.85 | 4.5 |

`--rule` (1.31 light / 1.82 dark) and `--rule-strong` (1.75 / 1.82) are
**below 3:1 and must never be the only thing conveying a boundary or a
state.** They are decorative dividers. Anything a user must perceive to
operate the interface uses `--field-border` or stronger.

#### 4.1.6 Usage rules

- **One accent per screen.** Indigo carries primary action. Laterite is
  for emphasis and destructive-adjacent states. They do not appear as
  peers in the same view.
- **Ochre is rationed to one element per screen**, usually the founding
  or trial chip. Two ochre elements means one is wrong.
- **No gradients** except a single case: a photo scrim (§6.9).
- **Colour never carries information alone.** State needs an icon or a
  label beside it (WCAG 1.4.1).
- **Chroma ceiling.** No token exceeds chroma 0.15. The old `#CCFF00`
  sits around 0.20 at 92% lightness, which is why it vibrated against
  black and read as olive when scrimmed.

### 4.2 Typography

#### 4.2.1 The stack

| Role | Family | Why |
|---|---|---|
| Display | **Fraunces** | Variable with `opsz` 9–144, `wght` 100–900, plus `SOFT` and `WONK` axes. The wonk axis gives real editorial voice at large sizes — it is the opposite of a neutral grotesque, and nothing generated by default looks like it. |
| Text & UI | **Archivo** | Variable `wght` 100–900 and `wdth` 62–125. Full figure set: `tnum`, `lnum`, `onum`, `zero`. The width axis earns its place on stat labels and compressed headings. |
| African Latin fallback | **Questrial** | Google Fonts commissioned an expansion of Questrial specifically to cover African Latin letterforms. It is the only candidate tested with complete coverage. Single-weight, so it is a glyph-level fallback only — never a UI font. |

All three are open-source (OFL) and self-hosted. No Google Fonts
runtime request: it costs a third-party connection, a CLS risk, and a
GDPR/NDPA question for zero benefit.

**Fraunces has no `tnum`.** It must never set a number that appears in a
column, a table, or a counter that updates. Display only.

#### 4.2.2 The glyph gate

A typeface for this product must render, at minimum:

| Language | Codepoints |
|---|---|
| Igbo | `ị` U+1ECB · `Ị` U+1ECA · `ọ` U+1ECD · `Ọ` U+1ECC · `ụ` U+1EE5 · `Ụ` U+1EE4 · `ṅ` U+1E45 · `Ṅ` U+1E44 |
| Yoruba | `ẹ` U+1EB9 · `Ẹ` U+1EB8 · `ọ` U+1ECD · `Ọ` U+1ECC · `ṣ` U+1E63 · `Ṣ` U+1E62 · combining U+0300/U+0301 |
| Hausa | `ɓ` U+0253 · `Ɓ` U+0181 · `ɗ` U+0257 · `Ɗ` U+018A · `ƙ` U+0199 · `Ƙ` U+0198 · `ƴ` U+01B4 · `Ƴ` U+01B3 |
| Currency | `₦` U+20A6 |

This is not an accessibility nicety. **The brand name is `a dị m` and
needs U+1ECB.** The price is `₦3,500` and needs U+20A6.

Measured coverage of the upstream binaries:

| Font | Igbo | Yoruba | Hausa | ₦ | Spells `a dị m` |
|---|---:|---:|---:|---:|---|
| **Questrial** | 8/8 | 8/8 | **8/8** | yes | yes |
| Source Serif 4 | 8/8 | 8/8 | 0/8 | yes | yes |
| Archivo | 6/8 | 8/8 | 0/8 | yes | yes |
| Fraunces | 6/8 | 8/8 | 0/8 | yes | yes |
| Newsreader | 6/8 | 6/8 | 0/8 | yes | yes |
| Schibsted Grotesk | 6/8 | 6/8 | 0/8 | **no** | yes |
| **Geist (current)** | 6/8 | 6/8 | 0/8 | **no** | yes |
| Instrument Serif | 0/8 | 2/8 | 0/8 | no | **no** |

Instrument Serif was the first choice on looks alone and **cannot spell
the company's name**. It was cut on this table. That is what the gate is
for.

Archivo and Fraunces are each missing exactly `ṅ`/`Ṅ` and the Hausa
hooks. Covered by a `unicode-range` fallback:

```css
/* src/app/globals.css — African Latin gap, filled precisely */
@font-face {
  font-family: "Archivo";
  src: url("/fonts/Archivo[wdth,wght].woff2") format("woff2-variations");
  font-weight: 100 900;
  font-stretch: 62% 125%;
  font-display: swap;
}
@font-face {
  font-family: "AfricanLatin";
  src: url("/fonts/Questrial-Regular.woff2") format("woff2");
  font-display: swap;
  /* ṅ Ṅ, Hausa hooked consonants. Nothing else. */
  unicode-range: U+1E44-1E45, U+0181, U+018A, U+0198-0199, U+01B3-01B4,
                 U+0253, U+0257;
}
:root {
  --font-text: "Archivo", "AfricanLatin", system-ui, sans-serif;
  --font-display: "Fraunces", "AfricanLatin", Georgia, serif;
  --font-mono: "Archivo", ui-monospace, monospace; /* with font-variant-numeric */
}
```

**Open decision (§12.1):** OFL permits modifying a font, but a Reserved
Font Name requires a rename on redistribution. Patching `ṅ`/`Ṅ` directly
into Archivo under a new name is roughly half a day for someone
comfortable with FontForge and removes the fallback mismatch on those
two glyphs. Worth doing only if Igbo-language UI copy ships.

#### 4.2.3 Numerals

A training log is a data product. Numbers must not shift as they change.

```css
.tabular { font-variant-numeric: tabular-nums slashed-zero; }
```

Applies to: all weights and loads, durations, dates, prices, streak
counts, the session timer, every stat tile, every table column.
Proportional figures are for running prose only.

#### 4.2.4 The scale

Seven sizes. This replaces eighteen. There is no eighth, and arbitrary
`text-[Npx]` is a lint error (§9.1).

| Token | Size | Line height | Tracking | Family | Use |
|---|---|---|---|---|---|
| `text-micro` | 0.75rem / 12px | 1.4 | +0.02em | Archivo | legal, axis labels, overline |
| `text-small` | 0.875rem / 14px | 1.5 | +0.005em | Archivo | secondary, captions, meta |
| `text-body` | 1rem / 16px | 1.6 | 0 | Archivo | body. The default. |
| `text-lead` | 1.125rem / 18px | 1.55 | 0 | Archivo | intro paragraph, coach replies |
| `text-title` | 1.5rem / 24px | 1.3 | −0.01em | Archivo | section and card headings |
| `text-page` | 2.25rem / 36px | 1.15 | −0.02em | Fraunces | screen titles |
| `text-display` | `clamp(2.5rem, 1.6rem + 4vw, 4rem)` | 1.05 | −0.03em | Fraunces | hero only, once per page |

Rules:

- **Minimum body size is 16px.** The old build used `text-[10px]` 98
  times and `text-[9px]` 13 times. At arm's length on a phone that is
  not small, it is unreadable, and it was carrying real content.
- **Three weights, product-wide:** 400 regular, 500 medium, 700 bold.
  Weight signals hierarchy; it is not decoration. No 300, no 600.
- **Measure is 60–75 characters** for prose (`max-width: 68ch`). The
  coach transcript is the main offender here.
- **Tracking tightens as size grows**, never the reverse. Negative
  tracking on small text is why the old UI felt cramped.
- **Headings use sentence case.** No ALL CAPS except `text-micro`
  overlines, which carry +0.08em tracking.
- `font-stretch` from Archivo's width axis is permitted *only* on
  `text-micro` overlines and stat labels, down to 85%. Never on prose.

### 4.3 Space

4px base unit. Nine steps, and only these:

```
space-1   4px     within a control (icon to its label)
space-2   8px     tight grouping (label to input)
space-3   12px    related items in a list
space-4   16px    default gap; card padding on mobile
space-6   24px    card padding on desktop; between cards
space-8   32px    between subsections
space-12  48px    between sections
space-16  64px    section top/bottom on mobile
space-24  96px    section top/bottom on desktop
```

- **Page gutter is 16px on mobile, 24px tablet, 32px+ desktop.** Never
  less than 16px — content touching the screen edge is the fastest way
  to look unfinished.
- Vertical rhythm: the gap between two blocks is always ≥ the padding
  inside them. Equal gaps make grouping ambiguous.
- Touch targets ≥ 44×44px (WCAG 2.5.5). Visual size may be smaller;
  the hit area may not.

Layout: 12 columns desktop, 6 tablet, 4 mobile. Content max-width
1200px; prose max-width 68ch regardless of container.

### 4.4 Radius, borders, depth

**Four radii.** This replaces six, and retires `rounded-full` on
anything that is not round.

```
radius-sm    4px    inputs, chips, buttons, tags
radius-md    8px    cards, panels, menus
radius-lg    16px   sheets, modals, the photo share card
radius-full  9999px avatars, status dots, progress tracks — only
```

`rounded-full` on a button is the single clearest "generated" tell in
the old build (98 occurrences). Editorial design uses near-square
controls. Buttons get `radius-sm`.

**Borders are 1px.** Default `--rule`; `--field-border` where the border
is the component (inputs, selects); `--rule-strong` for structural
divisions. No 2px borders except the focus ring.

**Depth comes from background lightness, not shadow.** `--paper` →
`--paper-raised` is the elevation ladder, and it is usually enough.

Exactly two shadows exist, both neutral:

```css
--shadow-overlay: 0 4px 16px -4px oklch(22% 0.014 62 / 0.10),
                  0 1px 3px   -1px oklch(22% 0.014 62 / 0.08);
--shadow-modal:   0 16px 48px -12px oklch(22% 0.014 62 / 0.18),
                  0 2px 8px   -2px  oklch(22% 0.014 62 / 0.10);
```

Overlay for popovers, dropdowns and toasts. Modal for dialogs and
sheets. **Cards get no shadow.** Nothing else gets a shadow, and no
shadow is ever tinted with an accent hue.

**Focus:** 2px `--indigo` ring at 2px offset, via `:focus-visible`.
Never removed, never replaced with a colour change alone.

### 4.5 Motion

Framer Motion, already a dependency. Three durations, two curves.

```
duration-micro   120ms   hover, press, checkbox, switch
duration-base    200ms   popover, dropdown, accordion, toast
duration-slow    320ms   sheet, dialog, route transition

ease-enter  cubic-bezier(0.2, 0, 0, 1)      decelerating — things arriving
ease-exit   cubic-bezier(0.3, 0, 0.8, 0.15) accelerating — things leaving
```

- **Enter and exit are asymmetric.** Arrivals decelerate, departures
  accelerate and are ~30% shorter. Symmetrical animation feels
  mechanical.
- **No spring on informational content.** Bounce is permitted on exactly
  one thing: the plan-card log confirmation (§6.6).
- **Transform and opacity only.** Never animate layout properties.
- **Honour `prefers-reduced-motion`:** all durations collapse to 0ms and
  transforms are dropped; opacity cross-fades may remain at 120ms.

```tsx
// src/lib/motion.ts
export const enter = { duration: 0.2, ease: [0.2, 0, 0, 1] } as const;
export const exit  = { duration: 0.14, ease: [0.3, 0, 0.8, 0.15] } as const;
```

**Skeletons, never spinners.** Already the house rule — keep it. A
skeleton matches the final geometry so nothing shifts on load, and it
uses `--paper-sunken` with a 1.4s opacity pulse between 1 and 0.6. No
shimmer sweep.

---

## 5. Tailwind wiring

Tokens are declared once in CSS and mapped into Tailwind. Components
then use semantic class names and never see a raw value.

```css
/* src/app/globals.css */
@theme inline {
  --color-paper:         var(--paper);
  --color-paper-raised:  var(--paper-raised);
  --color-paper-sunken:  var(--paper-sunken);
  --color-rule:          var(--rule);
  --color-rule-strong:   var(--rule-strong);
  --color-field-border:  var(--field-border);
  --color-ink:           var(--ink);
  --color-ink-muted:     var(--ink-muted);
  --color-ink-faint:     var(--ink-faint);
  --color-indigo:        var(--indigo);
  --color-indigo-deep:   var(--indigo-deep);
  --color-indigo-lift:   var(--indigo-lift);
  --color-indigo-wash:   var(--indigo-wash);
  --color-laterite:      var(--laterite);
  --color-laterite-wash: var(--laterite-wash);
  --color-ochre:         var(--ochre);
  --color-success:       var(--success);
  --color-warning:       var(--warning);
  --color-danger:        var(--danger);
  --color-on-indigo:     var(--on-indigo);
  --color-on-laterite:   var(--on-laterite);
  --color-on-ochre:      var(--on-ochre);

  --font-sans:    var(--font-text);
  --font-display: var(--font-display);

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
}
```

The existing shadcn aliases (`--color-background`, `--color-primary`,
and the rest) stay, remapped onto these so stock shadcn components
inherit the theme without being rewritten:

```css
:root {
  --background: var(--paper);
  --foreground: var(--ink);
  --card: var(--paper-raised);
  --card-foreground: var(--ink);
  --primary: var(--indigo);
  --primary-foreground: var(--on-indigo);
  --secondary: var(--paper-sunken);
  --secondary-foreground: var(--ink);
  --muted: var(--paper-sunken);
  --muted-foreground: var(--ink-muted);
  --accent: var(--indigo-wash);
  --accent-foreground: var(--indigo-deep);
  --destructive: var(--danger);
  --border: var(--rule);
  --input: var(--field-border);
  --ring: var(--indigo);
  --radius: 8px;
}
```

This is the step that was missing. With it, a shadcn `<Button>` is
on-brand with no overrides, which is what kills the 1,893 arbitrary
values at the root.

---

## 6. Components

Shadcn provides the primitive. This section says what AdimFit's version
of it looks like. Build none of these from scratch.

### 6.1 Button

| Variant | Fill | Text | Border | Use |
|---|---|---|---|---|
| `primary` | `indigo` | `on-indigo` | none | one per view |
| `secondary` | `paper-raised` | `ink` | 1px `field-border` | the common case |
| `ghost` | transparent | `ink-muted` | none | toolbars, cards |
| `danger` | transparent | `danger` | 1px `danger` | destructive; solid only on confirm |

Heights 36 / 44 / 52px (`sm` / `md` / `lg`); `md` is default and meets
the 44px target. Padding 16px horizontal, 24px for `lg`.
`radius-sm`. Weight 500. **Never `rounded-full`.** Hover shifts
background one step; press shifts to `indigo-deep` and
`transform: translateY(0.5px)`. No scale, no shadow.

### 6.2 Input, select, textarea

44px min height, `radius-sm`, 1px `field-border`, background
`paper-raised`. Label above in `text-small` weight 500 `ink` — never a
placeholder as a label. Placeholder `ink-faint`. Focus: border
`--indigo` plus the 2px ring. Error: border `--danger`, message below in
`text-small` `--danger` with a 16px icon. 16px font minimum, which also
stops iOS zooming the viewport on focus.

### 6.3 Card

`paper-raised`, 1px `rule`, `radius-md`, padding `space-4` mobile /
`space-6` desktop. **No shadow.** Interactive cards shift to
`paper-sunken` on hover and show the focus ring; they do not lift,
scale, or glow.

### 6.4 Navigation

Bottom bar on mobile, sidebar from `md`. Five destinations: Home, Coach,
Log, Progress, Profile. Lucide icons at 22px, labels `text-micro`
weight 500. Active: `--indigo` icon and label, plus a 2px `--indigo`
indicator — 3px top rule on mobile, 3px left rule in the sidebar.
Inactive `--ink-muted`. Bar background `paper-raised` with a 1px `rule`
on the content edge; `backdrop-filter` only where content scrolls
beneath, never as decoration.

### 6.5 Coach transcript

The most-used screen, and the one most damaged by the old treatment.

- Coach turns: no bubble. `text-lead` on `--paper`, max 68ch, with a
  2px `--indigo` left rule at 16px padding. Reads as editorial copy,
  which is what it is.
- User turns: right-aligned, `indigo-wash` fill, `ink` text,
  `radius-md` with the bottom-right corner at `radius-sm`.
- Bold is the only inline formatting the coach emits (already true in
  the prompt) and renders as weight 700 `ink`, not a colour change.
- Streaming: a 2px × 1.1em `--indigo` caret at 1.1s steps. No dots, no
  "thinking" shimmer.
- Composer: `paper-raised`, 1px top `rule`, 44px input, `radius-sm`.
  The send button is `primary` `md` and **square**.

### 6.6 Plan card

The one privileged output. It invites a write to permanent history, so
it should look like a document, not a banner.

`paper-raised`, 1px `rule-strong`, `radius-md`. Header: date in
`text-micro` overline `ink-faint` tabular, title in `text-title`.
Exercise rows separated by 1px `rule`, each with name in `text-body`
weight 500 and prescription in `text-body` tabular `ink-muted`.
Footer: estimated minutes and intensity as `text-micro` chips in
`paper-sunken`.

Log action is a full-width `primary` button. On success the card
transitions to a `success`-bordered state with a check — and this is the
one permitted spring: `{ type: "spring", stiffness: 400, damping: 30 }`.
Logging a session is the product's core moment and is allowed to feel
like something.

### 6.7 Stat tile

`paper-sunken`, no border, `radius-md`, padding `space-4`. Value in
`text-page` **Archivo** (not Fraunces — no `tnum`) weight 700, tabular,
`ink`. Label beneath in `text-micro` overline `ink-muted` at 90% width.
Delta, if any, in `text-small` tabular with an arrow glyph and
`success`/`danger` — never colour alone.

### 6.8 Chips and badges

`text-micro` weight 500, 24px height, `radius-sm`, 8px horizontal
padding. Neutral `paper-sunken`/`ink-muted`; info
`indigo-wash`/`indigo-deep`; success, warning, danger on their wash with
the paired foreground. Founding/trial is the one ochre element:
`ochre`/`on-ochre`.

### 6.9 Photo share card

Keeps the existing 1080×1350 geometry and client-side compositing
(§ nothing changes in `share-card.ts`'s privacy behaviour). What changes
is the treatment: the lime bloom goes, replaced by a flat `indigo-deep`
scrim at 0.22 plus a bottom linear gradient to 0.88. Quote in Fraunces
`text-page`, metadata in Archivo `text-small` tabular. Wordmark bottom
left at 60% opacity. This is the only gradient in the system.

### 6.10 Empty states

Three parts, centred, max 42ch: a 32px `ink-faint` Lucide icon, one
`text-title` line naming what is absent, one `text-small` `ink-muted`
line naming the single action that fixes it, then one `secondary`
button. No illustrations.

---

## 7. Screen direction

| Screen | The one thing it must do |
|---|---|
| Landing | Lead with a Nigerian body training in a Nigerian space, and one `text-display` sentence about what the coach *decides*. Price in ₦ above the fold, tabular. |
| Home | Answer "what do I do today" in the first viewport. One plan card. Nothing else above the fold. |
| Coach | Read like a conversation with a person, not a chat UI. §6.5. |
| Log | Three taps: activity, duration, save. Everything else collapsed behind "Add detail". |
| Progress | Editorial data. One chart maximum per viewport, tabular figures, `rule` gridlines at 1px, no fills under lines. |
| Profile | A settings document, not a dashboard. Grouped sections with `rule` dividers, `text-micro` overlines. |
| Paywall | `paper`, not dark. Price tabular in `text-page`. One `primary` button. The guarantee in `text-small` directly beneath it, never in a footer. |

---

## 8. Migration

376 hardcoded instances of one colour across 56 files cannot be fixed
by hand reliably, and should not be fixed in one pull request.

**Phase 0 — foundations only.** Add the token blocks (§4.1), the
`@theme` mapping and the shadcn remap (§5), self-host the three fonts,
swap `layout.tsx` off Geist. Change no components. At this point the
app renders light and mostly correct, because shadcn primitives follow
the remapped tokens. Expect it to look wrong where arbitrary values
fight the new surfaces — that is the point, it shows you the work.

**Phase 1 — mechanical substitution.** A codemod handles the
unambiguous cases:

| From | To |
|---|---|
| `#CCFF00`, `text-[#CCFF00]` | `text-indigo` / `bg-indigo` by context |
| `#d9ff33` | `indigo-lift` |
| `bg-black/50`, `#090A0C`, `#0D0F13`, `#0D0F12`, `#101216` | `bg-paper` |
| `#14161A`, `#1F2228` | `bg-paper-raised` |
| `border-white/[0.0x]` | `border-rule` |
| `text-white/50` | `text-ink-muted` |
| `text-white` | `text-ink` |
| `shadow-[...rgba(204,255,0,...)]` | *delete* |
| `rounded-full` on a button | `rounded-sm` |

Review the diff per file; do not trust the codemod on `rounded-full`,
which is legitimately correct for avatars and dots.

**Phase 2 — type scale.** The 18 sizes collapse to 7. This one is
genuinely manual, because `text-[13px]` maps to `text-small` or
`text-body` depending on whether it was content or a label. Order:
coach, log, home, progress, profile, landing.

**Phase 3 — components.** §6, one component per PR, screenshot before
and after in the description.

**Phase 4 — dark theme.** Only after light is finished everywhere.
Building both at once is how you get six near-identical greys again.

Sequence by traffic, not by ease: Coach and Log first.

---

## 9. Enforcement

A design system without enforcement regresses to sediment within a
month. This is what stops it.

### 9.1 Lint

```js
// eslint.config.mjs — additions
{
  rules: {
    "no-restricted-syntax": ["error",
      { selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
        message: "No hex colours. Use a token from design.md §4.1." },
      { selector: "Literal[value=/text-\\[[0-9.]+px\\]/]",
        message: "No arbitrary font sizes. Seven exist — design.md §4.2.4." },
      { selector: "Literal[value=/shadow-\\[/]",
        message: "No arbitrary shadows. Two exist — design.md §4.4." },
    ],
  },
}
```

Note: `eslint` currently crashes on `react/display-name` due to an
eslint 10 / `eslint-plugin-react` incompatibility. That has to be fixed
before any of this runs, which makes it a prerequisite of Phase 0, not
a nice-to-have.

### 9.2 CI gate

```bash
# scripts/design-lint.sh — fails the build on regression
set -e
BAD=$(grep -ron "#[0-9a-fA-F]\{6\}" src --include=*.tsx --include=*.ts \
      | grep -v "Google\|4285F4\|34A853\|FBBC05\|EA4335" | wc -l)
[ "$BAD" -eq 0 ] || { echo "FAIL: $BAD hardcoded hex colours"; exit 1; }

SIZES=$(grep -roh "text-\[[0-9.]*px\]" src --include=*.tsx | sort -u | wc -l)
[ "$SIZES" -eq 0 ] || { echo "FAIL: $SIZES arbitrary font sizes"; exit 1; }
```

Baseline today: 376 hex and 9 arbitrary sizes. Run it with a
descending threshold during migration rather than at zero, or it blocks
every PR from the start.

### 9.3 Review checklist

- [ ] No hex, no `rgb()`, no `oklch()` outside `globals.css`
- [ ] Every size from the seven in §4.2.4
- [ ] Every colour pair from §4.1.5, or newly verified by §11.1
- [ ] Coloured fill uses its paired foreground (§4.1.4)
- [ ] Numbers carry `tabular-nums`
- [ ] Touch targets ≥ 44px
- [ ] `:focus-visible` present and visible in both themes
- [ ] Renders correctly at 320px wide
- [ ] `prefers-reduced-motion` honoured
- [ ] No shadow on a card; no accent-tinted shadow anywhere

---

## 10. Anti-patterns

Specific, because "avoid AI slop" is not actionable.

**Colour.** No neon or electric accents (`#CCFF00` and its family). No
accent-tinted shadows or glows. No purple-to-cyan, or any multi-hue
gradient. No pure `#000000` or `#FFFFFF`. No zero-chroma greys. No
`bg-gradient-to-br` on a card.

**Type.** Not Inter, Geist, Poppins, Montserrat, or Space Grotesk. No
more than three weights. No letter-spacing on body text. No text below
16px carrying content. No gradient-filled or `background-clip: text`
headlines.

**Layout.** No full-width centred everything. No three-up feature grid
of icon-plus-heading-plus-paragraph. No `rounded-full` buttons. No
`backdrop-blur` as decoration. Not every card the same size in a grid
to avoid making a judgement about importance.

**Motion.** No bouncy springs on informational UI. No infinite ambient
animation. No scale-on-hover above 1.02. No staggered fade-in of every
list item on mount.

**Content.** No stock photography of American gyms. No emoji as UI
icons. No exclamation marks in system copy. No "✨ AI-powered". No
inspirational quotes the coach did not generate for that user.

---

## 11. Verification scripts

Keep these. They are how §4 stays true.

### 11.1 Contrast

It parses the tokens out of `globals.css` rather than restating them, so
the check can never drift from what actually ships.

```python
# scripts/design/contrast.py   — pip install coloraide
#   usage: python3 scripts/design/contrast.py src/app/globals.css
import re, sys, pathlib
from coloraide import Color

PAIRS = [  # (foreground, background, minimum ratio)
    ("ink", "paper", 4.5), ("ink-muted", "paper", 4.5),
    ("ink-faint", "paper", 4.5), ("ink", "paper-raised", 4.5),
    ("ink", "paper-sunken", 4.5), ("indigo", "paper", 4.5),
    ("laterite", "paper", 4.5), ("success", "paper", 4.5),
    ("warning", "paper", 4.5), ("danger", "paper", 4.5),
    ("ink-muted", "paper", 3.0),            # icons, WCAG 1.4.11
    ("field-border", "paper", 3.0),         # input borders, WCAG 1.4.11
    ("on-indigo", "indigo", 4.5), ("on-laterite", "laterite", 4.5),
    ("on-ochre", "ochre", 4.5),
    ("ink", "indigo-wash", 4.5), ("ink", "laterite-wash", 4.5),
]
TOKEN = re.compile(r"--([a-z-]+):\s*(oklch\([^)]*\))\s*;")

def themes(css):
    out, cur = {}, None
    for line in css.splitlines():
        if re.search(r":root\s*\{", line):          cur = out.setdefault("light", {})
        elif re.search(r'data-theme="dark"', line): cur = out.setdefault("dark", {})
        m = TOKEN.search(line)
        if m and cur is not None:
            cur[m.group(1)] = m.group(2)
    return out

css = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
failed = 0
for theme, tok in themes(css).items():
    print(f"\n==== {theme} ====")
    for fg, bg, need in PAIRS:
        if fg not in tok or bg not in tok:
            print(f"  MISSING TOKEN: {fg} / {bg}")
            failed += 1
            continue
        r = Color(tok[fg]).contrast(Color(tok[bg]), method="wcag21")
        ok = r >= need
        failed += not ok
        print(f"  {fg:>13} on {bg:<14}{r:7.2f}  (>={need})  "
              f"{'PASS' if ok else 'FAIL'}")
print(f"\n{failed} failing pair(s)")
sys.exit(1 if failed else 0)
```

Verified: run against the two token blocks in §4.1.2 and §4.1.3 it
reports **34 pairings, 0 failing, exit 0**. Any new colour pair gets
added to `PAIRS` and must pass before it ships.

### 11.2 Glyph coverage

```python
# scripts/design/glyphs.py   — pip install fonttools
import sys
from fontTools.ttLib import TTFont
REQUIRED = {
    "Igbo":     [0x1ECB, 0x1ECA, 0x1ECD, 0x1ECC, 0x1EE5, 0x1EE4, 0x1E45, 0x1E44],
    "Yoruba":   [0x1EB9, 0x1EB8, 0x1ECD, 0x1ECC, 0x1E63, 0x1E62, 0x0300, 0x0301],
    "Hausa":    [0x0253, 0x0181, 0x0257, 0x018A, 0x0199, 0x0198, 0x01B4, 0x01B3],
    "Currency": [0x20A6],
}
cmap = set()
for t in TTFont(sys.argv[1], lazy=True)["cmap"].tables:
    cmap |= set(t.cmap.keys())
bad = False
for group, cps in REQUIRED.items():
    missing = [cp for cp in cps if cp not in cmap]
    print(f"{group:<9} {len(cps) - len(missing)}/{len(cps)}"
          + ("  missing: " + " ".join(f"{chr(c)}(U+{c:04X})" for c in missing)
             if missing else ""))
    bad |= bool(missing)
print('spells "a dị m":', all(cp in cmap for cp in (0x61, 0x64, 0x1ECB, 0x6D)))
raise SystemExit(1 if bad else 0)
```

**Run this on any font before adopting it.** It is what cut Instrument
Serif, and what would have caught the missing ₦ eighteen months ago.

---

## 12. Open decisions

1. **Patch `ṅ`/`Ṅ` into Archivo?** §4.2.2. Half a day, requires a rename
   under OFL's Reserved Font Name clause. Only worth it if Igbo-language
   UI copy ships — for an Igbo *brand name* alone, the `unicode-range`
   fallback is sufficient.
2. **Photography.** The direction depends on it and there is none. A
   shoot in Lagos with two or three real users is the highest-leverage
   spend in this whole document, and it is not a design decision I can
   make for you. Until it exists, screens stay type-and-space led rather
   than filled with stock.
3. **Dark theme priority.** Phase 4 as written. If gym-at-night usage
   turns out to dominate in PostHog, it moves ahead of Phase 3.
4. **The name.** `Fitflow` still appears in the repo, the Firebase
   project, the Cloud Run service and `%APP_NAME%` in emails, while the
   product is AdimFit. A visual redesign that leaves two names in the
   product is still half-finished. Separate work, same decision.
5. **Logo and wordmark.** Out of scope here. Whatever it becomes must
   set `a dị m` correctly — same gate as §4.2.2.

---

## Appendix — provenance

- Audit counts: `grep`/`git` against `NamebeKc/fitflow` at `23a963c`.
- Contrast: `coloraide`, WCAG 2.1 method, 30 pairings, both themes, all
  passing as of this version.
- Glyph coverage: `fontTools`, upstream `google/fonts` binaries, 8
  families.
- Codepoints: verified against Python `unicodedata`.
- Indigo and *adire* background: see sources below. The 1498 date on the
  Kofar Mata signboard conflicts with the reported Ibn Battuta account
  from the fourteenth century; the pits' precise founding is contested
  and this document does not rely on the date.
- Questrial's African Latin expansion: commissioned by Google Fonts.

Sources:
- [Giving African languages more Latin font choices — Google](https://blog.google/intl/en-africa/products/connect-communicate/giving-african-languages-more-latin/)
- [Meet Questrial: free fonts for African languages — Google Design](https://design.google/library/meet-questrial-African-languages-font)
- [An introduction to the indigo dye styles of Western Africa — Heddels](https://www.heddels.com/2016/09/an-introduction-to-the-indigo-dye-styles-of-western-africa/)
- [Indigo in Africa: An Indigenous Craft — Fabrics-Store](https://blog.fabrics-store.com/?p=20111)
