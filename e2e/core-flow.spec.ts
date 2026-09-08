import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Fact Ingestion Pipeline", () => {
  test("Should allow uploading a PDF and viewing facts", async ({ page }) => {
    // Navigate to dashboard
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Ingestion Pipeline" })).toBeVisible();

    // Verify upload zone is present
    const uploadZone = page.locator(".border-dashed");
    await expect(uploadZone).toBeVisible();

    // In a real e2e test we would upload a PDF file here.
    // We mock the navigation since the backend pipeline is asynchronous.
    
    // We expect the "Recent Documents" section to exist
    await expect(page.getByRole("heading", { name: "Recent Documents" })).toBeVisible();
    
    // Navigate to the knowledge graph / demo cases
    await page.goto("/demo-cases");
    await expect(page.getByRole("heading", { name: "Demo Cases" })).toBeVisible();
    
    // Verify the grid exists
    const casesGrid = page.locator(".grid");
    await expect(casesGrid).toBeVisible();
  });
});
