import { expect, test } from "@playwright/test";

test.use({ video: "on" });

test("FLEX and BASS-II controls drive their illustrative 3D scenes", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("favicon")) errors.push(message.text()); });
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await expect(page.getByRole("heading", { name: /FIRE WITHOUT GRAVITY/ })).toBeVisible();
    await page.waitForTimeout(700);
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
    await page.screenshot({ path: "output/playwright/explore-mobile-390.png", fullPage: true });
  }

  const flex = page.locator(".flex-model-canvas");
  const flexTimeline = page.getByRole("region", { name: "Conditional FLEX-145 slide 10 scenario timeline" });
  const flexCanvas = flex.locator("canvas");
  await expect(flexCanvas).toBeVisible();
  await page.getByRole("button", { name: "START EXPERIMENT" }).click();
  await expect.poll(async () => Number(await flex.getAttribute("data-visual-time"))).toBeGreaterThan(0.15);
  const activeFrame = await flexCanvas.screenshot();
  if (testInfo.project.name === "desktop") { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: "output/playwright/flex-desktop-active.png" }); }

  const scrub = page.getByLabel("Scrub FLEX-145 model time");
  const duration = Number(await scrub.getAttribute("max"));
  await scrub.evaluate((element: HTMLInputElement, value: number) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(element, String(value));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, duration * 0.72);
  await expect.poll(async () => Number(await flex.getAttribute("data-model-progress"))).toBeGreaterThan(0.7);
  const laterFrame = await flexCanvas.screenshot();
  expect(Buffer.compare(activeFrame, laterFrame)).not.toBe(0);
  if (testInfo.project.name === "desktop") { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: "output/playwright/flex-desktop-later.png" }); }
  await flexTimeline.getByRole("button", { name: "Pause d squared model" }).click();
  const pausedTime = await flex.getAttribute("data-visual-time");
  const pausedFrame = await flexCanvas.screenshot();
  await page.waitForTimeout(180);
  await expect(flex).toHaveAttribute("data-visual-time", pausedTime!);
  expect(Buffer.compare(pausedFrame, await flexCanvas.screenshot())).toBe(0);
  const primaryNavigation = page.getByRole("navigation", { name: "Primary sections" });
  await primaryNavigation.getByRole("button", { name: "Data Lab", exact: true }).click();
  await primaryNavigation.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(flex).toHaveAttribute("data-visual-time", pausedTime!);

  await page.getByRole("button", { name: "What-if model" }).click();
  const durationReadout = page.locator(".what-if-derived strong");
  const referenceDuration = await durationReadout.innerText();
  const referenceDiameter = await flex.getAttribute("data-model-diameter-m");
  await page.getByLabel("Hypothetical initial droplet diameter").evaluate((element: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(element, "4.2");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(durationReadout).not.toHaveText(referenceDuration);
  await expect(flex).not.toHaveAttribute("data-model-diameter-m", referenceDiameter!);
  await expect(page.locator(".what-if-controls")).toContainText("NOT NASA MEASUREMENTS");
  await page.getByRole("button", { name: "Reset to NASA reference inputs" }).click();
  await expect(page.getByRole("button", { name: "NASA experiment" })).toHaveAttribute("aria-pressed", "true");
  await expect(flex).toHaveAttribute("data-visual-time", "0");

  await page.getByLabel("Select experiment").selectOption("bass-ii");
  const bass = page.locator(".bass-scene");
  await expect(bass.locator("canvas")).toBeVisible();
  await expect(page.getByRole("link", { name: /NASA SOURCE · PP\. 46–47/ })).toHaveAttribute("href", "https://ntrs.nasa.gov/citations/20210011385");
  await page.getByLabel("NASA BASS-II rod diameter").selectOption("6.35");
  await expect(bass).toHaveAttribute("data-bass-diameter", "6.35");
  const airflow = page.getByRole("button", { name: "Airflow on" });
  await airflow.click();
  await expect(page.getByRole("button", { name: "Airflow off" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Airflow off" }).click();
  await page.getByLabel("Diagrammatic airflow direction").selectOption("concurrent");
  await expect(page.getByLabel("Diagrammatic airflow direction")).toHaveValue("concurrent");
  await page.getByRole("button", { name: "Reset view" }).click();
  const bassTimeline = page.getByTestId("bass-timeline");
  await bassTimeline.getByRole("button", { name: "Reset experiment" }).click();
  await expect(page.getByLabel("Diagrammatic airflow direction")).toHaveValue("opposed");
  await page.getByRole("button", { name: "Start Experiment", exact: true }).last().click();
  await expect.poll(async () => Number(await bass.getAttribute("data-bass-progress"))).toBeGreaterThan(0.03);
  if (testInfo.project.name === "desktop") { await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })); await page.waitForTimeout(250); await page.screenshot({ path: "output/playwright/bass-ii-desktop.png" }); }
  await bassTimeline.getByRole("button", { name: "Pause" }).click();
  const bassCanvas = bass.locator("canvas");
  const bassPausedFrame = await bassCanvas.screenshot();
  await page.waitForTimeout(180);
  expect(Buffer.compare(bassPausedFrame, await bassCanvas.screenshot())).toBe(0);
  const airflowControl = page.getByLabel("Illustrative airflow intensity");
  for (const [value, label] of [["0.1", "low"], ["0.95", "high"]] as const) {
    await airflowControl.evaluate((node: HTMLInputElement, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value); node.dispatchEvent(new Event("input", { bubbles: true })); node.dispatchEvent(new Event("change", { bubbles: true })); }, value);
    await page.waitForTimeout(100);
    if (testInfo.project.name === "desktop") await bassCanvas.screenshot({ path: `output/playwright/bass-airflow-${label}.png` });
  }
  await page.getByLabel("Diagrammatic airflow direction").selectOption("concurrent");
  if (testInfo.project.name === "desktop") await bassCanvas.screenshot({ path: "output/playwright/bass-airflow-reversed.png" });
  expect(Buffer.compare(bassPausedFrame, await bassCanvas.screenshot())).not.toBe(0);
  const cameraBefore = await bassCanvas.screenshot();
  const cameraBox = await bassCanvas.boundingBox();
  expect(cameraBox).not.toBeNull();
  await page.mouse.move(cameraBox!.x + cameraBox!.width * 0.48, cameraBox!.y + cameraBox!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(cameraBox!.x + cameraBox!.width * 0.63, cameraBox!.y + cameraBox!.height * 0.58, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  const cameraAfter = await bassCanvas.screenshot();
  expect(Buffer.compare(cameraBefore, cameraAfter)).not.toBe(0);
  await page.getByRole("button", { name: "Reset view" }).click();
  const bassPaused = await bass.getAttribute("data-bass-time");
  await page.waitForTimeout(180);
  await expect(bass).toHaveAttribute("data-bass-time", bassPaused!);
  await primaryNavigation.getByRole("button", { name: "Data Lab", exact: true }).click();
  await expect(bass).toHaveAttribute("data-bass-playing", "false");
  await primaryNavigation.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(bass).toHaveAttribute("data-bass-time", bassPaused!);
  await bassTimeline.getByRole("button", { name: "Reset experiment" }).click();
  await expect(bass).toHaveAttribute("data-bass-time", "0.000");
  await expect(bass).toHaveAttribute("data-bass-diameter", "9.525");

  const width = await page.evaluate(() => ({ inner: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(width.document).toBeLessThanOrEqual(width.inner);
  expect(errors).toEqual([]);
});
