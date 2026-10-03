# HostOS — Turo Ops Assistant

A minimal Manifest V3 Chrome extension that identifies upcoming Turo reservations needing operational attention.

## What HostOS does

- Detects Turo reservation cards on the Booked list using real `data-testid` attributes and reservation URLs (not guessed selectors).
- Flags unverified driver's licenses on reservations picking up today or tomorrow.
- Flags reservations where the guest bought the Premier protection plan ($0 out-of-pocket, so damage cannot be billed to them), or where the overage rate for miles beyond the included allowance is under $0.20.
- Estimates what each trip coming back today is worth, and totals the day — clearly labeled as an estimate, and gross of Turo's cut (see `PROJECT_STATUS.md` for why no exact figure is obtainable).
- Queues upcoming reservations (within 72 hours) for background detail review, run from the background service worker via short-lived, unfocused background tabs — not a Turo tab you need to keep open and watch.
- Provides three clickable queues — Unverified Licenses, Profit Risk, and Earnings Estimator — in both the toolbar popup and an in-page floating widget with the same functionality (including a one-click "copy license reminder message" action).
- Emails Matt the moment a guest books the Premier protection plan ($0 out-of-pocket, so damage cannot be billed to them), plus a daily 8 AM digest of every other flagged trip. Configure under the extension's Options.
- Uses badge counts and notifications for actionable items.
- Mutation observer plus a 10-minute background alarm keep data fresh without requiring the Booked page to stay open or focused.

## Test locally

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this folder.
3. Open a Turo page, then open the HostOS extension popup or click the floating HostOS pill in the bottom-right corner of any Turo page.
4. In the Turo page console, look for `[HostOS] Scan completed`.

After loading or updating the extension, reload the extension once from `chrome://extensions` and refresh Turo's Booked page. Background detail scans happen automatically afterward — no need to keep that tab open or in focus.
