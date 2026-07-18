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
| `app.js` | All logic — weekly engine, storage, notifications |
| `sw.js` | Service worker — offline cache + background reminders |
| `manifest.webmanifest` | Makes it installable to the home screen |
| `icon-192.png`, `icon-512.png` | App icons |

## 🌐 Hosting it

It's static files, so any static host works — **GitHub Pages**, Netlify,
Vercel, or Cloudflare Pages. For GitHub Pages: repo **Settings → Pages →**
deploy from this branch's root, then open the given URL on your phone.

## 🔒 Privacy & backups

All data lives in your browser's local storage on your device. **Setup → Export
backup** saves a JSON file; **Import backup** restores it (useful when moving to
a new phone). **Erase all data** wipes everything on the device.
