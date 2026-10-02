process.env.AUTH_SECRET = "test-secret-for-the-key-tests";
process.env.COCRUISERS_PIN = "0444";
const access = await import("../src/lib/pulse/access.ts");

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};

console.log("=== the 4-digit key for Matthew's page ===");
eq("the right key opens it", access.checkPin("0444"), true);
eq("a wrong key does not", access.checkPin("0445"), false);
eq("neither does anything that is not four digits", [access.checkPin("044"), access.checkPin("04444"), access.checkPin("abcd"), access.checkPin(444), access.checkPin(null)], [false, false, false, false, false]);

const NOW = 1_800_000_000_000;
const token = access.makeToken(NOW);
eq("a remembered login is accepted", access.verifyToken(token, NOW + 1000), true);
eq("it expires", access.verifyToken(token, NOW + access.ACCESS_MAX_AGE_S * 1000 + 1000), false);
eq("a tampered one is refused", access.verifyToken(token.slice(0, -2) + "xx", NOW + 1000), false);
eq("so is a made-up one, and none at all", [access.verifyToken("9999999999999.abc", NOW), access.verifyToken("", NOW), access.verifyToken(undefined, NOW)], [false, false, false]);
eq("the cookie never contains the key", token.includes("0444"), false);

console.log("=== wrong tries ===");
const address = "203.0.113.9";
eq("not locked at first", access.lockedFor(address, NOW), 0);
const left = [1, 2, 3, 4, 5].map((i) => access.recordFailure(address, NOW + i));
eq("five wrong tries count down", left, [4, 3, 2, 1, 0]);
eq("then the address is locked for the rest of the 15 minutes", access.lockedFor(address, NOW + 60_000) > 800, true);
eq("another address is not affected", access.lockedFor("198.51.100.4", NOW + 60_000), 0);
eq("the lock ends", access.lockedFor(address, NOW + 16 * 60_000), 0);
access.recordFailure("x", NOW);
access.clearFailures("x");
eq("a right key clears the count", access.lockedFor("x", NOW), 0);

if (fail) process.exitCode = 1;
