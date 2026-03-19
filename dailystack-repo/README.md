# DailyStack

**Track habits. Crush tasks. Fill the meter every day.**

A freemium habit + task tracker with daily 100% progress meters, template presets, and cloud sync.

## Quick Start

### 1. Set up Gumroad
- Create a product at [gumroad.com](https://gumroad.com) → $4.99, enable license keys
- Copy your product permalink

### 2. Set up Firebase (free)
- Create project at [console.firebase.google.com](https://console.firebase.google.com)
- Enable **Authentication → Google sign-in**
- Enable **Cloud Firestore** (test mode, then add rules from `firebase/firestore.rules`)
- Copy your web app config

### 3. Add your keys
- Paste Firebase config into `src/firebase.js`
- Paste Gumroad URL into `src/App.js` (line 20)

### 4. Deploy to Vercel (free)
```bash
# Push to GitHub, then:
# 1. Go to vercel.com → import repo
# 2. Add env variable: GUMROAD_PRODUCT_ID = your-permalink
# 3. Deploy
```

### 5. Firestore Security Rules
Paste contents of `firebase/firestore.rules` into Firebase Console → Firestore → Rules → Publish.

## Local Development
```bash
npm install
npm start
```

## Architecture
- **Frontend**: React (static, hosted on Vercel for free)
- **Auth + DB**: Firebase Spark plan (free — 50K reads/day, 20K writes/day)
- **Payments**: Gumroad license keys ($4.99 lifetime)
- **License API**: Vercel serverless function (`/api/verify-license`)

**Total hosting cost: $0**

## Free vs Pro

| Feature | Free | Pro ($4.99) |
|---------|------|-------------|
| Today preview | ✓ | ✓ |
| All templates | ✓ | ✓ |
| Weekly calendar | — | ✓ |
| Cloud sync | — | ✓ |
| One-off tasks | — | ✓ |
| Streaks & stats | — | ✓ |
| Unlimited history | — | ✓ |
