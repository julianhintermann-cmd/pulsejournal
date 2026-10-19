/**
 * System haptics on iPhone. Safari has no Vibration API, but since iOS 18 toggling an
 * `<input type="checkbox" switch>` plays the system "selection" haptic. A hidden switch is clicked through its
 * label inside the user's gesture. Elsewhere `navigator.vibrate` is used when available; failures are silent.
 * Only call from a user-gesture handler (pointer/click/touch).
 */

let label: HTMLLabelElement | null = null;

function supportsSwitch() {
  if (typeof document === "undefined") return false;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  // WebKit exposes the attribute as a property once it understands it.
  return "switch" in input;
}

function ensureLabel() {
  if (label?.isConnected) return label;
  const id = "pulse-haptic-switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.setAttribute("switch", "");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  const el = document.createElement("label");
  el.htmlFor = id;
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px";
  el.appendChild(input);
  document.body.appendChild(el);
  label = el;
  return el;
}

let canSwitch: boolean | null = null;

export type HapticKind = "selection" | "light" | "medium" | "success" | "warning";

const VIBRATION: Record<HapticKind, number | number[]> = {
  selection: 8,
  light: 10,
  medium: 18,
  success: [12, 60, 18],
  warning: [20, 50, 20],
};

export function haptic(kind: HapticKind = "selection") {
  try {
    if (canSwitch === null) canSwitch = supportsSwitch();
    if (canSwitch) {
      ensureLabel().click();
      // A success pattern on iOS is approximated by a second tick.
      if (kind === "success" || kind === "warning") window.setTimeout(() => label?.click(), 90);
      return;
    }
    navigator.vibrate?.(VIBRATION[kind]);
  } catch {
    // Haptics are a nicety; never break an interaction.
  }
}
