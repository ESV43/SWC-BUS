# SWC Bus Booking — Setup Guide 🚌
**Weekend night buses (Sat & Sun, Thampanoor 9 PM → IISER TVM) + event special shuttles**

Simple slip-style frontend (`index.html`) + Google Sheets + Apps Script backend (`Code.gs`). No server to maintain.

---

## 1. What you get

| Feature | How |
|---|---|
| Recurring Sat & Sun 9 PM buses | Auto-computed, no manual creation |
| Booking windows | Sat bus: Fri 5:30 PM → Sat 9:00 PM · Sun bus: Sat 5:30 PM → Sun 9:00 PM (IST) |
| ⭐ Event / extra buses, any day | Add a row in `SpecialServices` → live on site instantly, bookable right away |
| Flexible seats + names | Each special has its own name, route, time, seat count |
| Seats count only (no seat choice) | `CONFIRMED` up to capacity, rest `WAITLIST` FIFO |
| IISER-only + Google login | Frontend Google Identity Services + backend `@iisertvm.ac.in` check |
| Full → "sorry, filled" + waitlist | Automatic |
| Cancel → auto-promote #1 + realtime mail | `LockService` prevents double-booking |
| All mails from **SWC.IISER.TVM** | `GmailApp.sendEmail(..., {name:"SWC.IISER.TVM"})` |
| Disable switch | `ServiceControl.Disabled = TRUE` (weekend) or `SpecialServices.Disabled = TRUE` (event) |
| Everything in Sheets | `Bookings` + `ServiceControl` + `SpecialServices` tabs |

---

## 2. Create the Google Sheet (2 min)

1. Go to sheets.google.com → Blank spreadsheet. Name it `SWC Bus Bookings`.
2. Create three tabs exactly named: `Bookings`, `ServiceControl`, `SpecialServices`.
3. Add headers (or skip — `setupSheets()` creates them for you):

**Bookings** (row 1):
```
Booking ID | Service Date | Day | Name | Email | Phone | Status | Seat No | Waitlist Position | Created At | Updated At | Cancelled At | Notes | Service ID | Service Name
```
> Don't reorder columns. Old sheets missing `Service ID`/`Service Name` are auto-migrated on next `setupSheets()` run.

**ServiceControl** (row 1) — weekend disable switch:
```
Service Date | Day | Disabled | Disable Reason | Total Seats | Booking Opens At | Booking Closes At | Notes
```
> Service Date format: `YYYY-MM-DD`. Disabled is a checkbox TRUE/FALSE.

**SpecialServices** (row 1) — event / extra buses:
```
Service ID | Service Date | Service Name | From | To | Departure Time | Total Seats | Disabled | Disable Reason | Booking Opens At | Booking Closes At | Notes
```

---

## 3. Install backend (5 min)

1. In the Sheet: **Extensions → Apps Script**.
2. Delete default `Code.gs`, paste contents of this repo's `Code.gs`. Save.
3. Select function `setupSheets` → **Run** (grant permissions). Check your Sheet — headers appear.
4. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy → copy the `/exec` URL.
5. Paste URL into `config.js`:
```js
APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfyc.../exec",
```

To update code later: Deploy → Manage deployments → Edit → New version.

---

## 4. Enable Google Login (5 min)

1. [Google Cloud Console](https://console.cloud.google.com) → New project `SWC Bus` → **APIs & Services → OAuth consent screen** (External, add `@iisertvm.ac.in` as test user domain if needed).
2. **Credentials → Create → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://YOUR-DOMAIN` (+ `http://localhost:8000` for testing)
3. Copy Client ID into `config.js`:
```js
GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com",
```
The site verifies the signed-in email ends with `@iisertvm.ac.in`, and the backend re-validates on every booking/cancel. Spoofed emails are rejected.

---

## 5. Host the website

Any static host works — GitHub Pages / Netlify / Vercel / IISER server:
```
index.html  styles.css  app.js  config.js  SWC.png  Code.gs  SETUP.md
```
Open `index.html` — the badge in the header shows **● LIVE** once `APPS_SCRIPT_URL` is set. If it shows **⚠ SETUP NEEDED**, the URL is missing.

Test locally:
```bash
python3 -m http.server 8000
# → http://localhost:8000
```

---

## 6. Admin daily use

### A. Disable a weekend bus
In `ServiceControl`, add one row per exception:

| Service Date | Day | Disabled | Disable Reason | Total Seats |
|---|---|---|---|---|
| 2026-10-11 | Sunday | ☑ TRUE | Puja holiday – no service | 32 |
| 2026-10-17 | Saturday | ☑ TRUE | Bus under maintenance | 32 |

- No row = bus **enabled** with 32 seats.
- `Disabled = TRUE` → site instantly shows **OFF**, blocks booking API-side too, with your reason.
- To change capacity (e.g. smaller bus), set `Total Seats` to another number.

### B. ⭐ Add an event / extra bus (any day, any seats)
In `SpecialServices`, add one row per bus — it goes **live on the site immediately**:

| Service ID | Service Date | Service Name | From | To | Departure Time | Total Seats | Disabled | Disable Reason | Booking Opens At | Booking Closes At |
|---|---|---|---|---|---|---|---|---|---|---|
| ONAM-1 | 2026-10-14 | Onam Fest Shuttle | Thampanoor Bus Stand | IISER TVM | 14:30 | 20 | ☐ FALSE | | | |

Rules:
- **Booking Opens At blank = bookable the second you add the row.** Set an explicit `YYYY-MM-DD HH:MM` only if you want it to open later.
- **Booking Closes At blank = closes at departure.** Departure Time blank = 21:00. Accepts `14:30` or `2:30 PM`. Whatever closing you set is shown on the site card ("Opens … → Closes …").
- **Total Seats blank = 32.** From/To blank = Thampanoor → IISER TVM.
- **Service ID:** leave blank to auto-generate — but best to fill a short stable ID (`ONAM-1`) and never change it once bookings exist (bookings link to it).
- To pull an event bus off the site, tick `Disabled = TRUE` (+ reason). Past departures drop off automatically.
- Multiple extra buses on the same day? Just add more rows — each gets its own card, seats, waitlist, and mails.

Never delete `Bookings` rows — cancel via website so waitlist promotion + mails fire. Cancelled rows stay as `CANCELLED` for records.

### C. 🎨 Colour bookings by date (one colour per day)
Every new booking is **auto-coloured** by its Service Date (pastel yellow, mint, sky… cycling), so all bookings for one day visually group together. Dates are coloured chronologically, so colours stay stable as new weekends get added.
- Colours refresh automatically on each new booking.
- To recolour anytime (e.g. after hand-edits): open the Sheet → menu **🚌 SWC Bus → 🎨 Color bookings by date**. (Reopen the Sheet once after deploying so the menu appears.)
- Or run the `colorBookingsByDate` function directly from Extensions → Apps Script.
- To change the palette, edit the `DATE_COLORS` list at the top of `Code.gs` and redeploy.

All booking / cancellation / waitlist / promotion mails go out in real time from **SWC.IISER.TVM** with booking ID, date, route, and boarding instructions.

---

## 7. Booking windows (recurrence logic)

Computed identically in `Code.gs » bookingWindowFor()` and `app.js » windowFor()`:
- **Saturday bus** (`serviceDate` = Saturday): opens **Friday 17:30 IST**, closes **Saturday 21:00 IST** (departure).

- **Sunday bus**: opens **Saturday 17:30 IST**, closes **Sunday 21:00 IST**.
- Departure both days: **21:00 IST**, boarding by 20:45 at Thampanoor.

Change times? Edit those two functions + this doc.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `Booking is only available for @iisertvm.ac.in` | Expected — non-IISER mail blocked frontend + backend |
| Live backend unreachable | Web app must be deployed as **Anyone**, use `/exec` (not `/dev`), new version after edits |
| Mails not received | Check spam; Apps Script quota; sender is the deployer's Gmail with display name SWC.IISER.TVM |
| Double booking | `LockService` + one-active-booking-per-email-per-service guard is already in `Code.gs` |
| Wrong seat counts | Don't hand-edit `Status`/`Seat No` — use the site's Cancel so `renumberWaitlist()` runs |

Questions? Contact SWC helpdesk. Happy weekends! 🎉
