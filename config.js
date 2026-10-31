// Shift Hub config. Paste each tab's "Publish to web" CSV URL here (File > Share > Publish to web > tab > CSV).
// Leave blank to use bundled sample data in data/sample/.
window.SHIFTHUB_CONFIG = {
  csv: { Brief: "", Labor: "", Events: "", Speed: "", SMG: "", Meta: "" },
  // Floor tools storage: "local" (this phone only) or "appsscript" (shared, after Travis deploys apps-script/Code.gs).
  floorAdapter: "local",
  appsScriptUrl: "" // Web app URL ending in /exec. The shared key is NOT stored here; managers enter it in Floor > Settings.
};
