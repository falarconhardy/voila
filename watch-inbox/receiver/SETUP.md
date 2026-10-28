# Receiver setup (Google Apps Script)

The receiver is a small script bound to a Google Doc. The watch app's phone side posts each note to it, and it appends one line to the Doc.

Time needed: about 15 minutes. Cost: none (a normal Google account).

Menu names below come from Google's current Apps Script editor as I know it. I could not open Google's documentation from the build environment, so where a label might differ slightly, it says **verify**.

## 1. Create the Doc

1. YOU: In Google Docs, create a blank document named **Watch Inbox**.
2. YOU: Leave it empty. Notes are appended at the end.

## 2. Add the script

1. YOU: In the Doc, open **Extensions > Apps Script**. A new tab opens with a file named `Code.gs`.
2. YOU: Delete what is in `Code.gs` and paste the full contents of `receiver/Code.gs` from this repo.
3. YOU: Click the save icon. Optionally rename the project (top left, "Untitled project") to **Watch Inbox receiver**.

## 3. Set the token

The token is a shared secret. It lives in Script Properties and in the Zepp app settings, never in code.

1. YOU: Make a random token. On Windows, open PowerShell and run:

   ```powershell
   [guid]::NewGuid().ToString("N")
   ```

   Copy the 32-character result. Keep it somewhere private, such as your password manager.
2. YOU: In the Apps Script tab, click **Project Settings** (gear icon on the left).
3. YOU: Scroll to **Script Properties**, click **Add script property** (**verify** the label), and enter:
   - Property: `TOKEN`
   - Value: the token you just made
4. YOU: Click **Save script properties**.

## 4. Deploy as a web app

1. YOU: Click **Deploy > New deployment**.
2. YOU: Next to "Select type", click the gear icon and choose **Web app**.
3. YOU: Fill in:
   - Description: `Watch Inbox v1`
   - Execute as: **Me** (your address)
   - Who has access: **Anyone**. This is the option that allows a request with no Google sign-in, which the Zepp app needs. The options "Anyone with Google account" and "Only myself" will not work. (**verify** the wording: Google's API calls this setting `ANYONE_ANONYMOUS`.)
4. YOU: Click **Deploy**.
5. YOU: Google asks you to authorize. Click **Authorize access**, choose your account, then on "Google hasn't verified this app" click **Advanced > Go to Watch Inbox receiver (unsafe)** and **Allow**. This warning appears for every personal script that has not been through Google's review. The `@OnlyCurrentDoc` line at the top of the script limits it to this one Doc. **verify** that the permission screen asks about "the current document" only, not all your Docs.
6. YOU: Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/.../exec`. You will paste it into the Zepp app.

"Anyone" means anyone who has the URL can send it a request. Without the token, every request is rejected and nothing is written.

## 5. Test with curl (Windows)

Windows 10 and 11 include `curl.exe`. Make a file named `note.json` (for example in Notepad) with this content, using your real token:

```json
{"token":"PASTE_TOKEN","id":"curltest-0001","ts":"2026-01-15T14:30:00-03:00","label":"Curl test"}
```

Then in PowerShell or Command Prompt, in the folder where you saved `note.json`:

```
curl.exe -L -H "Content-Type: application/json" --data @note.json "PASTE_WEB_APP_URL"
```

Expected results:

| Run | Response | Doc |
| --- | --- | --- |
| First time | `{"ok":true}` | New line: `2026-01-15 14:30 (UTC-03:00) · Curl test · id curlte` |
| Same command again | `{"ok":true,"duplicate":true}` | No new line |
| Change the token in `note.json` | `{"ok":false,"error":"unauthorized"}` | No new line |

`-L` matters. Apps Script answers a POST with a redirect to the actual response. Without `-L` you see an HTML "Moved Temporarily" page, even though the note was written.

Delete the test line from the Doc when done.

## Updating the script later without changing the URL

1. YOU: Paste the new `Code.gs` and save.
2. YOU: Click **Deploy > Manage deployments**, select the existing deployment, click the pencil (**Edit**), set **Version** to **New version**, and click **Deploy**.

The URL stays the same, so nothing changes on the phone. Do not use **New deployment** for updates: that creates a second URL. (**verify** that the URL is unchanged after your first update by comparing it with the one saved in the Zepp app.)

## What the script stores

- `TOKEN` in Script Properties (you set it).
- `SEEN_0` to `SEEN_4` in Script Properties: the last 500 note ids, used to ignore resends. The script manages these. Deleting them only means an old note could be written twice if it were resent.
