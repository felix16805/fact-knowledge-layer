import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Fact Ingestion Pipeline", () => {
  test("Should allow uploading a PDF and viewing facts", async ({ page }) => {
    test.setTimeout(180000); // 3 minutes

    // 1. Navigate to dashboard
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Ingestion Pipeline" })).toBeVisible();

    // 2. Upload a PDF file
    const fileInput = page.locator('input[type="file"]');
    const pdfPath = path.resolve(
      __dirname,
      "../../starter-datasets/delhivery/03-delhivery-q4-fy24-earnings-presentation.pdf"
    );
    await fileInput.setInputFiles(pdfPath);

    // 3. Wait for the redirect to the document page
    await page.waitForURL(/\/documents\/[0-9a-fA-F-]+/);
    await expect(page.locator("h1")).toContainText("03-delhivery-q4-fy24-earnings-presentation.pdf");

    // 4. Wait for processing to complete (status changes from pending -> ready)
    // We can increase timeout because backend parsing takes a few seconds.
    const statusIndicator = page.locator(".uppercase.tracking-wider", { hasText: "ready" });
    await expect(statusIndicator).toBeVisible({ timeout: 120000 });

    // 5. Verify the PDF viewer is loaded successfully
    const pdfIframe = page.locator("iframe");
    await expect(pdfIframe).toBeVisible();
    
    // We expect the iframe src to be the local PDF proxy
    const src = await pdfIframe.getAttribute("src");
    expect(src).toContain("/pdf");

    // 6. Verify that facts have been extracted
    const extractedFactsHeader = page.getByText("Extracted Facts");
    await expect(extractedFactsHeader).toBeVisible();

    // Verify there is at least one fact card
    const factCards = page.locator(".group.relative.flex.flex-col");
    await expect(factCards.first()).toBeVisible({ timeout: 10000 });
  });
});
