# Past Readings Mobile Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped two-pane mobile layout in Past Readings with a single full-screen view at a time — list view OR detail view — with a sticky back button, while leaving the desktop layout completely unchanged.

**Architecture:** Add `mobileView: 'list' | 'detail'` state to `MyReadings`. Tapping a list item sets `mobileView` to `'detail'`; the back button resets it to `'list'`. Responsive Tailwind classes (`md:`) control which pane is visible on desktop vs mobile — no JS branching needed for desktop.

**Tech Stack:** React (`useState`), Tailwind CSS responsive variants, existing `ReadingHistoryBackCta` component from `ReadingWalletHud.tsx`.

**Spec:** `docs/superpowers/specs/2026-03-29-past-readings-mobile-nav-design.md`

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Modify | `components/reading/MyReadings.tsx` | All changes — state, classes, back button, import |

---

### Task 1: Add `mobileView` state and update import

**Files:**
- Modify: `components/reading/MyReadings.tsx`

- [ ] **Step 1: Add `ReadingHistoryBackCta` to the existing `ReadingWalletHud` import**

Find this line near the top of `MyReadings.tsx`:
```ts
import { ReadingConnectInline } from "@/components/reading/ReadingWalletHud";
```
Replace with:
```ts
import { ReadingConnectInline, ReadingHistoryBackCta } from "@/components/reading/ReadingWalletHud";
```

- [ ] **Step 2: Add `mobileView` state inside `MyReadings()`**

Find the existing state declarations block (just after `const [selectedKey, setSelectedKey] = useState<string | null>(null);`) and add one line immediately after:
```ts
const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
git add components/reading/MyReadings.tsx
git commit -m "feat(my-readings): add mobileView state and import ReadingHistoryBackCta"
```

---

### Task 2: Wire list item click to set `mobileView`

**Files:**
- Modify: `components/reading/MyReadings.tsx`

- [ ] **Step 1: Update the list item button `onClick`**

Find this in the `items.map(...)` block:
```tsx
onClick={() => setSelectedKey(r.key)}
```
Replace with:
```tsx
onClick={() => { setSelectedKey(r.key); setMobileView('detail'); }}
```

- [ ] **Step 2: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/reading/MyReadings.tsx
git commit -m "feat(my-readings): tap list item navigates to mobile detail view"
```

---

### Task 3: Update `<aside>` classes for mobile/desktop split

**Files:**
- Modify: `components/reading/MyReadings.tsx`

- [ ] **Step 1: Replace the `<aside>` className**

Find:
```tsx
<aside
  className="my-readings__list min-h-0 w-full max-h-[min(40vh,20rem)] shrink-0 overflow-y-auto overflow-x-hidden overscroll-y-contain py-2 pr-1 pt-1 [scrollbar-gutter:stable] md:max-h-none md:h-full md:w-[min(300px,34vw)] md:max-w-[300px] md:flex-none md:border-r md:border-white/10 md:py-3 md:pr-5"
  aria-label="Past readings list"
>
```
Replace with:
```tsx
<aside
  className={`my-readings__list min-h-0 w-full shrink-0 overflow-y-auto overflow-x-hidden overscroll-y-contain py-2 pr-1 pt-1 [scrollbar-gutter:stable] md:!block md:max-h-none md:h-full md:w-[min(300px,34vw)] md:max-w-[300px] md:flex-none md:border-r md:border-white/10 md:py-3 md:pr-5 ${mobileView === 'detail' ? 'hidden' : 'block'}`}
  aria-label="Past readings list"
>
```

Key changes:
- Removed `max-h-[min(40vh,20rem)]` — list is now full-height on mobile
- `mobileView === 'detail' ? 'hidden' : 'block'` — hides list when detail is open on mobile
- `md:!block` — forces block on desktop regardless of `mobileView` state

- [ ] **Step 2: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/reading/MyReadings.tsx
git commit -m "feat(my-readings): aside is full-width on mobile list view, hidden in detail view"
```

---

### Task 4: Update `<section>` classes and add sticky back button

**Files:**
- Modify: `components/reading/MyReadings.tsx`

- [ ] **Step 1: Replace the `<section>` opening tag className**

Find:
```tsx
<section
  className="my-readings__detail flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:min-h-0 md:pl-6 lg:pl-8"
  aria-label="Selected reading"
>
```
Replace with:
```tsx
<section
  className={`my-readings__detail min-h-0 min-w-0 flex-col overflow-hidden md:!flex md:flex-1 md:pl-6 lg:pl-8 ${mobileView === 'detail' ? 'flex w-full' : 'hidden'}`}
  aria-label="Selected reading"
>
```

Key changes:
- `mobileView === 'detail' ? 'flex w-full' : 'hidden'` — section only visible on mobile when in detail view
- `md:!flex md:flex-1` — always flex on desktop regardless of `mobileView`

- [ ] **Step 2: Add the sticky back button as the first child inside `<section>`, before the `{selectedReading ? ...}` block**

Find this line immediately after the `<section ...>` opening tag:
```tsx
        {selectedReading ? (
```
Insert before it:
```tsx
        {/* Mobile-only back button — hidden on desktop where the list is always visible */}
        <div className="md:hidden sticky top-0 z-10 flex items-center pb-3 pt-1">
          <ReadingHistoryBackCta onClick={() => setMobileView('list')} />
        </div>
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/reading/MyReadings.tsx
git commit -m "feat(my-readings): section shows full-width on mobile detail view with sticky back button"
```

---

### Task 5: Update outer wrapper to support full-height mobile detail

**Files:**
- Modify: `components/reading/MyReadings.tsx`

- [ ] **Step 1: Ensure the outer `<div>` wrapper supports full-height on mobile**

Find the outermost wrapper of the main list+detail layout:
```tsx
<div className="my-readings flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden md:flex-row md:items-stretch md:gap-0">
```
Replace with:
```tsx
<div className="my-readings flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch md:gap-0">
```

Key change: removed `gap-5` on mobile (no gap needed when only one pane is visible at a time).

- [ ] **Step 2: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 3: Manual smoke test checklist**

Test on a narrow viewport (< 768px):
- [ ] Past Readings opens → list is visible, full-width, no height cap
- [ ] Tapping a card → detail view appears, back button at top-left, list is hidden
- [ ] Tapping back → list reappears, detail hidden
- [ ] Tapping same card again → detail opens instantly (selectedKey preserved)
- [ ] Tapping a different card → detail updates to new card

Test on desktop (≥ 768px):
- [ ] Both panes visible side by side as before
- [ ] Back button not visible
- [ ] Selecting a card in list updates detail pane immediately

- [ ] **Step 4: Final commit**

```bash
git add components/reading/MyReadings.tsx
git commit -m "feat(my-readings): remove mobile gap from outer wrapper for clean single-pane layout"
```
