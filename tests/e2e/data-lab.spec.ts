import { test, expect } from "@playwright/test";

test("NASA Data Lab filters authentic points, compares two tests and links to the source", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await page.getByRole("button", { name: "Data Lab", exact: true }).click();

  const lab = page.getByRole("region", { name: "NASA FLEX Data Lab" });
  await expect(lab).toBeVisible();
  await expect(lab.getByRole("heading", { name: "Thirty tests. One source." })).toBeVisible();
  await expect(lab).toContainText("30");
  await expect(lab).toContainText("One source");
  await expect(lab.locator(".flex-data-source")).toHaveAttribute("href", "https://ntrs.nasa.gov/api/citations/20150023456/downloads/20150023456.pdf");

  const points = lab.locator(".flex-data-point");
  const initialPointCount = await points.count();
  const chartCount = await lab.locator(".flex-chart-heading").first().locator(".flex-chart-count").innerText();
  expect(initialPointCount).toBe(Number(chartCount.match(/^(\d+)/)?.[1]));
  expect(initialPointCount).toBeGreaterThan(0);
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 1440, height: 1300 });
    await page.screenshot({ path: "release-screenshots/data-lab-desktop.png", fullPage: true });
  }
  for (const label of await points.evaluateAll((items) => items.map((item) => item.getAttribute("aria-label") ?? ""))) {
    expect(label).toMatch(/^FLEX-\d{3} · [A-Z0-9]+ · (Methanol|Heptane)/);
  }

  await lab.getByLabel("Fuel").selectOption("Heptane");
  const filteredPoints = lab.locator(".flex-data-point");
  expect(await filteredPoints.count()).toBeLessThan(initialPointCount);
  for (const label of await filteredPoints.evaluateAll((items) => items.map((item) => item.getAttribute("aria-label") ?? ""))) expect(label).toContain("Heptane");
  await lab.getByLabel("Test end").selectOption("Completion");
  await lab.getByLabel("Fuel").selectOption("all");
  const completionPoints = await lab.locator(".flex-data-point").evaluateAll((items) => items.map((item) => item.getAttribute("aria-label") ?? ""));
  expect(completionPoints.length).toBeGreaterThan(0);
  expect(completionPoints.every((label) => /FLEX-020|FLEX-025|FLEX-029/.test(label))).toBeTruthy();
  await lab.getByLabel("Test end").selectOption("all");

  await lab.getByLabel("Select comparison test A", { exact: true }).selectOption("FLEX-009");
  await lab.getByLabel("Select comparison test B", { exact: true }).selectOption("FLEX-012");
  await expect(lab.locator(".flex-test-comparison")).toContainText("Not reported");
  await expect(lab.locator(".flex-test-comparison")).toContainText("Printed dash retained as missing");
  await expect(lab.locator(".flex-comparability")).toContainText("Different experimental conditions");
  await expect(lab.locator(".flex-comparability")).toContainText("does not isolate a single causal variable");
  const rowLinks = lab.locator(".flex-row-source");
  await expect(rowLinks).toHaveCount(2);
  for (const link of await rowLinks.all()) {
    await expect(link).toHaveAttribute("href", "https://ntrs.nasa.gov/api/citations/20150023456/downloads/20150023456.pdf");
    await expect(link).toContainText("Appendix A, Table IX");
    await expect(link).toContainText("printed page 20");
  }

  await lab.getByLabel("Select comparison test A", { exact: true }).selectOption("FLEX-001");
  await lab.getByLabel("Select comparison test B", { exact: true }).selectOption("FLEX-002");
  const point003 = lab.getByRole("button", { name: /FLEX-003 ·/ });
  await point003.click();
  await expect(lab.getByLabel("Select comparison test B", { exact: true })).toHaveValue("FLEX-003");

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
