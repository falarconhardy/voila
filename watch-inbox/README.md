# Watch Inbox

Tap-to-log for the Amazfit Balance (original model). Swipe right from the watch face, tap one of six buttons, feel a buzz, and the note is appended with a timestamp to a private Google Doc. Notes made while the phone is out of reach are queued on the watch and sent later.

This is for personal use only. You install it in Zepp developer mode; it is never published to the Zepp store.

```
watch-inbox/
  receiver/     Google Apps Script that appends notes to the Doc (Code.gs, SETUP.md)
  watch-app/    Zepp OS app: watch page, shortcut card, phone-side service, settings screen
  README.md     this file
```

## How it works

1. You tap a button on the **shortcut card** (swipe right from the watch face) or inside the app.
2. The watch buzzes, saves the note to a local queue (unique id, local time with UTC offset), and shows "Sending...".
3. The phone side (running inside the Zepp app) posts the note to the receiver URL with your token.
4. The receiver checks the token, ignores ids it has already seen, appends a line, and answers `{ok:true}`.
5. Only then does the watch remove the note from its queue and show "Saved". If the receiver has not confirmed within 8 seconds, the watch shows "Queued" and keeps retrying.

A line in the Doc looks like this:

```
2026-01-15 14:30 (UTC-03:00) · Trip idea · id k3j9x0
```

## Activation: the shortcut card, not the top button

Zepp OS does not let an app reassign the watch buttons in code, and your check showed that the Balance's Settings > Preferences > Long Press Upper Button list does not offer third-party apps. So the app adds a **shortcut card** with the six buttons. Swipe right from the watch face, and the buttons are right there. Tapping one opens the app, which saves and sends the note.

You can also open **Watch Inbox** from the app list (press the top button) and tap the buttons on its main page.

## Setup, in order

Your steps are marked **YOU:**. Steps marked **verify** are menu paths I could not confirm from documentation; tell me if what you see differs.

### A. Receiver (about 15 minutes)

1. **YOU:** Follow [receiver/SETUP.md](receiver/SETUP.md): create the Doc, paste the script, set the token, deploy, and run the curl test.
2. **YOU:** Keep the web app URL and the token at hand.

### B. Developer tools on your Windows PC (about 20 minutes)

1. **YOU:** Install Node.js LTS from nodejs.org (free). Accept the defaults.
2. **YOU:** Open PowerShell and run:

   ```powershell
   npm install -g @zeppos/zeus-cli
   zeus --version
   ```

   I tested version 1.9.3. (Zeus is Zepp's own command-line tool.)
3. **YOU:** Create a Zepp developer account on the Zepp Open Platform (console.zepp.com; **verify** the address and that it is free). This needs your email and a password, so it is your step.
4. **YOU:** Run `zeus login` and sign in in the browser window it opens.
5. **YOU:** Download and install the Zepp OS Simulator for Windows (version 2.1.2, `simulator_2.1.2_window_x64`) from the Simulator Download page on docs.zepp.com. Open it, open its device download manager, and download **Amazfit Balance**.
6. **YOU:** Get this folder onto your PC (clone the repo, or download it from GitHub as a ZIP), then in PowerShell:

   ```powershell
   cd watch-inbox\watch-app
   npm install
   npm test
   ```

   `npm test` should end with `pass 31` and `fail 0`.

### C. Try it in the simulator

1. **YOU:** Open the Simulator. In its top bar, open the **"Device Simulator" download management**, download **Amazfit Balance**, select it in the model selection box, and click the **"Device Simulator" open** button. A round watch face appears.
2. **YOU:** In `watch-inbox\watch-app`, run:

   ```powershell
   zeus dev -t "Amazfit Balance"
   ```

   `-t` takes the device name as Zeus lists it, not the `balance` key from `app.json`. Without `-t`, Zeus asks you to pick from a list. Press Enter at the "simulator host" question to keep `127.0.0.1`.
3. **YOU:** In the Simulator's top bar, click the **"Settings App Simulator"** open button. The app's settings screen opens in its own window. Enter the receiver URL and token.
4. **YOU:** Run the simulator checks in [Tests](#tests).

If `zeus dev` fails with `EEXIST` or `ENOENT` under `dist` right after you save a file, its watch mode tripped over its own rebuild. Stop it (Ctrl+C), delete the `watch-app\dist` folder, and run it again.

### D. Install on your watch

1. **YOU:** On the phone, turn on Developer Mode in the Zepp app: **Profile > Settings > About**, then tap the Zepp icon 7 times until a pop-up appears.
2. **YOU:** In `watch-inbox\watch-app`, run `zeus preview -t "Amazfit Balance"` (or run `zeus preview` and pick Amazfit Balance from the list). A QR code appears in the terminal.
3. **YOU:** In the Zepp app, open the Developer Mode scanner: **Profile > your Amazfit Balance**, scroll to the bottom, **Developer Mode > Scan** (**verify**: Zepp's docs describe this path two slightly different ways). Scan the QR code. The app installs on the watch.
4. **YOU:** Open the app's settings screen in the Zepp app. It is usually under **Profile > Amazfit Balance > App list > Watch Inbox > Settings** (**verify**). Enter:
   - Receiver URL: the web app URL (ends in `/exec`)
   - Token: the same value as `TOKEN` in Script Properties
5. **YOU:** Tap **Send test note**. The status under the button should say "Test note sent at HH:MM. Check the Doc." Then delete the "Test note" line from the Doc.
6. **YOU:** Add the shortcut card on the watch: swipe right from the watch face, scroll to the bottom of the cards, tap the settings icon, tap the add icon at the bottom, and choose **Watch Inbox**. (This path is from Zepp's developer docs.)
7. **YOU:** Run the real-watch checklist in [Tests](#tests).

If `zeus preview` refuses the app id, create an app in the Zepp Open Platform console, copy the app id it gives you into the `"appId"` field in `watch-app/app.json`, and try again. (**verify**: I could not confirm whether developer-mode installs need a registered id.)

## Changing the button labels

1. **YOU:** In the Zepp app, open Watch Inbox's settings screen (as in D.4).
2. **YOU:** Edit **Button 1** to **Button 6**. Leave a field blank to use its default. Labels of about 10 characters fit best; up to 40 are stored, but long ones get cut off on the button.
3. The watch picks up the change right away if the app is open, otherwise the next time you open the app. The shortcut card refreshes the next time it comes into view after the app has opened once.

Defaults: Remind me, Trip idea, Hike done, Call back, Buy, Question.

## Reinstalling after an update

1. **YOU:** Make sure the watch says **All sent** at the top of the app, so no queued notes are at stake.
2. **YOU:** Increase `version.code` in `watch-app/app.json` by 1 (for example 1 to 2) and `version.name` to match (for example `1.0.1`).
3. **YOU:** Run `zeus preview` again and scan the new QR code, as in D.2 and D.3.
4. **YOU:** Open the settings screen and confirm the URL and token are still there. If they are not, enter them again.

If you uninstall the app from the watch, its queue and stored labels are deleted with it (Zepp's LocalStorage docs say data is cleared on uninstall).

## Tests

### Automated (runs anywhere, no watch needed)

`npm test` in `watch-app/` runs 31 tests. They load the real page, shortcut card, phone-side and settings code against stand-ins for the Zepp OS APIs, and the real `Code.gs` against stand-ins for Apps Script. They cover: one tap gives one line; notes queue with Bluetooth off or with the phone's internet down, then send in tap order; a resent note is not duplicated; a wrong token is rejected and the note waits until the token is fixed; spaces pasted into the URL or token are ignored; the 200-note cap; labels syncing to the watch and card; time-zone offsets; the settings screen; and the layout fitting the round screen.

They do not prove the app runs on the real Zepp runtime. The simulator and the watch checks below do that.

### In the simulator

1. **A tap sends one line.** Tap **Trip idea**. Expect "Sending...", then "Saved", and one new line in the Doc.
2. **Network unavailable, then back.** In the settings panel, change the receiver URL to `https://example.invalid/exec`. Tap three buttons. Expect "Queued" and "3 queued" at the top. Put the real URL back. Within about a minute, expect three lines in the Doc, in tap order, and "All sent". (Turning off your PC's Wi-Fi works too.)
3. **Duplicate id ignored.** Run the curl command from receiver/SETUP.md twice. Expect `{"ok":true,"duplicate":true}` the second time and only one line.
4. **Wrong token rejected.** Change the token in settings to `wrong`. Tap a button. Expect "Queued: check token" and nothing in the Doc. Put the right token back; the note arrives within about a minute.

#### Simulator results, 2026-10-28

Zepp OS Simulator 2.1.2 for Windows, Amazfit Balance device, Zeus CLI 1.9.3, Node 24.21.0, `npm test` 31 of 31 passing. Each result was checked against the Doc and against the watch-to-phone messages in the Simulator's log.

| Test | Result | Notes |
| --- | --- | --- |
| 1. A tap sends one line | Pass | Each tap gave one line, confirmed in about 2 s. The first tap failed with `http_404` until the URL fix below; it then sent, followed by a second tap queued behind it, in tap order. That note was sent six times and appears once. |
| 2. Network unavailable, then back | Pass | With `https://example.invalid/exec`, attempts ended in `timeout` and nothing was written. After the real URL was restored, all 7 queued notes arrived in tap order, about 2 s apart, with no duplicates. |
| 3. Duplicate id ignored | Pass | curl: `{"ok":true}`, then `{"ok":true,"duplicate":true}`, one line. A wrong token gave `{"ok":false,"error":"unauthorized"}` and no line. |
| 4. Wrong token rejected | Pass | Two attempts answered `unauthorized`, nothing written. After the token was fixed, the note and the two queued behind it arrived in order. |

Found and fixed during these runs:

- **Build error "The icon in app.json is empty or the image does not exist".** The assets folder must be named `<target key>.<screen type>`, so it is now `assets/balance.r` (was `assets/balance`). Source: the folder-structure page on docs.zepp.com shows `assets/gt.r/icon.png`, and Zepp's API 3.0 `todo-list` sample has target `gt` with `"st": "r"` and its icon in `assets/gt.r/`.
- **Every send failed with `http_404`.** The URL pasted into settings had spaces in the middle where a long line had wrapped. The phone side now removes all whitespace from the URL and token, not just at the ends.

The simulated watch's clock runs on UTC, so simulator lines show `(UTC+00:00)`. The real watch uses its own time zone.

### On the real watch (5 steps)

1. Put the phone in **airplane mode**. On the watch, swipe right from the watch face to the Watch Inbox card.
2. Tap **Remind me** on the card. The watch buzzes and the app opens. Then tap **Trip idea** and **Hike done** on the app's page, a few seconds apart. Each tap buzzes, and the top line should end at **3 queued**.
3. Turn airplane mode **off**. Wait until the phone shows the watch as connected in the Zepp app.
4. Open Watch Inbox on the watch (card tap or app list) and keep the screen on. Within about a minute the top line should read **All sent**.
5. Open the Doc. Confirm three new lines, in the order Remind me, Trip idea, Hike done, with the times you tapped and offset **(UTC-03:00)** while you are in Chile in summer.

## Known limits

- **Sending happens only while the app is open on the watch.** Zepp OS closes an app about 10 seconds after the screen turns off (Zepp's `setWakeUpRelaunch` API description). A note tapped just before the screen goes dark may stay queued until you next open the app. Opening it, or tapping any card button, sends everything queued. A background service could send without the app open, but it needs extra permissions and battery, so it is left out of this version.
- **The top button cannot open the app** (see Activation).
- **Time zone shows as an offset**, for example `(UTC-03:00)`, not a place name. The watch has no time-zone API for apps, so the app works out the offset from the watch clock.
- **The phone-side service runs inside the Zepp app.** If the phone has killed the Zepp app in the background, notes wait in the watch queue until it is running again.
- **One stuck note blocks the ones behind it.** Notes are sent strictly in order. If the receiver ever rejected a note as malformed, later notes would wait behind it. The app only creates well-formed notes, so this should not happen; a wrong token or URL also holds the queue, by design, until you fix it.
- **The token is visible** in the Zepp app's settings screen and is stored by the Zepp app on your phone.
- **Anyone with the URL can reach the receiver**, but without the token nothing is written. To rotate the token, change `TOKEN` in Script Properties and in the Zepp app settings.
- **The receiver remembers the last 500 note ids.** A note resent after 500 newer notes would be written again; with a queue capped at 200, that cannot happen in normal use.
- **Updating the receiver without changing its URL:** use Deploy > Manage deployments > Edit > New version, never New deployment. Details in [receiver/SETUP.md](receiver/SETUP.md).
- **The card is 280 px tall**, just under the 60% maximum Zepp allows. If it looks clipped on the watch, lower `CARD_H` in `watch-app/app-widget/index.js`.

## Zepp OS APIs used, with documentation pages

The docs.zepp.com website was blocked from the build environment, so I read its source repository instead ([zepp-health/zeppos-docs](https://github.com/zepp-health/zeppos-docs), commit `2b7b79e`, 2026-10-15). The pages below are the published versions of those files.

| What | API | Doc page |
| --- | --- | --- |
| Device: API level 3.7, 480 x 480 round, deviceSource 8519936/7/9 | | [Device Basic Information](https://docs.zepp.com/docs/reference/related-resources/device-list/) |
| App config (`configVersion` v3, `app-widget`, `app-side`, `setting`) | `app.json` | [Mini Program Configuration](https://docs.zepp.com/docs/reference/app-json/) |
| Shortcut card, size limits, card-to-page communication | `AppWidget`, `getAppWidgetSize`, `setAppWidgetSize` | [Register SecondaryWidget and Shortcut Cards](https://docs.zepp.com/docs/guides/framework/device/secondary-widget/), [getAppWidgetSize](https://docs.zepp.com/docs/reference/device-app-api/newAPI/ui/getAppWidgetSize/), [setAppWidgetSize](https://docs.zepp.com/docs/reference/device-app-api/newAPI/ui/setAppWidgetSize/) |
| Card tap opens the page with the label | `push` from `@zos/router` | [push](https://docs.zepp.com/docs/reference/device-app-api/newAPI/router/push/) |
| Buttons and text on the watch | `createWidget`, `widget.BUTTON`, `widget.TEXT`, `prop.MORE` | [BUTTON](https://docs.zepp.com/docs/reference/device-app-api/newAPI/ui/widget/BUTTON/), [createWidget](https://docs.zepp.com/docs/reference/device-app-api/newAPI/ui/createWidget/) |
| Buzz | `Vibrator`, `VIBRATOR_SCENE_SHORT_STRONG` | [Vibrator](https://docs.zepp.com/docs/reference/device-app-api/newAPI/sensor/Vibrator/) |
| Watch time and UTC timestamp | `Time` | [Time](https://docs.zepp.com/docs/reference/device-app-api/newAPI/sensor/Time/) |
| Queue and labels on the watch | `LocalStorage` from `@zos/storage` | [LocalStorage](https://docs.zepp.com/docs/reference/device-app-api/newAPI/storage/localStorage/) |
| Phone connection state | `connectStatus` from `@zos/ble` | [connectStatus](https://docs.zepp.com/docs/reference/device-app-api/newAPI/ble/connectStatus/) |
| Watch-to-phone messaging | ZML `BasePage`, `BaseSideService`, `request`, `call`, `onCall`, `onBleChanged` | [Overall Architecture](https://docs.zepp.com/docs/guides/architecture/arc/) (recommends ZML), [ZML on GitHub](https://github.com/zepp-health/zml) (`@zeppos/zml` 0.0.43; needs API level 3.6+) |
| HTTPS POST from the phone | `fetch({url, method, headers, body})` | [Fetch API](https://docs.zepp.com/docs/reference/side-service-api/fetch/) |
| Phone-side storage shared with the settings screen | `settingsStorage` (via ZML `settingsLib`) | [Settings Storage API](https://docs.zepp.com/docs/reference/side-service-api/settings-storage/) |
| Settings screen | `AppSettingsPage`, `View`, `Section`, `TextInput`, `Button`, `Text` | [TextInput](https://docs.zepp.com/docs/reference/app-settings-api/ui/textinput/), [Button](https://docs.zepp.com/docs/reference/app-settings-api/ui/button/), [Section](https://docs.zepp.com/docs/reference/app-settings-api/ui/section/), [Text](https://docs.zepp.com/docs/reference/app-settings-api/ui/text/) |
| Physical buttons cannot be remapped by apps | | [Physical buttons](https://docs.zepp.com/docs/designs/interaction/physical-buttons/) |
| Simulator, `zeus dev`, `zeus preview`, Developer Mode | | [Simulator Download](https://docs.zepp.com/docs/guides/tools/simulator/download/), [Zeus CLI](https://docs.zepp.com/docs/guides/tools/cli/), [Zepp App Developer Mode](https://docs.zepp.com/docs/guides/tools/zepp-app/) |
| App closes 10 s after screen off | `setWakeUpRelaunch` (description only; the app does not call it) | [setWakeUpRelaunch](https://docs.zepp.com/docs/reference/device-app-api/newAPI/display/setWakeUpRelaunch/) |
| App icon 248 x 248 | | [Icons](https://docs.zepp.com/docs/designs/visual/icons/) |
| Assets folder named `<target key>.<screen type>` (`assets/balance.r`) | | [Folder Structure](https://docs.zepp.com/docs/guides/architecture/folder-structure/), sample [todo-list](https://github.com/zepp-health/zeppos-samples/tree/main/application/3.0/todo-list) (`assets/gt.r`) |

The `app.json` layout (`platforms: [{ "st": "r", "dw": 480 }]`) and the ZML usage follow Zepp's own API 3.0 sample [todo-list](https://github.com/zepp-health/zeppos-samples/tree/main/application/3.0/todo-list).
