import { expect, test } from "@playwright/test"
import QRCode from "qrcode"
import { promises as fs } from "node:fs"
import path from "node:path"

async function writeQrFixture(name: string, value: string) {
  const filePath = path.join(process.cwd(), "tests", `${name}.png`)
  await QRCode.toFile(filePath, value, { margin: 1, width: 400 })
  return filePath
}

test("uses Create QR as the default tab and syncs the share URL", async ({ page }) => {
  await page.addInitScript(() => {
    let clipboardValue = ""
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          clipboardValue = value
        },
        readText: async () => clipboardValue,
      },
    })
  })

  await page.goto("/")

  await expect(page.getByRole("tab", { name: "Create QR" })).toHaveAttribute("data-state", "active")

  const input = page.getByLabel("Text or URL")
  await input.fill("https://example.com/hello?ref=qr-tools")

  await expect(page).toHaveURL(/text=https%3A%2F%2Fexample\.com%2Fhello%3Fref%3Dqr-tools/)
  await expect(page.getByAltText(/Generated QR code/)).toBeVisible()

  const copyLinkButton = page.getByRole("button", { name: "Copy link" })
  await copyLinkButton.scrollIntoViewIfNeeded()
  await copyLinkButton.evaluate((node: HTMLElement) => node.click())
  await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("text=https%3A%2F%2Fexample.com%2Fhello%3Fref%3Dqr-tools")
})

test("recreates the QR code from the shared query string", async ({ page }) => {
  await page.goto("/?text=Shared%20value%20from%20URL")

  await expect(page.getByLabel("Text or URL")).toHaveValue("Shared value from URL")
  await expect(page.getByAltText(/Generated QR code/)).toBeVisible()
})

test("decodes a QR code from an uploaded local image", async ({ page }) => {
  const filePath = await writeQrFixture("uploaded-qr", "https://upload.example/result")

  try {
    await page.goto("/")
    await page.getByRole("tab", { name: "Read QR" }).click()
    await page.locator('input[type="file"]').setInputFiles(filePath)

    await expect(page.getByLabel("Result")).toHaveValue("https://upload.example/result")
    await expect(page.getByRole("link", { name: "Open link" })).toBeVisible()
  } finally {
    await fs.unlink(filePath).catch(() => undefined)
  }
})

test("handles camera scan success with a browser-only scanner stub", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qrToolsTestOverrides = {
      createScanner: (_video, onDecode) => ({
        start: async () => {
          window.setTimeout(() => onDecode({ data: "https://camera.example/live" }), 50)
        },
        stop: () => undefined,
        destroy: () => undefined,
      }),
    }
  })

  await page.goto("/?tab=read")
  const startCameraButton = page.getByRole("button", { name: "Start camera" })
  await startCameraButton.scrollIntoViewIfNeeded()
  await startCameraButton.evaluate((node: HTMLElement) => node.click())

  await expect(page.getByLabel("Result")).toHaveValue("https://camera.example/live")
  await expect(page.getByText("QR code decoded successfully.")).toBeVisible()
})

test("shows a clear camera permission error when access is denied", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qrToolsTestOverrides = {
      createScanner: () => ({
        start: async () => {
          const error = new Error("Permission denied")
          error.name = "NotAllowedError"
          throw error
        },
        stop: () => undefined,
        destroy: () => undefined,
      }),
    }
  })

  await page.goto("/?tab=read")
  const startCameraButton = page.getByRole("button", { name: "Start camera" })
  await startCameraButton.scrollIntoViewIfNeeded()
  await startCameraButton.evaluate((node: HTMLElement) => node.click())

  await expect(page.getByText("Camera unavailable")).toBeVisible()
  await expect(page.getByText(/Camera access was denied/)).toBeVisible()
})
