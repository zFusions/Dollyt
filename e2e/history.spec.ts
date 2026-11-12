import { expect, test } from "@playwright/test";

test("la navigation remplace File par Historique", async ({ page }) => {
  await page.goto("/");

  const historyButton = page.getByRole("button", { name: /Historique|History/ });
  await expect(historyButton).toBeVisible();
  await historyButton.click();

  await expect(page.getByRole("heading", { name: /Historique|History/, level: 1 })).toBeVisible();
  await expect(page.getByText(/Aucun export pour le moment|No exports yet/)).toBeVisible();
});

test("supprime une seule entrée après confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "dollyt.history.v1",
      JSON.stringify([
        {
          id: "history-a",
          title: "Première vidéo",
          url: "https://youtu.be/first",
          outputPath: "C:\\Videos\\first.mp4",
          thumbnailUrl: "",
          kind: "clip",
          createdAt: 1,
        },
        {
          id: "history-b",
          title: "Deuxième vidéo",
          url: "https://youtu.be/second",
          outputPath: "C:\\Videos\\second.mp4",
          thumbnailUrl: "",
          kind: "full",
          createdAt: 2,
        },
      ]),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Historique|History/ }).first().click();

  const firstCard = page.locator(".history-card").filter({ hasText: "Première vidéo" });
  await firstCard.getByRole("button", { name: /Supprimer|Delete/ }).click();
  await expect(firstCard.getByText(/Supprimer cette vidéo|Remove this video/)).toBeVisible();
  await firstCard.getByRole("button", { name: /Supprimer|Delete/ }).last().click();

  await expect(page.getByText("Première vidéo")).toHaveCount(0);
  await expect(page.getByText("Deuxième vidéo")).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("dollyt.history.v1") ?? "[]"));
  expect(stored).toHaveLength(1);
  expect(stored[0].id).toBe("history-b");
});