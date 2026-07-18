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
| `engine.js` | Shared budget logic (dates, bills, paydays) — used by app **and** server |
| `app.js` | Front-end logic — storage, notifications, push subscription |
| `sw.js` | Service worker — offline cache + push handler |
| `server.js` | Push server — serves the app, stores subscriptions, sends pushes |
| `manifest.webmanifest` | Makes it installable to the home screen |
| `icon-192.png`, `icon-512.png` | App icons |
| `Dockerfile`, `fly.toml` | Deploy config for Fly.io |
| `test/` | Scheduler + engine unit tests (`npm test`) |

## 🌐 Two ways to run it

**1. Static only (free, on-device reminders):** it's just static files, so
**GitHub Pages** / Netlify / Vercel / Cloudflare Pages all work. Reminders fire
while the app is open. No server, no cost.

**2. With push server (reminders even when the app is closed):** run `server.js`
somewhere always-on. It serves the app *and* sends push notifications on
schedule. See below.

---

## 🚀 Deploy the push server to Fly.io

The push server has to stay awake so it can send notifications on time. Fly.io
runs one tiny always-on machine for roughly **$2–4/month** (a card is required;
web-push itself is free).

**One-time setup**

```bash
# 1. Install the Fly CLI  (https://fly.io/docs/flyctl/install/)
curl -L https://fly.io/install.sh | sh

# 2. Sign in / sign up
fly auth signup      # or: fly auth login

# 3. From this folder, pick a unique app name and create it
fly launch --no-deploy --copy-config --name YOUR-UNIQUE-NAME
#    - Say NO to Postgres/Redis/other databases (not needed)
#    - It reuses the included fly.toml

# 4. Create the little disk that stores subscriptions + keys
fly volumes create wb_data --size 1 --region iad   # match primary_region in fly.toml

# 5. (optional) set a contact email used in push headers
fly secrets set CONTACT_EMAIL="mailto:you@example.com"

# 6. Ship it 🚀
fly deploy
```

`fly deploy` prints your live URL, e.g. `https://YOUR-UNIQUE-NAME.fly.dev`.
Open **that URL** on your phone and **Add to Home Screen** — because the app is
now served by its own server, the notification switches automatically turn on
**closed-app push**. (Update `app` and `primary_region` in `fly.toml` first if
you want a different name/region.)

> The server auto-generates its VAPID keys on first boot and stores them on the
> volume — there are no keys to copy or configure.

**Run it locally to try it**

```bash
npm install
npm start          # http://localhost:8080
npm test           # run the scheduler/engine tests
```

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
