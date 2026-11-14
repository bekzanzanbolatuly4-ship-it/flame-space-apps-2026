import { test, expect } from "@playwright/test";

test("conditional FLEX-145 timeline drives the droplet, pauses, scrubs and terminates at the slide 10 endpoint", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  const timeline = page.getByRole("region", { name: "Conditional FLEX-145 slide 10 scenario timeline" });
  const diameter = page.locator(".d2-reading strong").first();
  const time = page.locator(".d2-model-time strong");
  const scrubber = page.getByLabel("Scrub FLEX-145 model time");
  await expect(diameter).toContainText("3.330 mm");
  await expect(timeline).toContainText("SLIDE 10 SOURCE VALUE · CONFLICT UNRESOLVED");
  await expect(page.getByRole("note", { name: "Unresolved NASA source conflict" })).toBeVisible();
  await page.screenshot({ path: "release-screenshots/explore-desktop.png", fullPage: true });

  const duration = Number(await scrubber.getAttribute("max"));
  await scrubber.evaluate((element: HTMLInputElement, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(element, String(value));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, duration / 2);
  await expect(timeline).toContainText("COMPUTED FROM DISPUTED SLIDE 10 INPUTS");
  const scrubbedTime = Number(await scrubber.inputValue());
  const intermediate = await page.locator(".flex-model-canvas").evaluate((node) => ({
    diameter: Number(node.getAttribute("data-model-diameter-m")),
    radius: Number(node.getAttribute("data-droplet-render-radius")),
  }));
  expect(Math.abs(intermediate.diameter - Math.sqrt(0.00333 ** 2 - 0.448e-6 * scrubbedTime))).toBeLessThan(1e-12);
  expect(Math.abs(intermediate.radius - intermediate.diameter * 70)).toBeLessThan(1e-12);

  await timeline.getByRole("button", { name: "Play d squared model" }).click();
  await expect.poll(async () => Number((await time.innerText()).split(" /")[0])).toBeGreaterThan(duration / 2);
  await timeline.getByRole("button", { name: "Pause d squared model" }).click();
  const pausedAt = await time.innerText();
  await page.waitForTimeout(250);
  await expect(time).toHaveText(pausedAt);

  await page.getByRole("button", { name: "NASA footage" }).click();
  await expect(page.locator(".flex-model-stage")).toHaveClass(/is-hidden/);
  await expect(time).toHaveText(pausedAt);
  await page.getByRole("button", { name: "3D reconstruction" }).click();
  await expect(page.locator(".flex-model-stage")).not.toHaveClass(/is-hidden/);

  await scrubber.focus();
  await scrubber.press("End");
  await expect(diameter).toContainText("1.613 mm");
  await expect(timeline).toContainText("MODEL TERMINATED AT SLIDE 10 ENDPOINT");
  await expect(page.locator(".flex-model-canvas")).toHaveAttribute("data-model-status", "terminated");
  await expect(timeline.getByRole("button", { name: "Play d squared model" })).toBeDisabled();
  await timeline.getByRole("button", { name: "Restart d squared model" }).click();
  await expect(diameter).toContainText("3.330 mm");
  await expect(page.getByRole("note", { name: "Unresolved NASA source conflict" })).toContainText("Slide 9 lists D₀ 3.38 mm");
  await expect(page.getByRole("note", { name: "Unresolved NASA source conflict" }).getByRole("link", { name: "Inspect slide 9 ↗" })).toHaveAttribute("href", "https://ntrs.nasa.gov/api/citations/20130010979/downloads/20130010979.pdf#page=9");
  expect(errors).toEqual([]);
});
