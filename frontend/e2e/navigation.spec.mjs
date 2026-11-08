import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explorar demonstração/ }).click();
  await expect(page.getByRole("heading", { name: "Explorar conexões" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("navigates artists and consecutive connections without stale explanations", async ({ page }) => {
  await page.getByRole("button", { name: "Artista: Radiohead" }).click();
  const connections = page.getByRole("list", { name: "Conexões de Radiohead" });
  await connections.getByRole("button", { name: /The Smile/ }).click();
  await expect(page.getByRole("heading", { name: "Radiohead ↔ The Smile" })).toBeVisible();
  await expect(page.getByText(/Coeficientes fixos \(exatos\)/)).toBeVisible();

  await connections.getByRole("button", { name: /Slowdive/ }).click();
  await expect(page.getByRole("heading", { name: "Radiohead ↔ Slowdive" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Radiohead ↔ The Smile" })).toHaveCount(0);

  await page.getByRole("button", { name: "Artista: The Smile" }).click();
  await expect(page.getByRole("list", { name: "Conexões de The Smile" })).toBeVisible();
  await expect(page.getByText("Nenhuma conexão selecionada.", { exact: false })).toBeVisible();
});

test("threshold and graph switch clear selection and keep formulas separate", async ({ page }) => {
  await page.getByRole("button", { name: "Artista: Radiohead" }).click();
  await page.getByRole("list", { name: "Conexões de Radiohead" }).getByRole("button", { name: /The Smile/ }).click();

  const threshold = page.getByRole("slider");
  await threshold.focus();
  await threshold.press("End");
  await expect(page.getByText("Nenhuma ligação visível com o limiar atual.")).toBeVisible();
  await expect(page.getByText("Nenhuma conexão selecionada.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Artistas ↔ Gêneros (Bipartido)" }).click();
  await expect(page.getByText("52 resultados de 52 nós")).toBeVisible();
  await expect(page.getByText("Nenhuma conexão selecionada.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Artista: Radiohead" }).click();
  await page.getByRole("list", { name: "Conexões de Radiohead" }).getByRole("button", { name: /ART ROCK/ }).first().click();
  await expect(page.getByRole("heading", { name: /Radiohead ↔ #/ })).toBeVisible();
  await expect(page.getByText(/nem usa a fórmula das ligações entre artistas/)).toBeVisible();
  await expect(page.getByText(/Coeficientes fixos/)).toHaveCount(0);

  await page.getByRole("button", { name: "Artistas ↔ Artistas" }).click();
  await expect(page.getByText("Nenhuma conexão selecionada.", { exact: false })).toBeVisible();
});

test("short mobile viewport keeps a readable canvas and accessible connection list", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only layout check");
  await page.setViewportSize({ width: 360, height: 400 });
  const canvas = page.locator("canvas");
  await expect.poll(async () => (await canvas.boundingBox())?.height).toBeGreaterThanOrEqual(360);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(0);
  await expect(page.getByText("Ligações inferidas pelo BeatCode.")).toBeVisible();
  const noteWidth = await page.getByText("Ligações inferidas pelo BeatCode.").locator("..").evaluate((element) => element.getBoundingClientRect().width);
  expect(noteWidth).toBeLessThanOrEqual(210);

  await page.getByRole("button", { name: "Artista: Radiohead" }).tap();
  await page.getByRole("list", { name: "Conexões de Radiohead" }).getByRole("button", { name: /The Smile/ }).tap();
  await expect(page.getByRole("heading", { name: "Radiohead ↔ The Smile" })).toBeVisible();
});
