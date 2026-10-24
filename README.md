# Kitchen Table

Party games for friends and family. Play pass-and-play on one device, or host a game and have everyone join from their own phone with a 4-letter code.

Games so far: Rare Words, Dots & Boxes, Tic Tac Toe (Classic and Ultimate), Four in a Row, Checkers, Reversi, Mancala.

No build step. It's plain HTML, CSS, and JavaScript modules, hosted on Netlify, with Firebase Realtime Database holding the live game rooms.

---

## 1. Set up Firebase (about 5 minutes, free)

1. Go to https://console.firebase.google.com, sign in with your **personal** Google account, and click **Create a project**. Name it something like `kitchen-table`. You can turn Google Analytics off.
2. In the left menu, open **Build → Realtime Database** and click **Create Database**. Pick a US location and choose **Start in locked mode**.
3. Set the database rules. Rules are Firebase's access settings: they decide who can read and write your data. Locked mode blocks everything, so online games won't work until you change them.
   - Still on the Realtime Database page, click the **Rules** tab. It's along the top, next to **Data**.
   - You'll see a small editor with a few lines of text like `".read": false`. Click inside it, select all of it (Ctrl+A or Cmd+A), and delete it.
   - Paste in exactly this (the same text as `database.rules.json` in this folder):

     ```json
     {
       "rules": {
         ".read": false,
         ".write": false,
         "rooms": {
           "$code": {
             ".read": true,
             ".write": true,
             ".validate": "$code.matches(/^[A-Z]{4}$/)"
           }
         }
       }
     }
     ```

   - Click **Publish** above the editor. If Firebase shows a warning that your rules are public, that's expected. You can dismiss it.

   What these rules do: everything in the database stays locked, except a folder called `rooms`. Inside it, anyone using the site can read and write a game room, but only if the room's name is exactly four capital letters, like `ABCD`. That's what lets friends join a game without signing in, while keeping anything else out of your database.
4. Click the gear icon (**Project settings**). Under **Your apps**, click the web icon `</>`, give it a nickname, and register it. You don't need Firebase Hosting.
5. Copy the `firebaseConfig` object it shows you into `js/firebase-config.js`, replacing `null`:

   ```js
   export const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     databaseURL: "https://....firebaseio.com",
     projectId: "...",
     appId: "..."
   };
   ```

   If `databaseURL` is missing, copy it from the top of the Realtime Database page. Online play needs it.

The `apiKey` is safe to commit. Firebase web keys are meant to be public; the database rules are what control access.

Until this file has a config, the site still works for pass-and-play, and online play shows a "not set up yet" message.

## 2. Put it on your personal GitHub

If your browser is signed in to your work GitHub, use a different browser profile (or a private window) so this lands on your personal account.

1. Create a new repository, for example `kitchen-table`.
2. Either drag all the files from this folder onto the repo's **upload files** page, or use git:

   ```sh
   cd kitchen-table
   git init
   git add .
   git commit -m "Kitchen Table: first games"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/kitchen-table.git
   git push -u origin main
   ```

## 3. Deploy on Netlify

1. In Netlify, choose **Add new site → Import an existing project → GitHub** and connect your personal GitHub account.
2. Pick the `kitchen-table` repo.
3. Leave **Build command** empty and set **Publish directory** to `.` (`netlify.toml` already says this).
4. Click **Deploy**. Then use **Site configuration → Change site name** to get a nicer address like `kitchen-table-parker.netlify.app`.

From then on, every push to `main` redeploys automatically.

## Playing

- **Pass and play:** pick a game, choose Pass and play, enter names, start.
- **Online:** pick a game, choose Play online, enter your name, and create a game. Share the code, or tap **Share link** to send a link that opens straight to the join screen.
- Anyone can refresh, lock their phone, or drop off and come back to the same seat. The game lives in the database, not on the host's phone.
- From the lobby, the host can switch games, so one code can last a whole game night. If the host leaves, the next person in the room takes over.

## Trying it locally

JavaScript modules need a local web server (opening `index.html` directly won't work):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Rare Words

Everyone gets the same seven letters and plays at the same time. Words only you found score 3 points per letter, words two people found score 1 per letter, and words three or more people found score nothing. Using all seven letters adds 10.

The dictionary is `data/words.txt`: about 51,600 English words of 3 to 7 letters, from the public-domain ENABLE word list with offensive words removed. To allow or block a word, add or delete its line. The round letters come from common 7-letter words in `js/games/rarewords-seeds.js`, so there's always at least one seven-letter answer.

## Chat and reactions

Online rooms have a chat button and a reactions button in the bottom corner. Chat carries across every game in the room and disappears when the room expires (only the latest 60 messages are kept). Quick reactions float up on everyone's screen. Swear words are masked using the list in `js/badwords.js` (add or remove entries as you like), and chat pauses during Rare Words rounds so nobody gives away a word. Pass-and-play games don't show chat, since everyone's on the same device.

## Adding a game

Each game is one file in `js/games/`. The comment at the top of `js/games/index.js` describes what a game module provides: setup, legal moves, win check, and how to draw it. Create the file, add it to the list in `index.js`, and optionally add card art in the `ART` object in `js/app.js`. Pass-and-play and online both work automatically.

## Housekeeping

- Codes expire after 24 hours and can be reused after that. Old rooms are tiny, but you can delete the `rooms` node in the Firebase console any time to clear them.
- Firebase's free plan allows 100 people connected at once, which is plenty for family game nights.
- The database rules let anyone with the site read and write game rooms. That's fine for a friends-and-family app; tighten it later if you ever make the site public.
