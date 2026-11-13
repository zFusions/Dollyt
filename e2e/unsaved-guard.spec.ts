import { expect, test } from "@playwright/test";

const AUTO_UPDATE = /^(Mise à jour automatique|Automatic updates)$/;
const UNSAVED_TITLE = /Modifications non enregistrées|Unsaved changes/;
const STAY = /^(Rester|Stay)$/;
const DISCARD = /Annuler les modifications|Discard changes/;

test("paramètres modifiés : la navigation demande enregistrer ou annuler", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Presets" }).first().click();
  await page.getByRole("button", { name: "Paramètres" }).click();
  await expect(
    page.getByRole("switch", { name: AUTO_UPDATE }),
  ).toBeVisible();

  await page.getByRole("switch", { name: AUTO_UPDATE }).click();
  await page.getByRole("button", { name: "Presets" }).click();

  await expect(page.getByText(UNSAVED_TITLE)).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/unsaved-guard/);

  await page.getByRole("button", { name: STAY }).click();
  await expect(page.getByText(UNSAVED_TITLE)).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/unsaved-guard/);
  await expect(
    page.getByRole("switch", { name: AUTO_UPDATE }),
  ).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Presets" }).click();
  await page.getByRole("button", { name: DISCARD }).click();
  await expect(
    page.getByRole("heading", { name: "Presets", level: 1 }),
  ).toBeVisible({ timeout: 3000 });
});
