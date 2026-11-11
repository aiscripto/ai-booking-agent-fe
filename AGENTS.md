# AGENTS.md — Frontend Engineering Rules

Canonical instruction file for **any** LLM coding agent (Claude Code, Cursor, Copilot,
Codex, Windsurf, Aider, Gemini CLI, …) working in this repository.

`CLAUDE.md`, `.cursor/rules/`, and `.github/copilot-instructions.md` all point here.
**This file is the single source of truth.** If a tool-specific file disagrees, this wins.

---

## 0. What this app is

`voice-agent-frontend` is the **provider dashboard and public booking surface** for a
multi-tenant AI booking platform. Two distinct audiences share one bundle:

| Audience | Surface | Character |
| :-- | :-- | :-- |
| **Staff** (front desk, providers) | Dashboard, calendar, status board, call logs, analytics, doctor directory | Dense, keyboard-friendly, glanceable during a phone call |
| **Public** (patients/clients) | `PublicBookingPage`, `BookingWidget` | Calm, minimal, white-labelled per tenant |

The staff surface is watched **while a receptionist is on the phone**. Information density
and glanceability beat decoration. The public surface is the tenant's brand, not ours.

Stack: React 19 · Vite 8 · TypeScript · Tailwind CSS v4 · lucide-react · oxlint.

---

## 1. Non-negotiable rules

Hard gates. Each maps to an automated check in `scripts/verify.sh`.

| # | Rule | Enforced by |
| :-- | :-- | :-- |
| R1 | Hooks are called unconditionally, at the top level, in a stable order. | `oxlint` (error) |
| R2 | No `any`. No `@ts-ignore`/`@ts-expect-error` without an adjacent justification. | `guards/no-any.sh` |
| R3 | No hardcoded URLs, tenant IDs, or secrets. Config comes from `import.meta.env`. | `guards/no-hardcoded-config.sh` |
| R4 | Every async UI path renders all four states: loading, empty, error, success. | `guards/ui-states.sh` + review |
| R5 | All network access goes through `src/services/api.ts`. No inline `fetch` in components. | `guards/api-boundary.sh` |
| R6 | Interactive elements are real semantic elements, keyboard-reachable and labelled. | `guards/a11y.sh` + review |
| R7 | `npx tsc -b` passes with zero errors. | `verify.sh` |
| R8 | `npx oxlint` reports zero **errors** (currently ratcheted at 2 — see §8). | `verify.sh` |
| R9 | **No fake data and no fake controls.** Every number, text, list and control on a screen is real and wired. | review only (cannot be automated) |

**R9 in plain words (owner rule, 2026-11-04 and 2026-11-11):**
- Show real data from the API, or an honest state: "No data yet" or "Could not load" with a retry. Never a made-up
  number, name, time, slot, summary or success message. A failed call is shown as failed.
- A control exists only if it does something real. No search box, filter, toggle, button, badge-that-looks-like-a-button
  or "live" light that is not wired to real behavior. If a reference design has one, copy the **layout only**, leave the
  control out, and offer to build it for real.
- Placeholder text in a field is neutral ("Search…", "Name"). It never looks like real data (no invented names, phone
  numbers, addresses).
- Static labels are fine when they are true (for example a section name). They must not imply a state the system does
  not know.
- Before finishing, search the change for hardcoded sample values, mock branches and controls with no handler.

R1–R6 and R8 carry a **baseline ratchet** (§8): existing violations are recorded and
tolerated, but the count must never increase. R7 is a hard zero.

---

## 2. Architecture — where code goes

```
src/
  App.tsx          Auth gate + tab router. The only place tab state lives.
  components/      Reusable, presentational. Props in, callbacks out.
  pages/           One per tab. Owns its own data fetching and view state.
  services/        api.ts (all network I/O) · vocabulary.ts (industry labels)
  assets/          Static images
```

**There is no react-router.** Navigation is `activeTab` state in `App.tsx` switching on a
string. Do not introduce a router as a side effect of another change — that is its own
task with its own review. If you need a new tab: add it to `App.tsx`, `Layout.tsx`'s nav
list, and create the page.

**Components vs pages:**
- A `component/` never fetches. It receives data and callbacks via props. This keeps it
  testable and reusable across pages.
- A `page/` fetches, owns loading/error state, and composes components.

If a component needs server data, the page fetches it and passes it down.

---

## 3. Data fetching and the API boundary

**All** network access lives in `src/services/api.ts`. Components and pages import `api`
and call its methods. No `fetch()` inside a `.tsx` file — it defeats consistent auth
headers, error shaping, and any future retry/caching layer.

The backend's response envelope is `{ status, data, message }`. `api.ts` unwraps it and
throws on `status === 'error'`, so callers only handle resolved data or a thrown `Error`.
Preserve that contract when adding methods.

```ts
// in a page
const [items, setItems] = useState<Appointment[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;               // guard against unmount races
  (async () => {
    try {
      const data = await api.getAppointments(date);
      if (!cancelled) setItems(data);
    } catch (e) {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();
  return () => { cancelled = true; };
}, [date]);
```

Always cancel or guard on unmount. Tab switching unmounts pages mid-flight, and a
`setState` after unmount is a real bug in this app's navigation model.

### ⚠️ Config debt — fix on contact

`src/services/api.ts` currently **hardcodes** `http://localhost:5000/api/v1` and a fallback
tenant UUID. That means the production build points at localhost, and a signed-out user
silently reads a hardcoded tenant's data.

When you touch `api.ts`, move both to `import.meta.env` (`VITE_API_BASE_URL`,
and no tenant fallback at all — a missing tenant is an error state, not a default).
Do not add new hardcoded URLs or IDs.

---

## 4. React 19 correctness

**Hooks (R1) — the rule that has already broken this codebase.** Every hook call must run
on every render, in the same order. An early `return` before a hook is a crash the moment
the component re-renders down the other branch:

```tsx
// ❌ crashes with "Rendered fewer hooks than expected" when `booking` becomes null
if (!booking) return null;
const [notes, setNotes] = useState('');

// ✅ hooks first, branch after
const [notes, setNotes] = useState('');
if (!booking) return null;
```

`oxlint` catches this as an **error** (`react-hooks/rules-of-hooks`). Never suppress it.

Other required practices:
- Effects declare **complete** dependency arrays. If that causes a loop, the fix is
  `useCallback`/`useMemo` or moving state — not deleting the dependency.
- Clean up every subscription, interval, and `setTimeout` in the effect's return.
- Lists use a **stable domain id** as `key`, never the array index.
- Derive during render instead of mirroring props into state with an effect.
- Never mutate state; produce new objects/arrays.

---

## 5. The four UI states (R4)

Anything that awaits the network renders all four. A component that only handles the happy
path is incomplete work, not a first pass.

| State | Requirement |
| :-- | :-- |
| **Loading** | A skeleton or spinner. Never a blank panel — reads as broken. |
| **Empty** | Explain what would appear here and the action that fills it. Never a bare "No data". |
| **Error** | The failure in plain language **plus a retry affordance**. Never a silent `catch`. |
| **Success** | The data. |

Never `catch (e) {}` or `catch (e) { console.log(e) }` in a component. If the user's action
failed, the user must be told.

---

## 6. Styling and multi-tenant vocabulary

- **Tailwind v4** via `@tailwindcss/vite`. Utilities in JSX; no CSS modules, no styled
  components, no inline `style` except genuinely computed values (a chart bar width).
- Follow the existing dark palette (`slate-950/900/800` surfaces, `sky-400` accent). Match
  neighbouring components rather than introducing a new scale.
- Icons: **lucide-react** only. Match the surrounding size (`h-4 w-4` inline, `h-5 w-5`
  headers). Decorative icons get `aria-hidden`.
- Responsive by default: mobile-first utilities, and no horizontal page scroll. Wide tables
  scroll inside their own `overflow-x-auto` container.

**Vocabulary (multi-industry):** never hardcode "Doctor" or "Patient". The same UI serves
healthcare, salons, law firms, real estate, automotive and fitness. Pull labels from
`src/services/vocabulary.ts` keyed off the tenant's industry — `resourceLabel`,
`customerLabel`, `serviceLabel`, `statusInProgress`. A hardcoded domain noun is a bug.

**White-labelling:** the public booking surface must render the tenant's branding from the
API, never our own. No platform branding on a tenant's public page.

---

## 7. Accessibility (R6)

Front-desk staff use this at speed, often keyboard-only, while talking.

- Clickable things are `<button>`; navigation is `<a>`. Never a `<div onClick>` — it is
  invisible to keyboard and screen readers.
- Every input has a real `<label>` (or `aria-label`). Placeholders are not labels.
- Visible focus states — never remove the ring without replacing it.
- Icon-only buttons carry an `aria-label`.
- Modals and drawers: focus moves in, `Escape` closes, focus returns on close.
- Colour is never the sole carrier of meaning — booking status needs text or an icon too,
  not just a coloured dot.
- Body text meets WCAG AA contrast (4.5:1). On `slate-900`, `slate-400` is the practical
  floor for small text.

---

## 8. The baseline ratchet

Gates R2–R6 have real pre-existing violations. Hard-failing would leave the gate
permanently red, and a red gate gets ignored. So each guard compares against
`scripts/baseline.json`:

```
count > baseline  → FAIL  (you added a violation — fix your change)
count < baseline  → PASS  + prompt to lower the baseline (debt paid, thank you)
count = baseline  → PASS
```

**You may lower a baseline. You may never raise one.** Raising a baseline to turn
`verify.sh` green silently converts a caught bug into permanent debt. If a gate fails, fix
the code.

Current debt is itemised in `docs/DEFINITION_OF_DONE.md § Known debt`.

---

## 9. Testing

There is **no test framework installed yet**. Until one is:
- Verification is `npx tsc -b`, `npx oxlint`, `npm run build`, and a **manual pass through
  the four UI states** of anything you touched.
- State plainly in your summary which flows you exercised and which you could not.
- Do not claim a UI works if you only typechecked it.

When a framework is added it will be **Vitest + React Testing Library**. Write tests that
assert what the user sees and does — visible text, roles, keyboard interaction — never
component internals or implementation details.

---

## 10. Commands

```bash
npm run dev        # vite dev server — DO NOT run this yourself (see §11)
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npx tsc -b         # typecheck only

npm run verify     # ← the DoD gate. Run before claiming done.
```

---

## 11. Operational constraints

- **Do not start servers.** The user runs `npm run dev` in their own terminal. Do not
  launch, restart, or background the dev server or preview unless explicitly asked.
- **Do not touch the backend from this repo.** `voice-agent-frontend` and
  `voice-agent-backend` are separate git repositories with separate remotes. Never import
  across them or duplicate backend logic client-side.
- **Never trust the client with authorisation.** Hiding a button is presentation, not
  security. The backend enforces access; the UI only reflects it.
- **Do not commit or push unless asked.** When asked: confirm `.env` is ignored, review
  `git status` before staging, never force-push.
- `.env` is gitignored and stays so. Every `VITE_*` key you introduce gets a placeholder in
  `.env.example` in the same change. Remember `VITE_*` vars are **public** — they ship in
  the bundle. Never put a secret in one.

---

## 12. Definition of Done

A task is done only when `docs/DEFINITION_OF_DONE.md` is satisfied and `npm run verify`
exits 0. **Do not report a task complete without having run it.** If you could not run it,
say so explicitly and say why.
