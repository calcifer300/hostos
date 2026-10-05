// Minimal test harness for HostOS. No dependencies — run with:
//   node tests/run.js
//
// The extension's modules are plain scripts that attach to a global HostOS
// object rather than exporting anything, so they're eval'd into this process
// with just enough of a DOM to render into. That keeps the production files
// free of any test-only plumbing.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;
const failures = [];
let currentSuite = "";

function suite(name) {
  currentSuite = name;
  console.log("\n" + name);
}

function record(label, ok, detail) {
  if (ok) {
    passed += 1;
    console.log("  ok   " + label);
    return;
  }
  failed += 1;
  failures.push(currentSuite + " > " + label);
  console.log("  FAIL " + label + (detail ? "\n       " + detail : ""));
}

function is(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  record(label, ok, ok ? null : "got " + JSON.stringify(actual) + "\n       want " + JSON.stringify(expected));
}

function ok(label, value) {
  record(label, value === true, value === true ? null : "got " + JSON.stringify(value) + ", want true");
}

function notOk(label, value) {
  record(label, value === false, value === false ? null : "got " + JSON.stringify(value) + ", want false");
}

function includes(label, haystack, needle) {
  const found = String(haystack).includes(needle);
  record(label, found, found ? null : "missing: " + needle + "\n       in: " + haystack);
}

function excludes(label, haystack, needle) {
  const found = String(haystack).includes(needle);
  record(label, !found, found ? "unexpectedly present: " + needle : null);
}

// --- A DOM just real enough to render cards into --------------------------
function makeElement(tag) {
  return {
    tagName: tag,
    children: [],
    style: {},
    dataset: {},
    _text: "",
    className: "",
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    set textContent(value) { this._text = String(value); this.children = []; },
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); },
    appendChild(child) { this.children.push(child); return child; },
    append(...nodes) { nodes.forEach((node) => this.children.push(node)); },
    setAttribute() {},
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

function installDom() {
  global.window = global;
  global.document = {
    createElement: makeElement,
    createTextNode: (text) => ({ textContent: String(text), children: [] })
  };
}

// Loads the extension's real source files in dependency order.
function loadModules(files) {
  installDom();
  files.forEach((file) => {
    // eslint-disable-next-line no-eval
    eval.call(global, fs.readFileSync(path.join(ROOT, file), "utf8"));
  });
  return global.HostOS;
}

function readSource(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

// Pulls a named top-level function out of a source file so service-worker
// logic can be exercised without a chrome runtime.
function extractFunction(source, name) {
  const pattern = new RegExp("(?:async )?function " + name + "\\([\\s\\S]*?\\n}");
  const match = source.match(pattern);
  if (!match) throw new Error("could not find function " + name);
  return match[0];
}

function renderQueue(HostOS, trips, filter, fleetAvailability, extras) {
  const container = makeElement("section");
  HostOS.queueView.renderQueue(container, trips, filter, fleetAvailability, extras || {});
  return container;
}

// Walks the rendered tree collecting the text of nodes carrying a class.
function textOfClass(node, className) {
  const found = [];
  (function walk(current) {
    if (!current || typeof current !== "object") return;
    if (typeof current.className === "string" && current.className.split(" ").includes(className)) {
      found.push(current.textContent);
    }
    (current.children || []).forEach(walk);
  })(node);
  return found;
}

function summary() {
  console.log("\n" + "-".repeat(60));
  if (failed) {
    console.log(failed + " FAILED, " + passed + " passed\n");
    failures.forEach((name) => console.log("  - " + name));
    console.log("");
    process.exit(1);
  }
  console.log(passed + " passed, 0 failed\n");
  process.exit(0);
}

// Relative days/hours helpers used across the suites.
const dayOffset = (days, hour) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  date.setHours(hour === undefined ? 12 : hour, 0, 0, 0);
  return date.toISOString();
};

// Anchored to now, not to a clock hour. A fixture meaning "already ended"
// written as day(0, 5) silently means "ends at 5 AM today" - which is in the
// FUTURE for any run before 5 AM, so the assertion passed all day and failed
// at 4:33 AM. Relative to now it means the same thing at every hour.
const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

module.exports = {
  ROOT, suite, is, ok, notOk, includes, excludes, record,
  loadModules, readSource, extractFunction,
  makeElement, renderQueue, textOfClass, dayOffset, hoursAgo, summary
};
