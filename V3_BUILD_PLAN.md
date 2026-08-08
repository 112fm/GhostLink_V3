# GhostLink Mini App V3: Local Build Plan

Status: local prototype only. V2 remains the production Mini App.

## Working Rule

Integrate one user block at a time. For every block: define the contract, keep a matching mock adapter, run local scenario checks, audit changed files for stale code and conflicts, then accept the block before starting the next one.

## Current Block: Navigation and Interaction Hardening

- One overlay stack: open next screen, return with Back, return to home intentionally.
- Safe copy helper for phone numbers, keys, and invite links. Automatic copy stays the normal path; a clear fallback is shown only if the WebView denies clipboard access.
- Align all repeated button labels and remove references to removed controls.

## Source Build Workflow

V3 runtime остаётся простым для Mini App, но его исходники разделены по
экранам и вкладкам.

- HTML-исходники: `src/templates/index.template.html` и
  `src/templates/pages/*.html`.
- Runtime HTML: `index.html`, собирается через `node scripts/build-index.mjs`.
- Исходники админки: `src/templates/admin.module.template.js` и
  `src/modules/admin/*.js`.
- Runtime админка: `src/modules/admin.js`, собирается через
  `node scripts/build-admin.mjs`.
- Перед checkpoint запускать `node scripts/build-index.mjs --check` и
  `node scripts/build-admin.mjs --check`.
- Собираемые `index.html` и `src/modules/admin.js` вручную не редактировать.

## QR Block: Local Rendering

Goal: the API supplies only an invite or subscription URL; V3 renders the QR locally.

- Do not use `quickchart.io` in the V3 runtime.
- Bundle a reviewed QR renderer inside V3 instead of loading it from a third-party CDN at runtime.
- Render a canvas or SVG QR from the URL returned by the invite API.
- If local rendering fails, retain the short link and show a compact retry message. Do not send the link to an external QR service.
- Verify standard invite and Bridge invite locally before API integration.

## API Integration Order

1. User and subscription: profile, tariff, device limit, expiry.
2. Keys: list, key view, copy, app setup and device selection.
3. Payments: quote, payment request, pending, approved, rejected.
4. Referrals and Bridge: invite creation, status, locally rendered QR, tracking.
5. Admin: only after the user flows above are stable.

## Completed Local Checkpoint

The owner completed a manual local pass of the assembled V3 on 2026-08-01.
No broken user scenario or critical visual regression was reported. This
confirms only the current mock/UI stage; it does not confirm API, bot, payment,
device, or server behaviour. See
`docs/architecture-map/17_MINI_APP_V3_FINAL_LOCAL_STAGE_REPORT_2026-08-01.md`.

## Cleanup Audit: Do Not Delete Yet

- `src/styles/` was an unused duplicate style layer and was removed during
  cleanup stage 1. The active style layer is `src/css/`.
- The old FAQ/support-banner stylesheet and confirmed unused legacy selectors
  were removed during CSS cleanup stage 2. Do not remove payment, referral or
  system state styles without their owning flow review.
- `src/api/`, `src/state/`, часть `src/ui/` и `src/mocks/` остаются будущим
  scaffolding для API-этапа; собранные page templates и `src/modules/` уже
  участвуют в текущем локальном runtime через build/script order.
- `src/main.js` is the minimal V3 boot entrypoint. New page mechanics belong to
  their own module, not to `main.js`.
- Remove stale element references (`setup-selected-val`, `btnDeviceGuideBanner`, `refStatsToggleText`, `btnScanQr`) during the block that owns each screen.
- Remove old checkout CSS only after visual comparison confirms no current screen uses it.
- Keep `assets/candidates/` and the PSD as design sources until V3 design approval; do not treat them as runtime assets.
- Remove `.DS_Store` files before the first V3 handoff or release bundle.
