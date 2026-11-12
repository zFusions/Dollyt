import { expect, test } from "@playwright/test";

async function viewStageState(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const vs = document.querySelector(".view-stage");
    const rail = document.querySelector(".rail");
    const home = document.querySelector(".home-hero");
    const title = document.querySelector(".page-title, #home-title")?.textContent?.trim();
    return {
      className: vs?.className ?? "",
      opacity: vs ? Number.parseFloat(getComputedStyle(vs).opacity) : -1,
      hasRail: Boolean(rail),
      hasHome: Boolean(home),
      title: title ?? "",
    };
  });
}

test("accueil → presets : fondu + pas de rail pendant le départ", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#home-title")).toBeVisible();

  await page.getByRole("button", { name: "Presets" }).first().click();

  const samples: Awaited<ReturnType<typeof viewStageState>>[] = [];
  for (let i = 0; i < 8; i++) {
    samples.push(await viewStageState(page));
    await page.waitForTimeout(35);
  }

  const sawLeave = samples.some((s) => s.className.includes("view-stage--leave"));
  const sawEnter = samples.some((s) => s.className.includes("view-stage--enter"));
  const sawLowOpacity = samples.some((s) => s.opacity < 0.95 && s.opacity >= 0);
  const railBeforeHomeGone = samples.some((s) => s.hasHome && s.hasRail);

  expect(sawLeave || sawLowOpacity, JSON.stringify(samples)).toBeTruthy();
  expect(sawEnter, JSON.stringify(samples)).toBeTruthy();
  expect(railBeforeHomeGone, "rail ne doit pas apparaître tant que l'accueil est visible").toBeFalsy();

  await expect(page.getByRole("heading", { name: "Presets", level: 1 })).toBeVisible({
    timeout: 3000,
  });
  await page.waitForFunction(() => {
    const vs = document.querySelector(".view-stage");
    if (!vs || vs.classList.contains("view-stage--leave")) return false;
    const o = Number.parseFloat(getComputedStyle(vs).opacity);
    return o > 0.98;
  });
  const end = await viewStageState(page);
  expect(end.hasRail).toBe(true);
  expect(end.hasHome).toBe(false);
  expect(end.opacity).toBeGreaterThan(0.95);
});

test("navigation rapide : conserve la dernière page demandée", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Presets" }).first().click();
  await expect(page.getByRole("button", { name: "Paramètres" })).toBeVisible();
  await page.getByRole("button", { name: "Paramètres" }).click();
  await page.getByRole("button", { name: /Historique|History/ }).click();
  await page.getByRole("button", { name: "Accueil" }).click();

  await expect(page.locator("#home-title")).toBeVisible({ timeout: 3000 });
  await expect(page.locator(".view-stage")).toHaveClass(/view-stage--idle/);
});

test("prefers-reduced-motion : navigation immédiate et accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Presets" }).first().click();

  await expect(page.getByRole("heading", { name: "Presets", level: 1 })).toBeVisible();
  const state = await viewStageState(page);
  expect(state.className).toContain("view-stage--idle");
  expect(state.opacity).toBeGreaterThan(0.98);
});
