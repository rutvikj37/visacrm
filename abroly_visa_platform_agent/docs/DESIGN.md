# Agency panel - design rules

Short rules so every screen looks and behaves the same. Follow the CRM screens
(Lead Inbox, Today, Case board, Client fees) as the reference.

## Colour
- One brand colour per agency (Branding settings), applied by `applyBrand()` in `src/lib/theme.ts`.
  Use `primary` classes (`bg-primary`, `text-primary`, `bg-primary-50`) or HeroUI `color="primary"`.
  Never hard-code a brand hex value.
- Red / green / amber only for meaning: overdue, rejected (danger); approved, paid (success); due soon, at risk (warning).
- Text: `text-foreground` for content, `text-default-500` for secondary text. Avoid lighter greys for anything people must read.

## Type and spacing
- One font (Quicksand) for headings and body.
- Page title: `text-2xl font-semibold` with one short line of `text-sm text-default-500` under it (hide it on phones if long).
- Section title inside a card: `font-semibold`. Cards: HeroUI `Card shadow="sm"`, gaps `gap-3` / `gap-4`.
- Corners: cards and list items `rounded-xl`, chips and pills `rounded-full`.

## Icons and words
- Icons from `lucide-react` only, 16 px in buttons, 18-20 px in headers.
- Buttons say what happens: "Add lead", "Send on WhatsApp", "Record payment" - not "Submit" / "OK".
- Sentence case everywhere ("Lead sources", not "Lead Sources").

## Loading, empty, errors
- Loading: grey placeholders from `components/ui-kit/Skeletons.tsx`, shaped like the content. Spinners only inside buttons.
- Empty: `components/ui-kit/EmptyState.tsx` - icon, one sentence, the next action. Different text when filters hide everything.
- Errors: toast with what went wrong and what to do.

## Actions
- Reversible actions (delete leads, bulk status / assign) happen at once with `undoToast()` - no "Are you sure?".
- Confirm only what can not be undone (end a subscription, delete a branch, publish to everyone).
- Lists open items in the side panel on large screens; phones get cards with the main actions (Call, WhatsApp, Open).

## Phones
- Every screen must fit 390 px without sideways scrolling. Tables: cards below `md`, or scroll inside their own card.
- The bottom bar and the round + button are shown below `md`; keep 96 px free at the bottom (`pb-24 md:pb-4` on the layout).
- Tap targets at least 36 px high.

## Access
- Show only what the person may use (role, plan add-ons, branch). The server checks again - the UI is a convenience.
