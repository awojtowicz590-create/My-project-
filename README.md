# 💰 Weekly Budget

A **budget tracking app for your phone** that shows a weekly rundown of money
coming in (paychecks + payments) and going out (bills), tells you what's **safe
to spend**, and tracks progress toward a **savings goal** — with **phone
notifications** on payday and before bills are due.

It's an **installable web app (PWA)**: add it to your home screen and it opens
like a real app, works **offline**, and keeps **all your data privately on your
phone** — nothing is uploaded anywhere, no account needed.

---

## 📲 How to install on your phone

1. Open the app's web address in your phone's browser (see **Hosting** below).
2. **iPhone (Safari):** tap the **Share** button → **Add to Home Screen**.
   **Android (Chrome):** tap the **⋮ menu** → **Install app / Add to Home Screen**.
3. Open it from your home screen. Go to **⚙️ Setup** and tap a notification
   switch to allow reminders.

> 💡 Notifications and offline mode only work once it's **installed to the home
> screen** — this is a browser requirement, not a limitation of the app.

---

## ✨ What it does

- **Home** — your available money, **safe-to-spend this week**, savings-goal
  progress, a timeline of this week's paydays / bills / payments, and a
  **4-week outlook** projecting your balance forward.
- **💵 Income** — your weekly paycheck plus any one-off money coming in
  (refunds, side gigs, someone paying you back).
- **🧾 Bills** — recurring bills (weekly, every 2 weeks, or monthly) with due
  days and a total monthly cost.
- **⚙️ Setup** — your balance, savings goal, amount to set aside each payday,
  paycheck amount and payday, notification switches, and backup/restore.

### 🔔 Reminders
- **Weekly summary** every payday — in / bills / safe-to-spend at a glance.
- **Bill reminder** the day before a bill is due.
- **Payday alert** when your paycheck lands.

Reminders fire while the app is open, and — on supported phones (Android/Chrome
installed PWAs) — in the background via periodic sync. A truly guaranteed
"push even when closed" notification needs an always-on server; this app stays
fully on-device by design.

---

## 🧮 How "safe to spend" is worked out

```
safe to spend this week = current balance
                        + money coming in this week (paycheck + payments)
                        − bills due this week
                        − amount you set aside for savings this week
```

The 4-week outlook rolls that forward week by week so you can see your balance
trend before it happens.

---

## 🗂 What's in here

| File | Purpose |
|------|---------|
| `index.html` | App shell, layout and styling |
| `engine.js` | Shared budget logic (dates, bills, paydays) — used everywhere |
| `app.js` | Front-end logic — storage, notifications, push registration |
| `sw.js` | Service worker — offline cache + push handler |
| `notify/` | **Free GitHub Actions push** — config, registered phones, send/register scripts |
| `.github/workflows/` | The scheduled + registration Actions |
| `server.js`, `Dockerfile`, `fly.toml` | Optional always-on server (Fly.io) — an alternative to Actions |
| `icon-192.png`, `icon-512.png` | App icons |
| `test/` | Unit tests (`npm test`) |

## 🌐 How notifications work (free, no server)

The app is hosted free on **GitHub Pages**. A **GitHub Action** runs once a day
(also free) and sends a push to your phone **on your payday** and **the day
before a bill**. It only knows *timing* — which weekday you're paid and which
day bills fall — never your balances or amounts. Those stay on your phone.

```
GitHub Pages  ──serves──▶  the app on your iPhone
                               │ (register once)
                               ▼
notify/devices.json  ◀──filed by──  register Action
        │
        ▼
notify.yml (daily cron)  ──web-push──▶  🔔 your iPhone
```

---

## 🍏 Get it on your iPhone — full walkthrough

Do steps 1–3 once on a computer, then 4–5 on your iPhone.

**1. Turn on GitHub Pages (free hosting)**
   - Repo → **Settings → Pages**.
   - Under *Build and deployment*, **Source: Deploy from a branch**.
   - Branch: **`claude/budget-tracking-app-lend88`**, folder **`/ (root)`** → **Save**.
   - Wait ~1 minute. Your app URL will be:
     **`https://awojtowicz590-create.github.io/My-project-/`**
   - *(GitHub Pages is free for **public** repos. Your money amounts never leave
     your phone, so a public repo is fine — only timing lives in the repo.)*

**2. Add the notification key (one secret)**
   - Repo → **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: **`VAPID_PRIVATE_KEY`**  ·  Value: *(the private key given to you)*.
   - *(The matching public key is already in `notify/config.json`.)*

**3. Set the send time (optional)**
   - Edit `.github/workflows/notify.yml`, line `cron: '0 13 * * *'`.
   - It's in UTC. `13` = 8am US-Eastern. Use [crontab.guru](https://crontab.guru)
     to pick ~8am in your timezone.

**4. Install the app on your iPhone**
   - Open the Pages URL from step 1 in **Safari** (must be Safari on iOS).
   - Tap the **Share** button → **Add to Home Screen** → **Add**.
   - Open **Weekly Budget** from your home screen (this is required for iOS push).

**5. Register your phone for alerts**
   - In the app go to **⚙️ Setup**, fill in your money/paycheck, add your bills.
   - Flip on **Weekly summary** (and Bill reminders / Payday alert). Allow
     notifications when iOS asks.
   - Tap **📲 Register this phone** → it opens GitHub → tap **Submit new issue**.
     A bot files your phone and closes the issue automatically. Done! 🎉

**Test it right away:** Repo → **Actions → “Send budget notifications” → Run
workflow** → tick **test** → **Run**. You should get a test push within a minute.

> Re-tap **Register this phone** whenever you change your payday or bills, so the
> Action has the latest timing. Changing balances/amounts needs no re-register.
>
> Heads-up: GitHub may delay a scheduled run by a few minutes, and it pauses
> scheduled Actions after 60 days of no repo activity (just visit the repo to
> keep it alive).

---

## 🛠️ Local development

```bash
npm install
npm test                     # run all unit tests
npm run keys                 # generate a fresh VAPID key pair if you want your own
python3 -m http.server 8000  # then open http://localhost:8000  (on-device mode)
```

<details>
<summary>Alternative: always-on server on Fly.io (~$2–4/mo)</summary>

Prefer instant sync and no per-change re-registration? Run `server.js` on Fly.io
instead of using Actions:

```bash
curl -L https://fly.io/install.sh | sh
fly auth signup
fly launch --no-deploy --copy-config --name YOUR-UNIQUE-NAME   # say NO to databases
fly volumes create wb_data --size 1 --region iad
fly deploy
```

`fly deploy` prints a `https://…fly.dev` URL. Open it on your phone and Add to
Home Screen — the app auto-detects the server and enables closed-app push with
no manual registration. The server generates its own keys on first boot.
</details>

## 🔒 Privacy & backups

All data lives in your browser's local storage on your device. **Setup → Export
backup** saves a JSON file; **Import backup** restores it (useful when moving to
a new phone). **Erase all data** wipes everything on the device.

**When using the push server:** to send reminders while the app is closed, the
server has to know *when* things happen, so it stores the minimum needed — an
anonymous random device ID, your push subscription, and your schedule (paydays,
bills, amounts). No name, email, or login. It's tied only to the random ID.
**Erase all data** also tells the server to delete your record, and an unused
subscription is dropped automatically once your browser expires it.
