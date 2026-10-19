import { test as base, expect, type CDPSession, type Locator, type Page } from "@playwright/test";

/**
 * Shared fixtures for the iOS suite:
 * - `standalone`: pretends to be the home-screen app (`navigator.standalone`), which enables the custom stack
 *   transitions and the edge swipe.
 * - `pageErrors`: every uncaught page error fails the test.
 * - `finger`: one-finger touch gestures. Chromium sends real touches through CDP (the browser derives pointer events,
 *   touch events and native scrolling from them); WebKit has no touch-move API, so it gets synthetic pointer + touch
 *   events dispatched to the element under the first touch (like the implicit pointer capture of a real touch).
 */
export type Finger = {
  down(x: number, y: number): Promise<void>;
  move(x: number, y: number): Promise<void>;
  up(): Promise<void>;
  /** Down, `steps` moves over `durationMs`, up. */
  drag(from: Point, to: Point, options?: { steps?: number; durationMs?: number; holdMs?: number }): Promise<void>;
  /** Touch and hold without moving (long press). */
  hold(at: Point, ms?: number): Promise<void>;
};
export type Point = { x: number; y: number };

type Fixtures = { standalone: boolean; pageErrors: string[]; finger: Finger };

export const test = base.extend<Fixtures>({
  standalone: [false, { option: true }],
  page: async ({ page, standalone }, provide) => {
    if (standalone) {
      await page.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: () => true });
      });
    }
    await provide(page);
  },
  pageErrors: [
    async ({ page }, provide) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        const text = String(error);
        // WebKit reports Next.js RSC fetches aborted by a navigation, and the service worker registration it refuses
        // in automation (the app catches that rejection), as page errors.
        if (/(Fetch API cannot load .*_rsc=\S* |Cannot load .*\/sw\.js )due to access control checks/.test(text))
          return;
        errors.push(text);
      });
      await provide(errors);
      expect(errors, "uncaught page errors").toEqual([]);
    },
    { auto: true },
  ],
  finger: async ({ page, browserName }, provide) => {
    const synthetic = browserName !== "chromium" || process.env.SYNTHETIC_TOUCH === "1";
    await provide(synthetic ? syntheticFinger(page) : await cdpFinger(page));
  },
});

export { expect };

function withHelpers(finger: Pick<Finger, "down" | "move" | "up">, page: Page): Finger {
  return {
    ...finger,
    async drag(from, to, { steps = 12, durationMs = 220, holdMs = 0 } = {}) {
      await finger.down(from.x, from.y);
      for (let i = 1; i <= steps; i++) {
        await page.waitForTimeout(durationMs / steps);
        await finger.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
      }
      if (holdMs) await page.waitForTimeout(holdMs);
      await finger.up();
    },
    async hold(at, ms = 700) {
      await finger.down(at.x, at.y);
      await page.waitForTimeout(ms);
      await finger.up();
    },
  };
}

async function cdpFinger(page: Page): Promise<Finger> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  const send = async (type: "touchStart" | "touchMove" | "touchEnd", points: Point[]) => {
    await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y })) });
  };
  return withHelpers(
    {
      down: (x, y) => send("touchStart", [{ x, y }]),
      move: (x, y) => send("touchMove", [{ x, y }]),
      up: () => send("touchEnd", []),
    },
    page,
  );
}

function syntheticFinger(page: Page): Finger {
  const dispatch = (phase: "down" | "move" | "up", x: number, y: number) =>
    page.evaluate(
      ({ phase, x, y }) => {
        type TouchWindow = Window & { __touch?: { target: Element; x: number; y: number }; __capturePatched?: boolean };
        const w = window as TouchWindow;
        if (!w.__capturePatched) {
          // Synthetic pointers are not "active" for the browser: capture calls would throw.
          for (const name of ["setPointerCapture", "releasePointerCapture"] as const) {
            const original = Element.prototype[name];
            Element.prototype[name] = function (this: Element, id: number) {
              try {
                original.call(this, id);
              } catch {
                // ignored for synthetic pointers
              }
            };
          }
          w.__capturePatched = true;
        }
        if (phase === "down") w.__touch = { target: document.elementFromPoint(x, y) ?? document.body, x, y };
        const state = w.__touch;
        if (!state) return;
        if (phase === "up") {
          x = state.x;
          y = state.y;
        } else {
          state.x = x;
          state.y = y;
        }
        const { target } = state;
        const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y };
        const pointerType = { down: "pointerdown", move: "pointermove", up: "pointerup" }[phase];
        target.dispatchEvent(
          new PointerEvent(pointerType, {
            ...init,
            pointerId: 7,
            pointerType: "touch",
            isPrimary: true,
            button: phase === "move" ? -1 : 0,
            buttons: phase === "up" ? 0 : 1,
            width: 20,
            height: 20,
            pressure: phase === "up" ? 0 : 0.5,
          }),
        );
        const touchType = { down: "touchstart", move: "touchmove", up: "touchend" }[phase];
        const point = {
          identifier: 7,
          target,
          clientX: x,
          clientY: y,
          pageX: x + scrollX,
          pageY: y + scrollY,
          screenX: x,
          screenY: y,
        };
        const active = phase === "up" ? [] : [point];
        let event: Event;
        try {
          const touch = new Touch(point);
          const list = phase === "up" ? [] : [touch];
          event = new TouchEvent(touchType, { ...init, touches: list, targetTouches: list, changedTouches: [touch] });
        } catch {
          // No Touch constructor (desktop WebKit): a plain event with the same fields.
          event = new Event(touchType, init);
          Object.defineProperties(event, {
            touches: { value: active },
            targetTouches: { value: active },
            changedTouches: { value: [point] },
          });
        }
        target.dispatchEvent(event);
        if (phase === "up") w.__touch = undefined;
      },
      { phase, x, y },
    );
  return withHelpers(
    {
      down: (x, y) => dispatch("down", x, y),
      move: (x, y) => dispatch("move", x, y),
      up: () => dispatch("up", 0, 0),
    },
    page,
  );
}

/** Waits for the stack to settle: one <main>, no running transitions, no transform or fade left on #main. */
export async function settled(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const main = document.getElementById("main");
          if (!main) return "no #main";
          const problems: string[] = [];
          const mains = document.querySelectorAll("main").length;
          if (mains !== 1) problems.push(`${mains} <main>`);
          // Finite animations only: spinners and pulses loop forever by design.
          const running = document
            .getAnimations()
            .filter((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity);
          if (running.length) problems.push(`${running.length} running animations`);
          const style = getComputedStyle(main);
          if (style.transform !== "none") problems.push(`transform ${style.transform}`);
          if (style.opacity !== "1") problems.push(`opacity ${style.opacity}`);
          return problems.join(", ") || "settled";
        }),
      { timeout: 5_000 },
    )
    .toBe("settled");
}

/** Centre of a locator's bounding box. */
export async function centre(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Taps the centre of an element once it stopped moving (sheets and menus spring in). */
export async function tap(_page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  let previous = "";
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        const now = box ? `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)}` : "";
        const stable = now !== "" && now === previous;
        previous = now;
        return stable;
      },
      { intervals: [50], timeout: 5_000 },
    )
    .toBe(true);
  // locator.tap() maps to the visual viewport, which mobile WebKit shifts while a field is focused.
  await locator.tap();
}
