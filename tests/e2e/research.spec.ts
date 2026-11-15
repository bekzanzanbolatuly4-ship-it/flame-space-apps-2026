import { test, expect } from "@playwright/test";

test("BASS evidence, ranking, comparison, gaps and shared mode context", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await page.getByLabel("Select experiment").selectOption("bass-ii");
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await page.getByRole("button", { name: "Open evidence lens", exact: true }).click();
  const lens = page.getByRole("complementary", { name: "Evidence lens" });
  await page.getByRole("tab", { name: "Findings", exact: true }).click();
  await expect(lens.getByText(/Heat-release rates were calculated/)).toBeVisible();
  await expect(lens.locator('a[href="https://ntrs.nasa.gov/citations/20210011385"]').first()).toBeVisible();
  await lens.getByRole("button", { name: "Close evidence lens", exact: true }).click();
  const research = page.getByRole("region", { name: "Research" });
  await research.getByLabel("Search verified evidence").fill("heat release oxygen consumption");
  const record = page.locator(".research-record").first();
  await expect(record).toContainText("Heat release inferred");
  await record.getByText("Why this rank?", { exact: true }).click();
  await expect(record).toContainText("title/topic matches");
  await page.screenshot({ path: `output/playwright/${testInfo.project.name}-search.png` });
  await page.getByRole("button", { name: "Compare two records" }).click();
  await page.getByLabel("Record A", { exact: true }).selectOption("FLEX-145-INITIAL");
  await page.getByLabel("Record B", { exact: true }).selectOption("FLEX-145-EXTINCTION");
  await expect(page.locator(".comparison-result")).toContainText("Qualitative comparison only");
  await expect(page.locator(".comparison-result")).toContainText("unresolved slide 9/10 conflict");
  await expect(page.locator(".comparison-value")).toHaveCount(0);
  await page.getByLabel("Record A", { exact: true }).selectOption("BASS-RATIO");
  await expect(page.locator(".comparison-result")).toContainText("Qualitative comparison only");
  await expect(page.locator(".comparison-value")).toHaveCount(0);
  await research.getByLabel("Search verified evidence").fill("Mars fire risk percentage");
  await expect(page.locator(".search-status")).toContainText("Insufficient evidence");
  await expect(page.getByText(/absence here does not mean NASA/)).toBeVisible();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.getByLabel("Select experiment")).toHaveValue("bass-ii");
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await expect(research.getByLabel("Search verified evidence")).toHaveValue("Mars fire risk percentage");
  await expect(research.getByLabel("Record A", { exact: true })).toHaveValue("BASS-RATIO");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await expect.poll(() => page.locator(".scene").evaluate((scene) => getComputedStyle(scene).opacity)).toBe("1");
  await expect.poll(() => page.locator(".scene").evaluate((scene) => getComputedStyle(scene).transform)).toBe("matrix(1, 0, 0, 1, 0, 0)");
  await page.screenshot({ path: `output/playwright/${testInfo.project.name}-viewport.png` });
  await page.screenshot({ path: `output/playwright/${testInfo.project.name}-main.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("AI availability is honest; API handles search, comparison and unsupported questions", async ({ page, request }) => {
  test.setTimeout(60000);
  const available = await (await request.get("/api/ask")).json();
  expect(typeof available.model).toBe("string");
  const search = await (await request.get("/api/research?q=methanol%20extinction%20diameter&experiment=flex")).json();
  expect(search.hits[0].record.id).toBe("FLEX-145-EXTINCTION");
  expect(search.hits[0].record.source.locator).toContain("Slide 10");
  const comparison = await (await request.post("/api/research", { data: { leftId: "FLEX-145-INITIAL", rightId: "FLEX-145-EXTINCTION" } })).json();
  expect(comparison.kind).toBe("qualitative");
  expect(comparison.delta).toBeNull();
  expect(comparison.reasons.join(" ")).toContain("unresolved slide 9/10 conflict");
  expect((await request.post("/api/research", { data: { leftId: "FAKE", rightId: "BASS-HEAT" } })).status()).toBe(400);
  expect((await request.get("/api/research?experiment=unknown")).status()).toBe(400);
  const unsupported = await (await request.post("/api/ask", { data: { experimentId: "bass-ii", question: "What is the fire risk percentage on Mars?" } })).json();
  expect(unsupported.kind).toBe("evidence-brief"); expect(unsupported.answer).toContain("no AI answer generated");
  expect((await request.post("/api/ask", { data: { experimentId: "fake", question: "oxygen" } })).status()).toBe(400);
  await page.goto("/");
  await page.getByRole("button", { name: "Ask about this evidence" }).click();
  if (!available.available) {
    await expect(page.getByRole("dialog")).toContainText("GOOGLE_GENERATIVE_AI_API_KEY");
    await expect(page.getByRole("button", { name: "AI unavailable", exact: true })).toBeDisabled();
    const noKey = await request.post("/api/ask", { data: { experimentId: "flex", question: "methanol extinction diameter" } });
    expect(noKey.status()).toBe(200);
    expect((await noKey.json()).kind).toBe("evidence-brief");
  } else {
    // A live request is only attempted with configured credentials; IDs still validated server-side.
    await page.getByLabel("Your question").fill("What is the methanol extinction diameter?");
    const startedAt = Date.now();
    await page.getByRole("button", { name: "Ask FLAME", exact: true }).click();
    const result = page.locator(".ai-result");
    await expect(result).toBeVisible({ timeout: 55000 });
    const elapsedMs = Date.now() - startedAt;
    if (await page.locator(".ai-source-links a").count() === 0) {
      const message = (await result.innerText()).replace(/\s+/g, " ").slice(0, 240);
      console.log(`Live Gemini browser result · model=${available.model} · ${elapsedMs}ms · rejected: ${message}`);
      throw new Error(`Live Gemini answer did not render a validated citation for ${available.model}.`);
    }
    console.log(`Live Gemini browser result · model=${available.model} · ${elapsedMs}ms · validated NTRS citation rendered`);
    await expect(result).toContainText("1.613 mm");
    await expect(page.locator(".ai-source-links a").first()).toHaveAttribute("href", "https://ntrs.nasa.gov/api/citations/20130010979/downloads/20130010979.pdf#page=10");
    await expect(page.locator(".ai-source-links")).toContainText("FLEX-145-EXTINCTION");
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("AI answer rendering shows server-validated NASA links and readable provider errors", async ({ page }) => {
  let failPost = false;
  await page.route("**/api/ask", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { available: true, modelConfigured: true, model: "gemini-4-hydrogen" } });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (failPost) {
      await route.fulfill({ status: 502, json: { error: "A validated source-grounded answer could not be generated." } });
      return;
    }
    await route.fulfill({ json: {
      kind: "ai-answer",
      model: "gemini-4-hydrogen",
      answer: "Reported evidence: the record gives an extinction diameter. [FLEX-145-EXTINCTION]\\n\\nLimitations: uncertainty is unavailable.",
      claims: [{ text: "The record gives an extinction diameter.", kind: "reported-fact", evidenceIds: ["FLEX-145-EXTINCTION"] }],
      sources: [{ id: "FLEX-145-EXTINCTION", label: "FLEX-145-EXTINCTION · FLEX Study", href: "https://ntrs.nasa.gov/citations/20210011385", locator: "Slide 10" }],
      gaps: [],
    } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Research", exact: true }).click();
  const research = page.getByRole("region", { name: "Research" });
  await research.getByRole("button", { name: "Ask FLAME", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your question").fill("What is the extinction diameter?");
  const askButton = dialog.getByRole("button", { name: "Ask FLAME", exact: true });
  await askButton.click();
  await expect(dialog.getByRole("button", { name: "Checking sources…", exact: true })).toBeDisabled();
  const citation = dialog.locator(".ai-source-links a");
  await expect(citation).toBeVisible();
  await expect(citation).toHaveAttribute("href", "https://ntrs.nasa.gov/citations/20210011385");
  await expect(dialog.locator(".ai-source-links")).toContainText("FLEX-145-EXTINCTION");

  failPost = true;
  await dialog.getByLabel("Your question").fill("Why is this result limited?");
  await dialog.getByRole("button", { name: "Ask FLAME", exact: true }).click();
  await expect(dialog.locator(".ai-result.error")).toContainText("validated source-grounded answer");
  await expect(dialog.locator(".ai-source-links")).toHaveCount(0);
});

test("fire-safety evidence brief is grounded, cited and explicit about gaps", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Research", exact: true }).click();
  const research = page.getByRole("region", { name: "Research" });
  await research.getByLabel("Search verified evidence").fill("methanol extinction diameter");
  await research.getByRole("button", { name: "Build fire-safety evidence brief" }).click();
  const brief = page.getByRole("article", { name: "Fire safety evidence brief" });
  await expect(brief).toContainText(/NASA verified records/i);
  await expect(brief).toContainText("Dext = 1.613 mm");
  await expect(brief).toContainText("slide 9 reports D₀ = 3.38 mm");
  await expect(brief).toContainText(/quantitative comparisons using these disputed values are withheld/i);
  await expect(brief.locator('a[href^="https://ntrs.nasa.gov/"]').first()).toBeVisible();
  await expect(brief).toContainText("research implication, not a proven safety conclusion");
  await page.setViewportSize({ width: 1440, height: 1250 });
  await brief.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "release-screenshots/research-evidence-brief.png" });
  await research.getByLabel("Search verified evidence").fill("Mars fire risk percentage");
  await expect(brief).toContainText("do not establish a fire-safety conclusion");
  await expect(brief).toContainText("Insufficient evidence");
});

test("reduced motion, repeated transitions and footage position remain stable", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "NASA footage", exact: true }).click();
  await page.getByRole("button", { name: "Play archival footage" }).click();
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(0);
  await page.locator("video").evaluate((video: HTMLVideoElement) => { video.pause(); video.currentTime = 3; });
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThanOrEqual(3);
  await page.getByLabel("Select experiment").selectOption("bass-ii");
  await page.getByLabel("Select experiment").selectOption("flex");
  await page.getByRole("button", { name: "NASA footage", exact: true }).click();
  await page.getByRole("button", { name: "Play archival footage" }).click();
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Research", exact: true }).dispatchEvent("click");
    await page.getByRole("button", { name: "Explore", exact: true }).dispatchEvent("click");
  }
  await expect(page.locator(".evidence-panel")).toHaveCount(0);
  await expect(page.getByLabel("Select experiment")).toHaveValue("flex");
  await expect.poll(() => page.locator(".scene").evaluate((scene) => getComputedStyle(scene).transform)).toBe("matrix(1, 0, 0, 1, 0, 0)");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Research", exact: true }).dispatchEvent("click");
    await page.getByRole("button", { name: "Explore", exact: true }).dispatchEvent("click");
  }
  await expect.poll(() => page.locator(".scene").evaluate((scene) => getComputedStyle(scene).transform)).toBe("matrix(1, 0, 0, 1, 0, 0)");
  expect(errors).toEqual([]);
});

test("four primary sections stay functional and preserve their local state across desktop and mobile navigation", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary sections" });
  for (const name of ["Explore", "Data Lab", "Research", "Learn"]) await expect(nav.getByRole("button", { name, exact: true })).toBeVisible();

  const labLink = nav.getByRole("button", { name: "Data Lab", exact: true });
  await labLink.click();
  const lab = page.getByRole("region", { name: "NASA FLEX Data Lab" });
  await expect(lab.getByLabel("Fuel")).toBeVisible();
  await lab.getByLabel("Select comparison test A", { exact: true }).selectOption("FLEX-009");
  await lab.getByLabel("Select comparison test B", { exact: true }).selectOption("FLEX-012");
  await expect(lab.locator(".flex-comparability")).toContainText("Different experimental conditions");
  await lab.getByLabel("Fuel").selectOption("Heptane");
  if (testInfo.project.name === "desktop") await page.screenshot({ path: "output/playwright/primary-navigation-desktop.png" });

  const researchLink = nav.getByRole("button", { name: "Research", exact: true });
  await researchLink.click();
  const research = page.getByRole("region", { name: "Research" });
  await research.getByLabel("Search verified evidence").fill("methanol extinction diameter");
  await expect(research.locator(".research-record").first()).toContainText("FLEX-145-EXTINCTION");

  await nav.getByRole("button", { name: "Learn", exact: true }).click();
  const mission = page.getByRole("region", { name: "Interactive FLEX learning mission" });
  await expect(mission).toContainText("PREDICT");
  await mission.getByRole("button", { name: /Squared droplet diameter/ }).click();
  await labLink.click();
  await expect(lab.getByLabel("Fuel")).toHaveValue("Heptane");
  await nav.getByRole("button", { name: "Learn", exact: true }).click();
  await expect(mission.getByRole("button", { name: /Squared droplet diameter/ })).toHaveAttribute("aria-pressed", "true");

  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["Explore", "Data Lab", "Research", "Learn"]) await expect(nav.getByRole("button", { name, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const name of ["Data Lab", "Research", "Explore", "Data Lab", "Learn", "Explore"]) await nav.getByRole("button", { name, exact: true }).dispatchEvent("click");
  await expect(nav.getByRole("button", { name: "Explore", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".evidence-panel")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
