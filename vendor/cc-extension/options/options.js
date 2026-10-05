const $ = (id) => document.getElementById(id);

// Handed to the user to paste into script.google.com. Kept here as a plain
// string rather than a separate file so the options page is self-contained
// and the copy button can't fall out of sync with what's documented.
// Bump alongside SCRIPT_VERSION in background/service-worker.js whenever the
// relay contract changes.
const EXPECTED_SCRIPT_VERSION = 7;

const APPS_SCRIPT = `// HostOS alert relay  (SCRIPT_VERSION 7)
//
// FIRST TIME: Deploy > New deployment > Web app,
//   "Execute as: Me", "Who has access: Anyone".
//   Copy the /exec URL into the extension.
//
// UPDATING LATER: paste the new code, then
//   Deploy > Manage deployments > (pencil icon) > Version: New version > Deploy
//   Editing the code alone does NOT change what the /exec URL runs. The URL
//   stays the same, so you never re-paste it into the extension.
//
// This is a deliberate dumb relay: the EXTENSION composes the subject and
// body. Wording changes therefore never require touching this file again.

var SCRIPT_VERSION = 7;

// Optional: paste a Google Sheet ID here to keep a log of every alert.
// Leave as "" to skip logging.
var SHEET_ID = "";

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var to = (payload.recipients || "").trim();
  var subject = payload.subject;
  var body = payload.body;
  // v4: the nightly report also arrives as HTML, laid out like the cards in the
  // extension panel. Plain text is still sent as the fallback, so a client that
  // refuses HTML still gets a readable email.
  var html = payload.html;
  // v5: the Colorado Cruisers badge, base64, attached inline and referenced
  // from the HTML as cid:ccLogo. Gmail strips <svg> and data: URIs from email,
  // so an attachment is the only thing that renders.
  var logo = payload.logo;
  if (!to) return json({ ok: false, version: SCRIPT_VERSION, error: "no recipients" });
  if (!subject || !body) {
    return json({ ok: false, version: SCRIPT_VERSION, error: "missing subject or body" });
  }

  // MailApp is capped (about 100 recipients/day on a free Gmail account).
  // Hitting it throws, and without this the extension would only see a
  // generic failure — the one case where "no alerts" means the quota ran out
  // rather than nothing being wrong.
  try {
    var message = { to: to, subject: subject, body: body };
    if (html) message.htmlBody = html;
    if (html && logo) {
      // The filename is back. Dropping it was tried in v6 to stop Gmail listing
      // the image as an attachment, and Gmail chipped it anyway - just labelled
      // "noname", which reads worse than "logo.png". Gmail attaches inline
      // images regardless of name, so there is no version of cid: that renders
      // without a chip. Turn the logo off in the options page if the chip is
      // not worth it; nothing here needs redeploying for that.
      message.inlineImages = {
        ccLogo: Utilities.newBlob(Utilities.base64Decode(logo), "image/png", "logo.png")
      };
    }
    try {
      MailApp.sendEmail(message);
    } catch (inlineErr) {
      if (!message.inlineImages) throw inlineErr;
      // A nameless blob is an undocumented corner, so it must never cost us the
      // alert itself. If it is rejected, resend as PLAIN TEXT rather than HTML
      // whose cid: image would now be a broken picture in Matt's inbox.
      MailApp.sendEmail({ to: to, subject: subject, body: body });
    }
  } catch (err) {
    return json({
      ok: false, version: SCRIPT_VERSION,
      error: "send failed: " + err + " (daily mail quota remaining: " +
             MailApp.getRemainingDailyQuota() + ")"
    });
  }
  log(payload.kind, subject, to);
  return json({ ok: true, version: SCRIPT_VERSION, quotaRemaining: MailApp.getRemainingDailyQuota() });
}

function log(kind, subject, to) {
  if (!SHEET_ID) return;
  try {
    SpreadsheetApp.openById(SHEET_ID).getSheets()[0]
      .appendRow([new Date(), kind, subject, to]);
  } catch (err) {
    // Logging must never block the email itself.
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

$("script").textContent = APPS_SCRIPT;

// A send just told us which version answered. Said plainly here, because a
// deployment that never got its "New version" step still delivers mail - it
// just delivers it composed by older code, and nothing else in the UI would
// ever mention it.
function relayNote(result) {
  const deployed = result && result.deployedVersion;
  if (!deployed) return "";
  if (deployed >= EXPECTED_SCRIPT_VERSION) return " Relay is on v" + deployed + ", the current version.";
  return " Note: the /exec URL is running v" + deployed + ", not v" + EXPECTED_SCRIPT_VERSION
    + ". Paste the script below, then Deploy \u2192 Manage deployments \u2192 pencil \u2192 Version: New version.";
}

function setStatus(text, kind) {
  const el = $("status");
  el.textContent = text;
  el.className = "status" + (kind ? " " + kind : "");
}

// Both lists default to the two Colorado Cruisers addresses, so a fresh
// install doesn't silently send nowhere.
const DEFAULT_RECIPIENTS = "coloradocruisersllc@gmail.com, johnbriones774@gmail.com";

async function load() {
  const { hostosAlertConfig = {}, hostosAlertStatus = null, hostosPricingConfig = {} } =
    await chrome.storage.local.get(["hostosAlertConfig", "hostosAlertStatus", "hostosPricingConfig"]);
  // Shown pre-filled rather than applied invisibly: the figure is Matt's, but
  // it is not read from Turo, so it has to be somewhere you can see and change.
  // Defaults on: the logo was asked for, so it stays unless it is turned off.
  $("reportLogo").checked = hostosPricingConfig.reportLogo !== false;
  $("standingDeliveryFee").value = hostosPricingConfig.standingDeliveryFee === undefined
    ? HostOS.constants.STANDING_DELIVERY_FEE
    : hostosPricingConfig.standingDeliveryFee;
  $("enabled").checked = Boolean(hostosAlertConfig.enabled);
  $("webhookUrl").value = hostosAlertConfig.webhookUrl || "";
  $("recipients").value = hostosAlertConfig.recipients || DEFAULT_RECIPIENTS;
  $("urgentRecipients").value = hostosAlertConfig.urgentRecipients || DEFAULT_RECIPIENTS;
  if (hostosAlertStatus) {
    const when = new Date(hostosAlertStatus.at).toLocaleString();
    if (!hostosAlertStatus.ok) {
      setStatus("Last attempt failed " + when + ": " + hostosAlertStatus.error, "error");
    } else {
      // An older deployment still sends correct emails — the extension sends
      // both formats — so this is information, not a fault.
      const stale = hostosAlertStatus.deployedVersion
        && hostosAlertStatus.deployedVersion < EXPECTED_SCRIPT_VERSION;
      // Why the header badge is missing, if it is. The two causes need
      // completely different fixes, and neither is visible from the email.
      const logoNote = hostosAlertStatus.logoState === "relay-below-v5"
        ? " The header logo needs the v" + EXPECTED_SCRIPT_VERSION
          + " script below deployed (Deploy → Manage deployments → New version)."
        : hostosAlertStatus.logoState === "asset-unreadable"
          ? " The header logo could not be read from assets/colorado-cruisers.png."
          : "";
      setStatus(
        "Last alert (" + hostosAlertStatus.kind + ") delivered " + when + "."
          + (stale ? " Your deployed script is v" + hostosAlertStatus.deployedVersion
              + "; v" + EXPECTED_SCRIPT_VERSION + " below is the current one."
            : "") + logoNote,
        stale ? "" : "ok"
      );
    }
  }
}

async function save() {
  const webhookUrl = $("webhookUrl").value.trim();
  // A wrong-looking URL saved silently is how you end up believing alerts are
  // on when nothing is being delivered.
  if (webhookUrl && !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(webhookUrl)) {
    setStatus("That doesn't look like an Apps Script /exec URL. Check you copied the web app URL, not the editor link.", "error");
    return false;
  }
  if ($("enabled").checked && !webhookUrl) {
    setStatus("Add the web app URL before enabling alerts.", "error");
    return false;
  }
  const recipients = $("recipients").value.trim();
  const urgentRecipients = $("urgentRecipients").value.trim();
  // Enabling with no addresses at all would look configured while delivering
  // nothing, which is the failure mode this whole page exists to avoid.
  if ($("enabled").checked && !recipients && !urgentRecipients) {
    setStatus("Add at least one recipient before enabling alerts.", "error");
    return false;
  }
  // Blank means "use Matt's stated rate"; 0 means "he stopped charging it" -
  // two different answers, so an empty box must not read as zero.
  const feeRaw = $("standingDeliveryFee").value.trim();
  const standingDeliveryFee = feeRaw === "" ? HostOS.constants.STANDING_DELIVERY_FEE : Number(feeRaw);
  if (!Number.isFinite(standingDeliveryFee) || standingDeliveryFee < 0) {
    setStatus("The standing delivery fee has to be a number, or blank to use $"
      + HostOS.constants.STANDING_DELIVERY_FEE + ".", "error");
    return false;
  }
  await chrome.storage.local.set({
    hostosAlertConfig: { enabled: $("enabled").checked, webhookUrl, recipients, urgentRecipients },
    hostosPricingConfig: { standingDeliveryFee, reportLogo: $("reportLogo").checked }
  });
  setStatus("Saved.", "ok");
  return true;
}

$("save").addEventListener("click", save);

// Proves the OTHER half of the alerting. The test alert goes to the urgent
// list with its own wording; this composes the real report, addresses it to
// the nightly list and sends it, so both recipient lists and all three risk
// sections are verifiable on demand rather than once a day at 9 PM.
$("testDigest").addEventListener("click", async () => {
  if (!(await save())) return;
  setStatus("Sending tonight's report…");
  const result = await chrome.runtime.sendMessage({ type: "HOSTOS_TEST_DIGEST" });
  if (result && result.ok) {
    setStatus("Report preview sent to the nightly list. Tonight's 9 PM report still goes out as normal."
      + relayNote(result), "ok");
  } else {
    setStatus("Failed: " + ((result && result.reason) || "unknown error"), "error");
  }
});

$("test").addEventListener("click", async () => {
  if (!(await save())) return;
  setStatus("Sending…");
  const result = await chrome.runtime.sendMessage({ type: "HOSTOS_TEST_ALERT" });
  if (result && result.ok) {
    setStatus("Test sent to the urgent list. Check the inbox." + relayNote(result), "ok");
  } else {
    setStatus("Failed: " + ((result && result.reason) || "unknown error"), "error");
  }
});

$("copyScript").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(APPS_SCRIPT);
    setStatus("Script copied.", "ok");
  } catch (error) {
    setStatus("Couldn't copy — select the script below and copy it manually.", "error");
  }
});

load();
