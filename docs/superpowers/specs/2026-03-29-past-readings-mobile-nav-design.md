# Past Readings — Mobile Navigation Design

**Date:** 2026-03-29
**Scope:** `components/reading/MyReadings.tsx` only — mobile layout change, desktop unchanged.

---

## Problem

On mobile the current two-pane layout (list capped at 40vh + detail below) is cramped. The list is too short to browse comfortably and the detail area doesn't get enough height to scroll through the card reveal, metadata, and interpretation.

## Goal

On mobile: a single full-screen view at a time — either the list or the detail — with a clear back navigation. On desktop: no change to the existing side-by-side pane layout.

---

## Approach

State-driven view switch inside `MyReadings`. One new state field; no routing changes; no new files.

---

## State

Add `mobileView: 'list' | 'detail'` to `MyReadings`, defaulting to `'list'`.

Derived: `isMobileDetail = mobileView === 'detail' && selectedReading !== null`

**Transitions:**
- Tap a list item → `setSelectedKey(r.key)` + `setMobileView('detail')`
- Tap back button → `setMobileView('list')` (selectedKey unchanged — re-opening same card is instant)
- On desktop (`md:` breakpoint) → `mobileView` is ignored; CSS controls layout

---

## Mobile List View (`mobileView === 'list'`)

- `<aside>` is full-width, full-height, no max-height cap, no border-right
- Existing `qflow-option` list items are unchanged in design — tarot thumbnail + card name + date, full-width
- "Your readings" label visible at top
- `<section>` (detail pane) hidden via `hidden md:flex` so it only appears on desktop

## Mobile Detail View (`mobileView === 'detail'`)

- `<aside>` hidden via `hidden md:block`
- `<section>` full-width, full-height, scrollable
- Fixed back button at top-left: `← Past Readings` using `ReadingHistoryBackCta` style (matches existing nav CTA)
- Detail content below back button: card reveal (existing mobile scale-75/scale-90), metadata card, interpretation — all scrollable

## Desktop (≥ `md:`)

No change. Two-pane layout: `<aside>` fixed width with border-right + `<section>` flex-1. `mobileView` state is ignored.

---

## Implementation

Single file change: `components/reading/MyReadings.tsx`

1. Add `mobileView` state (`useState<'list' | 'detail'>('list')`)
2. Update list item `onClick` to also call `setMobileView('detail')`
3. Apply responsive Tailwind classes to `<aside>` and `<section>` based on `mobileView`
4. Add back button inside `<section>` — visible on mobile only (`md:hidden`), fixed or sticky at top

### Class changes

**`<aside>`:**
- Mobile list: `block w-full` (full-width, full-height)
- Mobile detail: `hidden`
- Desktop: `md:block md:w-[min(300px,34vw)] md:border-r md:border-white/10`

**`<section>`:**
- Mobile list: `hidden`
- Mobile detail: `flex flex-col w-full`
- Desktop: `md:flex md:flex-1`

**Back button** (inside `<section>`, `md:hidden`):
- Sticky top-0, z-10, same dark void background as reading page
- `← Past Readings` label, `ReadingHistoryBackCta` visual style

---

## What Does Not Change

- List item design (thumbnails, card name, date, `qflow-option` styles)
- Detail content (CardReveal, metadata card, Interpretation, EntropyProof)
- Desktop two-pane layout
- All loading/error/empty states
- Store, hooks, data fetching
