# Shift Hub — Design Spec v1

Goal: a manager glances at the phone for 2 seconds and knows what's wrong. One big number per card, a colored status chip, one short line of context. Neutral slate + teal brand; **no red/yellow arch branding, no McDonald's logos or names in UI chrome.**

## 1. Tokens (paste into `styles.css`)
```css
:root{
  --bg:#F1F5F9; --surface:#FFFFFF; --ink:#0F172A; --ink-2:#475569; --ink-3:#94A3B8;
  --line:#E2E8F0; --brand:#0F172A; --accent:#0D9488; --accent-soft:#CCFBF1;
  --good:#16A34A; --good-bg:#DCFCE7; --warn:#CA8A04; --warn-bg:#FEF9C3; --bad:#DC2626; --bad-bg:#FEE2E2;
  --r-card:16px; --r-chip:999px; --r-btn:12px;
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px;
  --shadow:0 1px 2px rgba(15,23,42,.06),0 1px 3px rgba(15,23,42,.08);
  --font:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;
  --tap:48px; --tabbar:64px;
}
body{font-family:var(--font);background:var(--bg);color:var(--ink);font-variant-numeric:tabular-nums;
  padding-bottom:calc(var(--tabbar) + env(safe-area-inset-bottom) + var(--s4))}
```
Status thresholds (one helper `status(value, target, dir)` returns good|warn|bad):
| Metric | Good | Warn | Bad |
|---|---|---|---|
| Labor % vs target | ≤ target | ≤ target+1.0 | > target+1.0 |
| Sales vs projection | ≥ 0% | −0–5% | < −5% |
| OEPE sec vs last week | ≤ LW | ≤ LW+10s | > LW+10s or slow_flag=Y |
| Guest score vs last week | ≥ LW | −1 to −3 | < LW−3 |
| Counts (overdue, OT, requests) | 0 | 1–2 | ≥3 (overdue: any = bad) |
Colors must never be the only signal: chip text says "On target" / "Watch" / "Over".

## 2. Type scale
| Role | Size/Line | Weight |
|---|---|---|
| Hero number (KPI) | 40/44 | 700, tabular |
| Screen title | 24/30 | 700 |
| Card title / label | 13/16 uppercase, .04em tracking, `--ink-2` | 600 |
| Secondary number | 20/24 | 700 |
| Body | 16/22 | 400 |
| Meta (updated, vs.) | 13/18 `--ink-3` | 500 |
| Chip | 12/16 | 700 |
| Tab label | 11/14 | 600 |
Min body size 16px (prevents iOS zoom on inputs).

## 3. Layout & components
- Screen padding 16px; card gap 12px. Header: 56px, `--surface`, title left (24px), right: data-source pill (Live = good-bg, Sample = warn-bg) + settings icon button 48×48. Remove the separate yellow key banner; fold it into the pill (tap pill → Settings).
- **Card**: `background:var(--surface);border-radius:var(--r-card);padding:16px;box-shadow:var(--shadow)`. Anatomy: label (row with chip on right) → hero number → one meta line ("vs $5,100 proj"). Max ~2 lines of text per card.
- **KPI grid**: 2 columns (`grid-template-columns:1fr 1fr;gap:12px`) of compact KPI cards (hero 32px) for secondary stats.
- **Status chip**: `display:inline-flex;gap:4px;padding:4px 10px;border-radius:999px;font:700 12px/16px var(--font)`; good/warn/bad use `--x-bg` bg + `--x` text; optional 6px dot.
- **List row** (replaces tables): min-height 56px, flex: left time (16/600, 56px wide), middle main value + small meta, right chip. 1px `--line` divider. Tap row to expand details (prep notes, splits) instead of showing all text.
- **Alert banner** (rush): `--ink` bg, white text, accent left bar 4px, icon `siren`, one line title + time window. No emoji.
- **Buttons**: primary `--accent` bg white, height 48, radius 12, 16/600. Secondary: white with `--line` border. Inputs 48px tall, 1px `--line`, focus ring 2px `--accent`.
- **Checkbox rows**: whole row tappable, 56px tall, 24px custom box.
- **Empty states**: one muted line "No events today" centered, no card chrome needed.
- Last-updated: single meta line under the header ("Updated 2:00 PM"), not in every card.
- Replace all emoji with Lucide inline SVG (24px, stroke 2, `currentColor`).

## 4. Bottom tab bar
Fixed, `height:64px + safe-area`, `--surface`, top border `--line`. 6 equal tabs, each ≥48×48: icon 24px over label 11px. Inactive `--ink-3`; active `--accent` icon+label plus 32×4 pill indicator above icon. Labels/icons (Lucide):
Home `house` · Labor `timer` · Rushes `calendar-clock` · Speed `gauge` · Guest `star` · Floor `clipboard-list`. Settings in header: `settings`.
(Rename "Brief" tab to "Home".)

## 5. Screens (from current data fields)
**Home** (Brief): Rush banner (rush_banner) → 2 hero cards full width: **Sales** $4,820 + chip (−$280 / "Behind"), meta "of $5,100 proj"; **Labor** 22.4% chip "Over +0.9", meta "target 21.5%" → 2×2 KPI grid: Overtime (count of names; names in meta), SMG comments, Harri requests, Overdue checklists (bad if any). Each tile taps through to its tab.
**Labor**: Summary card: current-hour labor % hero + chip + Call chip (HOLD=warn, EARLY-OUT=bad, CALL-IN/OK=good). List rows per hour: time · labor% · cap/actual hrs meta · call chip. Expand row → "Cut first", prep level, hold time. Drop the separate prep card.
**Rushes**: "Today" section: event card(s) — event name, big time window "8:30–10 PM", chips for runner time; prep note one line; "Source" as small link icon `external-link`. "Next 7 days": compact rows (date chip "Sat 31", name, window). Strip "EXAMPLE:" handling is data-side.
**Speed**: Hero: current/most recent OEPE sec with Δ vs last week chip. Hour rows: time · OEPE · Δ chip (slow_flag=Y → bad, `turtle` icon dropped). Expand: total time and order/cash/2nd-window as a 3-segment horizontal bar (order=accent, cash=ink-3, 2nd=warn). Pre-rush notes appear as a single tip card at top only if present.
**Guest**: One card per channel in a vertical stack: channel label, hero score, chip Δ vs last week. Coaching focus as accent-soft card with `target` icon (one line). Low-score comments collapsed under "3 comments" disclosure.
**Floor**: Segmented sub-tabs at top (48px): Positions · Breaks · Checklist · Fixes · Notes — show one tool at a time (currently 5 forms stacked = the biggest mess). Each: list first, then single inline input + 48px "+" button in a sticky bottom add bar. Breaks: live elapsed timer per person, chip turns warn at 25 min, bad at 30; "Back" 48px button. Storage note shrinks to a meta line "Saved on this phone".
**Settings**: card with key status chip, password input, Save (primary), Remove (secondary, destructive text color `--bad`).

## 6. App icon
`icon.svg` (provided): slate rounded square, teal progress arc + white clock hands (shift/time), no brand marks. Export PNGs: 192, 512, 512-maskable (add 10% padding), 180 apple-touch.
```json
"background_color":"#F1F5F9","theme_color":"#0F172A",
"icons":[{"src":"icons/icon-192.png","sizes":"192x192","type":"image/png"},
 {"src":"icons/icon-512.png","sizes":"512x512","type":"image/png"},
 {"src":"icons/icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"},
 {"src":"icon.svg","sizes":"any","type":"image/svg+xml"}]
```
`<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`, `<link rel="icon" href="icon.svg">`, `<meta name="theme-color" content="#0F172A">`, `<meta name="apple-mobile-web-app-capable" content="yes">`. Bump `sw.js` cache version.

## 7. Checklist
No emoji; all taps ≥48px; ≤2 lines text per card; numbers formatted ($4,820, 22.4%, 3:15); status = color + word; one "Updated" line; contrast AA.
