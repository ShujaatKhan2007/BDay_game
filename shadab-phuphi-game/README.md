# 🎂 Shadab Phuphi Birthday Challenge 🎉

A real-time multiplayer birthday game show for phones and laptops.
One person is the **Host** (runs the game, scores answers, reveals winners). Everyone else is a **Participant** who joins with a code or a WhatsApp link.

| Part | Technology |
| --- | --- |
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Real-time | Socket.IO (WebSockets) |
| Database | **None.** Everything lives in server memory while the game runs. |

---

## Contents

1. [How the game works](#1-how-the-game-works)
2. [Why no database is needed](#2-why-no-database-is-needed)
3. [What is stored in server memory](#3-what-is-stored-in-server-memory)
4. [⚠️ What happens if the server restarts](#4-️-what-happens-if-the-server-restarts)
5. [How many participants can it handle](#5-how-many-participants-can-it-handle)
6. [Project structure](#6-project-structure)
7. [Run it on your laptop (steps 1–6)](#7-run-it-on-your-laptop)
8. [Test everything locally](#8-test-everything-locally)
9. [Deploy to the cloud (steps 7–14)](#9-deploy-to-the-cloud)
10. [Birthday event checklist](#10-birthday-event-checklist)
11. [Editing the questions](#11-editing-the-questions-and-marks)
12. [Socket.IO events](#12-socketio-events)
13. [Security](#13-security)
14. [Disconnects and reconnecting](#14-disconnects-and-reconnecting)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. How the game works

```
Host creates game → code (e.g. PUPPY25) → shares link → participants join → Lobby
→ Round 1 Q&A → Round 2 Doodle → Round 3 Reactions → Round 4 Dialog → Round 5 One word
→ Host scores every round → Host sees leaderboard (hidden from everyone else)
→ Host reveals 🥉 → 🥈 → 🥇 → 🎉 celebration
```

**Marks:** Q&A 3 · Doodle 5 · Reaction 1 · Dialog 2 · One word 1 = **12 total.**

### Host controls, round by round

Every round has three states, controlled by the Host:

| State | What participants see | Host button |
| --- | --- | --- |
| **Waiting** | "Get ready! The Host will start this round soon" | `▶ START ROUND` |
| **Open** | The round's questions / canvas | `⏹ CLOSE ROUND` |
| **Closed** | Form locked ("The Host has closed this round") | `🔓 REOPEN ROUND` |

`◀ PREVIOUS ROUND` / `NEXT ROUND ▶` move every participant's screen instantly. After Round 5 the button becomes `FINISH ROUNDS 🏁`, and participants see *"All rounds are complete! The Host is preparing the final results…"*.

Scoring happens in the **Round 1–5 tabs** (tap a score for each person, then press that round's SAVE button). You can score while people are still answering, or after. The **🏆 Leaderboard** tab is visible to the Host only.

### Winner reveal

In the Leaderboard tab press `🥉 REVEAL 3RD PLACE`, then `🥈`, then `🥇` (they unlock in that order). Every phone shows the medal, a short drumroll (a 3‑2‑1 countdown for 1st place), then the name with confetti. Finally `🎉 SHOW BIRTHDAY CELEBRATION` puts the podium and party on every screen.

**Ties:** if players have the same total, the Host sees `⚠️ TIE DETECTED` and picks the final order with ▲▼ arrows. Winners can't be revealed until ties affecting the top 3 are resolved. The first reveal **locks** scores so the results can't change mid-ceremony.

**Play again:** `🔄 Play again` keeps the same code and players but clears answers and scores.

---

## 2. Why no database is needed

This is a **single-event game** played by a small group over one evening.

* Nobody needs accounts, history or long-term stats.
* The data (a few answers and 5–60 doodles) is tiny and only matters for a couple of hours.
* Keeping it in memory makes the app **faster, simpler and free of credentials** (no MongoDB/Firebase keys to leak or misconfigure).
* Real-time sync is easier: the server is the single source of truth and pushes updates to everyone.

A database would only add setup, cost and things to go wrong on the day.

---

## 3. What is stored in server memory

Everything is plain JavaScript objects inside `server/gameManager.js`:

```text
games (Map)
 └── "PUPPY25"
      ├── hostToken          secret "host session ID" (only the Host's browser knows it)
      ├── hostSockets        which host browser tabs are connected right now
      ├── stage              lobby | round | results | reveal | celebration
      ├── currentRound       0 (lobby) … 5
      ├── roundStatus        { 1:'pending'|'open'|'closed', … 5 }
      ├── participants (Map)
      │    └── participantId
      │         ├── name
      │         ├── token          secret, sent only to that participant
      │         ├── sockets        connected browser tabs
      │         ├── submissions    { 1:{answers}, 2:{image}, 3:{reactions}, 4:{dialog}, 5:{word} }
      │         └── scores         { 1:3, 2:4, 3:1, 4:2, 5:1 }
      ├── tieOrders          Host-chosen order for players with equal totals
      ├── revealed           { 3:false, 2:false, 1:false }
      └── finalRanking       frozen snapshot taken at the first reveal
```

Doodles are stored as PNG data URLs (roughly 20–150 KB each). Nothing is written to disk.

Games untouched for 12 hours are deleted automatically to free memory.

---

## 4. ⚠️ What happens if the server restarts

**The game is lost.** All game data disappears: codes, participants, answers, doodles, scores.

That happens if you redeploy, the process crashes, or a free hosting plan puts your app to sleep and wakes it later.

What people will see: the Host and participants get *"Game not found. The server may have restarted."* and return to the start page. Create a new game and share the new code.

**How to avoid it on the day:**
* Don't push new code during the party.
* Open the app 10–15 minutes early so free hosting is awake (see [deployment notes](#free-tier-notes-important-for-party-day)).
* Score rounds as you go (it takes a few seconds), so a crash costs you less.

---

## 5. How many participants can it handle

* The server defaults to **60 players per game** (`MAX_PARTICIPANTS` environment variable changes it).
* A small Node server can hold hundreds of Socket.IO connections; each player here adds a few kilobytes of memory plus one doodle (≈20–150 KB). Even 60 players is only a few MB of RAM, far below a free plan's limit.
* Each Host action sends one small message per player, which is trivial at this size.

**Realistic guidance:** 20–50 people is comfortable on a free instance. Beyond ~60, raise `MAX_PARTICIPANTS` and consider a paid instance. The bigger practical limit is the Host's screen: reviewing 60 doodles takes a while.

> The automated test plays a full game with 1 Host + 4 participants. The capacity figures above are estimates from the design, not a load test.

---

## 6. Project structure

```text
shadab-phuphi-game/
├── README.md
├── package.json              helper scripts (install:all, build, start)
├── render.yaml               optional one-click Render blueprint
├── .gitignore
│
├── server/                   Node.js + Express + Socket.IO
│   ├── server.js             starts Express + Socket.IO, serves the built React app
│   ├── socketHandlers.js     every Socket.IO event + who is allowed to send it
│   ├── gameManager.js        in-memory game logic (no sockets, no database)
│   ├── validation.js         checks all incoming data
│   ├── gameConfig.js         maximum marks and limits
│   └── test/integration.test.js   plays a whole game automatically (npm test)
│
└── client/                   React + Vite
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx, App.jsx
        ├── styles.css        all styling (colours are variables at the top)
        ├── config/gameContent.js   ✏️ ALL QUESTIONS AND PROMPTS
        ├── socket/           socket.js (connection) + GameContext.jsx (shared state)
        ├── pages/            Landing, JoinGame, HostLobby, HostDashboard, Player*.jsx
        ├── components/       DoodleCanvas, RoundForms, RoundEvaluation, Leaderboard, …
        └── utils/            confetti + clipboard helpers
```

---

## 7. Run it on your laptop

### Step 1: Install Node.js
Download the **LTS** version from <https://nodejs.org>, install it, then check:
```bash
node -v     # should print v18 or higher
npm -v
```

### Step 2: Create the project
Unzip the project (or clone it) and open a terminal in the `shadab-phuphi-game` folder.

### Step 3: Install dependencies
```bash
npm run install:all
```
(This runs `npm install` in `server/` and in `client/`.)

### Step 4: Run locally
Open **two terminals** in the project folder.

Terminal 1, the server:
```bash
npm run dev:server
# → 🎂 Shadab Phuphi Birthday Challenge server listening on port 3001
```
Terminal 2, the website:
```bash
npm run dev:client
# → Local:   http://localhost:5173/
# → Network: http://192.168.x.x:5173/   (use this address on phones)
```

### Step 5: Test the Host
Open **http://localhost:5173** → **CREATE GAME**. You should see a game code (e.g. `PUPPY25`) and a join link.

### Step 6: Test multiple participants
Open more **tabs or windows** (each tab is a separate player) at `http://localhost:5173`, choose **JOIN GAME**, enter a name and the code. Or paste the join link from the Host screen. Each player appears on the Host screen instantly.

**Phones on the same Wi-Fi:** open the `Network:` address from Terminal 2 (e.g. `http://192.168.1.20:5173`) on the phone. If it doesn't load, allow Node.js through your computer's firewall (Windows asks the first time). The site finds the server automatically at the same address on port 3001.

To run the automated server test: `npm test` (plays a complete game with a Host and 4 participants and checks the rules).

---

## 8. Test everything locally

Use one normal window for the **Host** and 3–4 more tabs for participants (e.g. Rahul, Aisha, Aryan).

| What to test | How | You should see |
| --- | --- | --- |
| **Host creation** | Create Game | Code + join link + Copy Link button |
| **Participant joining** | Join with name + code | Host list updates instantly, "YOU'RE IN!" on the phone |
| **Duplicate name** | Join again with "rahul" | *"This name is already being used. Please choose another name."* |
| **Multiple participants** | Join 3+ players | "Participants: 3" and 🟢 dots on Host |
| **Round changes** | Host: START GAME → START ROUND | Every participant screen changes together |
| **Q&A** | Fill 3 fields, submit | "✅ Answers submitted!"; Host sees 🟢 Submitted and the answers |
| **Duplicate submit** | Refresh the page after submitting | Still shows submitted; can't submit twice |
| **Doodle** | Draw, UNDO, CLEAR, submit | Host sees the drawing (tap to enlarge) |
| **Reactions** | Pick emojis + text, submit | Host sees emoji and text per situation |
| **Dialog** | Type a dialog, submit | Host sees the quote |
| **One word** | Type "Super mom" | Space is removed; only one word can be sent |
| **Host scoring** | Tap scores, press SAVE | "Round N scores saved ✅" and round tab gets ✅ |
| **Total score** | Leaderboard tab | Total = sum of all five rounds, max 12 |
| **Hidden leaderboard** | Look at a participant screen after Round 5 | "All rounds are complete! The Host is preparing the final results…" only |
| **Tie** | Give two players identical scores in every round | ⚠️ TIE DETECTED; reveal buttons say "Resolve the tie first"; order them with ▲▼, then USE THIS ORDER |
| **Winner reveal** | Press 🥉, then 🥈, then 🥇 | Each phone animates the medal, then the name, with confetti |
| **Celebration** | SHOW BIRTHDAY CELEBRATION | Podium + confetti on every phone |
| **Host disconnect** | Close the Host tab | Participants see *"The Host has temporarily disconnected. Please wait..."* |
| **Host reconnect** | Reopen the site → "↩ Resume hosting game" | Whole game state is back |
| **Server restart** | Stop and start the server | Everyone gets "Game not found…" (expected, see section 4) |

> **Tip:** confetti is turned off automatically on phones with "Reduce motion" enabled. That's an accessibility setting, not a bug.

---

## 9. Deploy to the cloud

### Which host?
Socket.IO needs a server that keeps connections open. **Do not** put the backend on a static/serverless host (GitHub Pages, Netlify, or Vercel functions): they can't hold WebSocket connections open.

This guide uses **Render** (free web service, supports WebSockets, deploys straight from GitHub). Railway, Fly.io and Koyeb also work with the same code; you just need any host that runs a long-lived Node process.

**Simplest setup (recommended): ONE Render service** runs the Node server *and* serves the React app. No CORS, no second deployment, no URL configuration.

### Step 7: Create a GitHub repository
1. Create a free account at <https://github.com>, click **New repository**, name it `shadab-phuphi-game` (private is fine), and don't add any files.
2. In your project folder:
```bash
git init
git add .
git commit -m "Shadab Phuphi Birthday Challenge"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/shadab-phuphi-game.git
git push -u origin main
```

### Step 8: Deploy the server (Render)
1. Sign up at <https://render.com> with GitHub.
2. **New → Web Service** → pick your `shadab-phuphi-game` repo.
3. Use these settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Instance Type | Free |
| Health Check Path | `/health` |
| Environment variable | `NODE_VERSION` = `22` |

4. Click **Create Web Service** and wait for "Your service is live".

*(Shortcut: **New → Blueprint** reads `render.yaml` and fills this in for you.)*

### Step 9: Deploy the frontend
With the simplest setup **you are already done**: the build command compiled the React app and the Node server serves it from the same address.

<details>
<summary><strong>Optional: host the frontend separately (Vercel or Netlify)</strong></summary>

Only do this if you specifically want the website on Vercel/Netlify while the server stays on Render.

1. Push the same repo, then on Vercel choose **Add New → Project**, import the repo, set **Root Directory** to `client`, framework **Vite**. (`client/vercel.json` and `client/public/_redirects` already make `/join/CODE` links work.)
2. Add the environment variable from Step 10 *before* deploying.
3. Deploy and copy the resulting `https://….vercel.app` address.
</details>

### Step 10: Point the frontend at the backend
* **Simplest setup:** nothing to do. The site talks to the server it was loaded from.
* **Separate frontend (Vercel/Netlify):** add this environment variable in the frontend project and redeploy:
  ```
  VITE_SERVER_URL = https://your-app.onrender.com
  ```
  (no trailing slash; it is baked in at build time, so redeploy after changing it.)

### Step 11: Configure CORS
* **Simplest setup:** not needed (same address).
* **Separate frontend:** in Render → your service → **Environment**, add:
  ```
  CLIENT_ORIGIN = https://your-frontend.vercel.app
  ```
  Several allowed sites can be listed with commas. Save; Render restarts the server.

### Step 12: Test the WebSocket connection
1. Visit `https://your-app.onrender.com/health`. You should see `{"ok":true,"games":0,…}`.
2. Open `https://your-app.onrender.com`, press **CREATE GAME**.
3. Open browser DevTools → **Network** → **WS**. You should see a connection with status **101 Switching Protocols**.
4. Open the join link on a phone using mobile data (not your Wi-Fi). If the Host's participant list updates instantly, everything works end to end.

### Step 13: Get your final public URL
It is shown at the top of the Render dashboard: `https://shadab-phuphi-game.onrender.com` (yours will differ). That is the address to bookmark.

### Step 14: Create and share the participant link
1. Open your public URL → **CREATE GAME**.
2. Press **📋 COPY LINK** (or **💬 WHATSAPP** to open WhatsApp with the message pre-written).
3. Share it. The link looks like `https://your-app.onrender.com/join/PUPPY25` and pre-fills the game code, so people only type their name.

### Free tier notes (important for party day)
* **Sleeping:** Render's free web services spin down after about 15 minutes with no incoming HTTP requests or WebSocket messages, and the first visit afterwards can take up to a minute. Since the game lives in memory, a sleeping/restarted server means a lost game.
* **Before the party:** open your site ~15 minutes early, create the game, and test it. During the game the constant activity keeps the service awake.
* **Optional safety net:** a free uptime monitor (e.g. UptimeRobot) that requests `/health` every 5 minutes on party day prevents accidental sleep. Turn it off afterwards if you like.
* **Extra peace of mind:** if this party really matters, switch the service to a paid instance for the day (check Render's current pricing); paid instances don't sleep.
* Free hosting terms change over time; check your provider's current documentation.

---

## 10. Birthday event checklist

☐ Server running (open `/health` and see `{"ok":true}`)

☐ Host creates game

☐ Game code generated

☐ Share link copied (📋 COPY LINK)

☐ Participants can join (try at least one phone)

☐ All phones connected (Host sees 🟢 next to everyone)

☐ Round 1 tested

☐ Doodle tested on a phone (draw with a finger, undo, clear, submit)

☐ Round 3 tested

☐ Round 4 tested

☐ Round 5 tested

☐ Host scoring tested

☐ Leaderboard checked (and confirmed hidden on a participant phone)

☐ Winner reveal tested (🥉 🥈 🥇 and celebration)

☐ Confetti tested (phones with "Reduce motion" turned on won't show it)

☐ Internet connection checked (Host laptop + venue Wi-Fi/mobile data)

Then press **🔄 Play again** to wipe the test answers, or simply create a fresh game for the real event.

---

## 11. Editing the questions and marks

* **Questions, prompts, emojis, button labels:** `client/src/config/gameContent.js`
  Keep the *number* of items (3 questions in Round 1, 3 situations in Round 3), because the server expects exactly that many answers.
* **Maximum marks per round:** `server/gameConfig.js` (`MAX_SCORES`). Host screens and the leaderboard adapt automatically.
* **Colours:** the variables at the top of `client/src/styles.css`.
* **Game code words:** `CODE_WORDS` in `server/gameManager.js`.

---

## 12. Socket.IO events

**Client → server** (every one is checked for the sender's role and the data is validated):

| Event | Who | Purpose |
| --- | --- | --- |
| `create_game` | anyone | Creates a game; returns the code and secret host token |
| `rejoin_host` | Host | Restores the Host session using the secret token |
| `join_game` | participant | Joins with name + code (rejects duplicate names) |
| `rejoin_participant` | participant | Restores a participant using their secret token |
| `start_game` | Host only | Lobby → Round 1 |
| `change_round` | Host only | `{direction:'next'|'prev'}` |
| `start_round` / `close_round` | Host only | Open or lock submissions for the live round |
| `submit_answer` | participant | Round 1 answers |
| `submit_doodle` | participant | Round 2 image (PNG data URL) |
| `submit_reaction` | participant | Round 3 emoji + text |
| `submit_dialog` | participant | Round 4 dialog |
| `submit_one_word` | participant | Round 5 word |
| `save_scores` | Host only | `{round, scores:{participantId:number}}` |
| `set_tie_order` | Host only | Final order for players with equal totals |
| `reveal_3rd` / `reveal_2nd` / `reveal_1st` | Host only | Winner reveal (enforced order) |
| `show_celebration` | Host only | Final party screen |
| `reset_game` | Host only | Play again |

**Server → client:**

| Event | Sent to | Purpose |
| --- | --- | --- |
| `game_state` | everyone | The current game, with a **different view for Host and participants** (this carries round changes, `participant_joined` counts, `leaderboard` ranking for the Host, and reveal results for participants) |
| `participant_joined` | Host | "Rahul joined 🎉" toast |
| `submission_received` | Host | The actual answer/doodle content |
| `host_submissions` | Host | Full copy of submissions after (re)connecting |
| `score_updated` | Host | Confirms a save |
| `game_reset` | everyone | Play again happened |

Design choice: instead of many tiny events that could drift out of sync, the server re-sends each person's complete view after every change. Screens can never disagree with the server, and reconnecting is automatic.

---

## 13. Security

Without a database there's still real protection:

* The Host is identified by a **random secret token** (`crypto.randomBytes`) that never leaves the Host's browser. Knowing the game code does **not** grant Host powers.
* Every participant gets a unique ID and a secret token.
* **Host-only actions** (start, change rounds, score, ties, reveal, reset) are rejected unless the socket is an authenticated Host.
* Participants can't send scores, and the server checks marks are whole numbers within the round's maximum.
* All incoming data is validated: name length, exactly 3 answers, image type/size, one word, and so on.
* Participants **never receive** scores, other players' answers, or the ranking. Even reveal data contains only places the Host has already revealed.
* Doodles must be real `data:image/png|jpeg;base64` strings; React escapes all text, so names and answers can't inject HTML.
* The first reveal freezes results, so scores can't change mid-ceremony.

This is designed for a friendly private party, not for hostile public traffic. There's no rate limiting. If you post the link publicly, anyone who has it can join.

---

## 14. Disconnects and reconnecting

* **Host disconnects:** the game is *not* destroyed. Participants see *"The Host has temporarily disconnected. Please wait..."*. When the Host's browser comes back (refresh, Wi-Fi drop, phone lock) it re-authenticates automatically and gets the full state and all submissions back.
* **Participant disconnects:** their record, answers and scores are kept. The Host sees ⚪ *(offline)*. Refreshing or losing signal reconnects automatically.

Limitations to be aware of:

* Sessions are stored **per browser tab** (`sessionStorage`), so testing with many tabs works. If a participant closes the tab and comes back later, they simply join again **with the same name**. While that person is offline, the server lets that name reconnect to their old record. (If they're still online, the name is refused as a duplicate.)
* That means a friend could type an *offline* player's name and take over their seat. Fine for family; note it if you host strangers.
* The Host's secret token is remembered in the browser (`localStorage`). If the Host closes the tab, opening the site again on the **same browser** shows **↩ Resume hosting game**. If the Host switches to a different device or clears browser data, that game can't be resumed (the game code alone isn't enough, by design).
* Reconnecting only works while the server is still running (see section 4).

---

## 15. Troubleshooting

| Problem | Fix |
| --- | --- |
| Phone can't open `http://192.168…:5173` | Same Wi-Fi? Firewall allowing Node.js? Guest Wi-Fi networks often isolate devices, so try a different network or your phone's hotspot. |
| "Connecting to the server…" never ends locally | Is Terminal 1 (`npm run dev:server`) running? Port 3001 free? |
| On Render, first load is very slow | The free instance was asleep; wait up to a minute. |
| Separate frontend shows CORS error in the console | `CLIENT_ORIGIN` must exactly equal the frontend address (https, no trailing slash). |
| Separate frontend connects to the wrong place | `VITE_SERVER_URL` was missing at build time. Set it and redeploy the frontend. |
| Copy Link doesn't copy | Some browsers block clipboard on plain `http`. Long-press the link box to copy, or use the WhatsApp button. |
| No confetti | Confetti is skipped when the device has "Reduce motion" enabled. |
| "Game not found" during the party | The server restarted or slept (see section 4). Create a new game. |
| `npm audit` reports issues in `client` | They concern the Vite dev server (`npm run dev`), not the production build. Only run the dev server on networks you trust. |

Have a wonderful birthday party! 🎂❤️
