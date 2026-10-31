# Turn on shared Floor tools (about 2 minutes)

1. Open the **Shift Hub Data** Google Sheet.
2. Click **Extensions > Apps Script**. A code window opens.
3. Delete what's there. Paste everything from `apps-script/Code.gs`. Click the 💾 **Save** icon.
4. Set the key: click the ⚙️ **Project Settings** gear (left side) > **Add script property**. Property: `SHIFTHUB_KEY`. Value: make up a long password-like phrase. Click **Save script properties**. Keep this key private; don't put it in the code.
5. Click **Deploy > New deployment**. Click the gear next to "Select type" and pick **Web app**.
6. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy**, then **Authorize access** and allow it with your Google account.
7. Copy the **Web app URL** (it ends in `/exec`).
8. Where to paste it: in the app's `config.js`, set `appsScriptUrl: "<that URL>"` and `floorAdapter: "appsscript"`. (Or send the URL to Coder and it'll do this.)
9. On each manager's phone, open Shift Hub > **Floor** tab, type the key once, and tap **Save key**. It stays on that phone.

Note: "Anyone" means anyone with the URL *and* the key can add notes. Only share the key with your managers. To change it, edit SHIFTHUB_KEY in step 4; old phones must re-enter it.
