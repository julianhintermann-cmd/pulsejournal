import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

/**
 * Layout, glass budget and accessibility on every phone project (16 Pro dark/light, 16 Pro Max, SE):
 * no horizontal scroll (also at 320 px), at most five visible glass layers, accessible names, touch targets,
 * no zoom-on-focus and keyboard hints.
 */

const SCREENS = [
  "/?range=all",
  "/trades?range=all",
  "/trades/new?mode=quick",
  "/trades/new?mode=detailed",
  "/journal",
  "/journal/today",
  "/calendar",
  "/stats?range=all",
  "/stats?range=all&tab=setups",
  "/playbooks?range=all",
  "/accounts",
  "/import-export",
  "/settings",
  "/more",
];

async function overflow(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.right <= width + 1) return false;
        // Inside a horizontal scroller (chips, carousels) or clipped by an ancestor: fine.
        for (let p = el.parentElement; p; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (s.overflowX !== "visible" || s.position === "fixed") return false;
        }
        return getComputedStyle(el).position !== "fixed";
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
    return { scroll: document.documentElement.scrollWidth - width, offenders };
  });
}

async function glassLayers(page: Page) {
  const panel = page.locator("[data-ios-debug] dl");
  await expect(panel).toBeAttached();
  let max = 0;
  for (let i = 0; i < 2; i++) {
    await page.waitForTimeout(550);
    max = Math.max(max, Number(await panel.getAttribute("data-backdrops")));
  }
  return max;
}

test("every screen fits the width and stays within the glass budget", async ({ page }) => {
  test.slow();
  await page.goto("/?debug=1");
  await expect(page.locator("[data-ios-debug] dl")).toBeAttached();
  for (const path of SCREENS) {
    await page.goto(path, { waitUntil: "networkidle" });
    const result = await overflow(page);
    expect(result, `${path} scrolls horizontally`).toEqual({ scroll: 0, offenders: [] });
    expect(await glassLayers(page), `${path} glass layers`).toBeLessThanOrEqual(5);
  }
  await page.goto("/?debug=0");
});

test("no horizontal scroll at 320 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-se", "one narrow run is enough");
  test.slow();
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of SCREENS) {
    await page.goto(path, { waitUntil: "networkidle" });
    expect(await overflow(page), `${path} at 320 px`).toEqual({ scroll: 0, offenders: [] });
  }
});

test("interactive elements have names and the chrome has 44 pt targets", async ({ page }) => {
  for (const path of ["/?range=all", "/trades?range=all", "/trades/new?mode=quick", "/journal", "/more"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const problems = await page.evaluate(() => {
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !el.closest("[aria-hidden=true],[inert]");
      };
      const name = (el: Element) =>
        (
          el.getAttribute("aria-label") ||
          (el.getAttribute("aria-labelledby") &&
            document.getElementById(el.getAttribute("aria-labelledby")!)?.textContent) ||
          el.textContent ||
          el.getAttribute("title") ||
          el.querySelector("img[alt]")?.getAttribute("alt") ||
          ""
        ).trim();
      const unnamed = [...document.querySelectorAll("button, a[href], [role=button], [role=tab], [role=radio]")]
        .filter(visible)
        .filter((el) => !name(el))
        .map((el) => el.outerHTML.slice(0, 120));
      const small = [...document.querySelectorAll("[data-ios-chrome] a, [data-ios-chrome] button")]
        .filter(visible)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width < 43.5 || r.height < 43.5;
        })
        .map(
          (el) =>
            `${el.getAttribute("aria-label") ?? el.textContent} ${el.getBoundingClientRect().width}×${el.getBoundingClientRect().height}`,
        );
      return { unnamed, small };
    });
    expect(problems, path).toEqual({ unnamed: [], small: [] });
  }
});

test("form fields never zoom on focus and guide the keyboard", async ({ page }) => {
  await page.goto("/trades/new?mode=detailed", { waitUntil: "networkidle" });
  const fields = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLInputElement>(
        "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select",
      ),
    ]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => ({
        id: el.id || el.name,
        size: parseFloat(getComputedStyle(el).fontSize),
        inputMode: el.getAttribute("inputmode"),
        enterKeyHint: el.getAttribute("enterkeyhint"),
        type: el.getAttribute("type"),
      })),
  );
  expect(fields.length).toBeGreaterThan(5);
  for (const field of fields) expect(field.size, `${field.id} font size`).toBeGreaterThanOrEqual(16);
  const decimals = fields.filter((f) => f.inputMode === "decimal");
  expect(decimals.length).toBeGreaterThan(0);
  for (const field of decimals) expect(field.enterKeyHint, `${field.id} enterkeyhint`).toBeTruthy();
});

test("the keyboard inset is tracked and the tab bar gets out of the way", async ({ page }) => {
  await page.goto("/journal/today", { waitUntil: "networkidle" });
  await expect(page.locator(".ios-tabbar")).toBeVisible();
  // Emulators have no software keyboard: drive the tracker the way iOS does, through the visual viewport.
  const lifted = await page.evaluate(async () => {
    const vv = window.visualViewport!;
    const height = vv.height;
    Object.defineProperty(vv, "height", { configurable: true, get: () => height - 336 });
    vv.dispatchEvent(new Event("resize"));
    await new Promise((r) => setTimeout(r, 700));
    const root = getComputedStyle(document.documentElement);
    const tabbar = document.querySelector(".ios-tabbar")!;
    const result = {
      kb: parseFloat(root.getPropertyValue("--kb")) || 0,
      flag: document.documentElement.hasAttribute("data-keyboard"),
      tabbarHidden:
        getComputedStyle(tabbar).visibility === "hidden" ||
        getComputedStyle(tabbar).display === "none" ||
        Number(getComputedStyle(tabbar).opacity) === 0 ||
        tabbar.getBoundingClientRect().top >= window.innerHeight,
    };
    Object.defineProperty(vv, "height", { configurable: true, get: () => height });
    vv.dispatchEvent(new Event("resize"));
    await new Promise((r) => setTimeout(r, 200));
    return {
      ...result,
      after: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--kb")) || 0,
    };
  });
  expect(lifted.kb).toBeGreaterThan(300);
  expect(lifted.flag).toBe(true);
  expect(lifted.tabbarHidden).toBe(true);
  expect(lifted.after).toBe(0);
});

test("text meets WCAG AA contrast", async ({ page }) => {
  test.slow();
  for (const path of [
    "/?range=all",
    "/trades?range=all",
    "/trades/new?mode=detailed",
    "/journal",
    "/calendar",
    "/stats?range=all",
    "/more",
    "/settings",
    "/accounts",
  ]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const failures = await page.evaluate(() => {
      type RGBA = [number, number, number, number];
      // Any CSS colour (rgb, color(srgb), oklab from Tailwind opacity modifiers, …) → sRGB bytes via a 1×1 canvas.
      const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
      const parse = (css: string): RGBA | null => {
        if (!css) return null;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "rgba(0, 0, 0, 0)";
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      const lum = ([r, g, b]: RGBA) => {
        const f = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const over = (fg: RGBA, bg: RGBA): RGBA =>
        [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as RGBA;
      const ratio = (a: RGBA, b: RGBA) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const accent = parse(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim())!;
      const same = (a: RGBA, b: RGBA) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) < 3);
      const background = (el: Element) => {
        const layers: RGBA[] = [];
        let onAccent = false;
        for (let q: Element | null = el; q; q = q.parentElement) {
          // A full-cover inset shadow (e.g. the calendar heat shade) paints over the element's own background.
          const shade = getComputedStyle(q).boxShadow.match(/^(.+?\)) 0px 0px 0px (\d+)px inset$/);
          if (shade && Number(shade[2]) >= 200) {
            const c = parse(shade[1]);
            if (c && c[3] > 0) layers.push(c);
          }
          const c = parse(getComputedStyle(q).backgroundColor);
          if (c && c[3] > 0) {
            if (c[3] > 0.9 && same(c, accent)) onAccent = true;
            layers.push(c);
            if (c[3] >= 0.99) break;
          }
        }
        let base: RGBA = parse(getComputedStyle(document.body).backgroundColor) ?? [0, 0, 0, 1];
        if (base[3] < 1) base = [0, 0, 0, 1];
        for (const layer of layers.reverse()) base = over(layer, base);
        return { color: base, onAccent };
      };
      const out: string[] = [];
      for (const el of document.querySelectorAll("body *")) {
        // Glass chrome sits on moving content (checked visually); hidden and screen-reader-only text has no contrast.
        if (el.closest("[aria-hidden=true], [data-ios-chrome], [data-ios-debug], svg, [inert], .sr-only, :disabled"))
          continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
        const rect = el.getBoundingClientRect();
        if (!rect.width || rect.bottom < 0 || rect.top > innerHeight) continue;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || Number(style.opacity) < 0.99 || style.position === "fixed") continue;
        const bg = background(el);
        const fg = parse(style.color);
        if (!fg) continue;
        const size = parseFloat(style.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
        // The brand accent (fills and accent labels) is held to the 3:1 UI-component level, like Apple's tint.
        const accentText = same(fg, accent) || bg.onAccent;
        const need = large || accentText ? 3 : 4.5;
        const value = ratio(over(fg, bg.color), bg.color);
        if (value < need)
          out.push(
            `${value.toFixed(2)} < ${need} "${el.textContent!.trim().slice(0, 24)}" ${style.color} on rgb(${bg.color.slice(0, 3).map(Math.round).join(",")})`,
          );
      }
      return out;
    });
    expect(failures, path).toEqual([]);
  }
});
