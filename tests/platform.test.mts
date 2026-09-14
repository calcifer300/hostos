import { asWorkspaceRole, can, canAssignRole, roleRank, WORKSPACE_ROLES } from "../src/lib/roles/permissions.ts";
import { routes, safeAppRedirect } from "../src/lib/routes.ts";
import { looksLikeAccessToken, normalizeShopDomain } from "../src/lib/commerce/shopify.ts";
import { isWorkspaceModule, MODULES } from "../src/lib/modules.ts";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};

console.log("\n=== workspace roles ===");
eq("five roles, owner first", WORKSPACE_ROLES, ["owner", "admin", "manager", "member", "viewer"]);
eq("unknown role degrades to viewer", asWorkspaceRole("superuser"), "viewer");
eq("viewer can read", can("viewer", "workspace.read"), true);
eq("viewer cannot write", can("viewer", "workspace.write"), false);
eq("member can write", can("member", "workspace.write"), true);
eq("member cannot manage members", can("member", "workspace.members"), false);
eq("manager configures but does not manage people", [can("manager", "workspace.settings"), can("manager", "workspace.members")], [true, false]);
eq("admin can manage integrations", can("admin", "workspace.integrations"), true);
eq("only the owner can delete", [can("owner", "workspace.delete"), can("admin", "workspace.delete")], [true, false]);
eq("rank is monotonic", [roleRank("owner") > roleRank("admin"), roleRank("admin") > roleRank("manager"), roleRank("manager") > roleRank("member"), roleRank("member") > roleRank("viewer")], [true, true, true, true]);

console.log("\n=== canAssignRole ===");
eq("owner may do anything", canAssignRole("owner", "admin", "owner"), true);
eq("admin may promote a member to manager", canAssignRole("admin", "member", "manager"), true);
eq("admin may not create another admin", canAssignRole("admin", "member", "admin"), false);
eq("admin may not touch the owner", canAssignRole("admin", "owner", "viewer"), false);
eq("admin may not hand out ownership", canAssignRole("admin", "member", "owner"), false);
eq("manager may not assign roles", canAssignRole("manager", "viewer", "member"), false);
eq("manager may not demote an admin", canAssignRole("manager", "admin", "viewer"), false);
eq("member may not assign at all", canAssignRole("member", "viewer", "viewer"), false);

console.log("\n=== routes ===");
eq("product lives under /app", routes.app, "/app");
eq("fleet dashboard and vehicles are separate", [routes.fleet, routes.vehicles], ["/app/fleet", "/app/fleet/vehicles"]);
eq("vehicle names are encoded once", routes.vehicle("Mazda CX-50"), "/app/fleet/vehicles/Mazda%20CX-50");
eq("restaurant tabs carry the query", routes.restaurantTab("r1", "menu"), "/app/restaurants/r1?tab=menu");
eq("open redirect refused", safeAppRedirect("https://evil.example/app"), "/app");
eq("protocol-relative refused", safeAppRedirect("//evil.example"), "/app");
eq("outside the product refused", safeAppRedirect("/login"), "/app");
eq("inside the product honoured", safeAppRedirect("/app/tasks"), "/app/tasks");
eq("empty falls back", safeAppRedirect(null), "/app");

console.log("\n=== modules ===");
eq("three modules today", MODULES.map((m) => m.id), ["fleet", "restaurants", "commerce"]);
eq("module guard", [isWorkspaceModule("fleet"), isWorkspaceModule("hotels")], [true, false]);

console.log("\n=== shopify ===");
eq("handle becomes a domain", normalizeShopDomain("My-Shop"), "my-shop.myshopify.com");
eq("url is stripped to the domain", normalizeShopDomain("https://my-shop.myshopify.com/admin"), "my-shop.myshopify.com");
eq("custom domains are refused", normalizeShopDomain("shop.example.com"), null);
eq("empty is null", normalizeShopDomain("   "), null);
// Assembled at runtime so the shape of a token never sits in the source as a literal.
eq("admin API tokens recognised", looksLikeAccessToken(["shpat", "0123456789abcdef".repeat(2)].join("_")), true);
eq("other strings refused", looksLikeAccessToken("password123"), false);

if (fail > 0) process.exitCode = 1;
