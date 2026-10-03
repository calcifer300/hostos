/**
 * The app's "look", separate from its light/dark mode.
 *
 * Mode (light or dark) is next-themes' job and stays that way. A look is a
 * whole second visual language laid over the same components, chosen per
 * browser: the default HostOS look, or "mac", which restyles the product the
 * way a macOS app is drawn. Both looks have a light and a dark appearance, as
 * macOS does.
 *
 * The look is an attribute on <html> (data-skin="mac"), not a class on the app
 * shell, for one reason: menus, dialogs, tooltips and toasts render into a
 * portal on <body>, outside the shell. A skin scoped to the shell would leave
 * every one of them in the old look, and those are the most recognisable
 * macOS surfaces there are.
 *
 * This file is server-safe on purpose (the root layout inlines SKIN_BOOT_SCRIPT);
 * the React hook that reads it lives in lib/use-skin.ts.
 */

export type Skin = "default" | "mac";

export const SKIN_KEY = "hostos:skin";
/** Fired on window after a change, because the `storage` event only reaches OTHER tabs. */
export const SKIN_EVENT = "hostos:skin-change";

export const SKINS: { id: Skin; label: string; hint: string }[] = [
  { id: "default", label: "HostOS", hint: "The look HostOS has always had." },
  { id: "mac", label: "macOS", hint: "Translucent sidebar, window controls, native-style controls." },
];

export const isSkin = (value: unknown): value is Skin => value === "default" || value === "mac";

export function readSkin(): Skin {
  try {
    const stored = window.localStorage.getItem(SKIN_KEY);
    return isSkin(stored) ? stored : "default";
  } catch {
    // Storage blocked (private mode, policy): the default look, never an error.
    return "default";
  }
}

export function applySkin(skin: Skin): void {
  const root = document.documentElement;
  if (skin === "default") delete root.dataset.skin;
  else root.dataset.skin = skin;
}

export function writeSkin(skin: Skin): void {
  try {
    if (skin === "default") window.localStorage.removeItem(SKIN_KEY);
    else window.localStorage.setItem(SKIN_KEY, skin);
  } catch {
    /* applied for this page load even if it cannot be remembered */
  }
  applySkin(skin);
  window.dispatchEvent(new Event(SKIN_EVENT));
}

/**
 * Runs in <head> before first paint, so a chosen look is there on the first
 * frame instead of flashing the default one. Limited to /app: the marketing
 * page and the sign-in screen are not part of this look.
 */
export const SKIN_BOOT_SCRIPT = `try{if(/^\\/app(\\/|$)/.test(location.pathname)&&localStorage.getItem(${JSON.stringify(SKIN_KEY)})==="mac")document.documentElement.setAttribute("data-skin","mac")}catch(e){}`;
