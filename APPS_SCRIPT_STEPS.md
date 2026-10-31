# Connect Shift Hub to the Google Sheet (about 2 minutes)

1. Open the **Shift Hub Data** Google Sheet.
2. Click **Extensions > Apps Script**. A code window opens.
3. Delete what's there. Paste everything from `apps-script/Code.gs`. Click the 💾 **Save** icon.
4. Set the key: click the ⚙️ **Project Settings** gear (left side) > **Add script property**. Property: `SHIFTHUB_KEY`. Value: make up a long password-like phrase. Click **Save script properties**. Keep it private; never put it in the code.
5. Click **Deploy > New deployment**. Click the gear next to "Select type" and pick **Web app**.
6. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy**, then **Authorize access** and allow it with your Google account.
7. Copy the **Web app URL** (it ends in `/exec`).
8. Send that URL to Coder (it isn't secret by itself without the key). Coder puts it in `config.js` as `appsScriptUrl` and republishes. (Or edit `config.js` in the repo yourself.)
9. On each manager's phone, open Shift Hub, tap the yellow **🔑 key banner** (or ⚙️ at the top), type the key once, and tap **Save key**. It stays on that phone.

That's it: all screens now read the Brief, Labor, Events, Speed, SMG and Meta tabs, and Floor tools save to new Floor_* tabs shared by every phone. Without the URL or key, the app shows sample data with a "Sample data" badge.

Notes:
- "Anyone" means anyone with the URL *and* the key. Share the key only with your managers. To change it, edit SHIFTHUB_KEY (step 4); phones must re-enter it.
- If you edit Code.gs later, use **Deploy > Manage deployments > ✏️ > Version: New version** so the URL stays the same.
