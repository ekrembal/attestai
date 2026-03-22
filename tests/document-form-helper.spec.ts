import { expect, test } from "@playwright/test"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

declare global {
  interface Window {
    __downloads?: string[]
  }
}

async function createPdfBuffer() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  const firstPage = pdf.addPage([612, 792])
  firstPage.drawText("Quarterly Review", {
    x: 48,
    y: 720,
    size: 24,
    font,
    color: rgb(0.12, 0.18, 0.22),
  })

  const secondPage = pdf.addPage([612, 792])
  secondPage.drawText("Page Two", {
    x: 48,
    y: 720,
    size: 24,
    font,
    color: rgb(0.12, 0.18, 0.22),
  })

  return Buffer.from(await pdf.save())
}

function createPngBuffer() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAGQAAAA8CAYAAACg3dJDAAAACXBIWXMAAAsSAAALEgHS3X78AAAA" +
      "kElEQVR4nO3QQREAIAzAsIF/zyBjRxMFfXpn5gBA0t4OQNLeDkDS3g5A0t4OQNLeDkDS3g5A0t4OQNLe" +
      "DkDS3g5A0t4OQNLeDkDS3g5A0t4OQNLeDkDS3g5A0t4OQNLeDkDS3g5A0t4OQNL+7QGFbQJQ8KZ8JwAA" +
      "AABJRU5ErkJggg==",
    "base64"
  )
}

test("imports a local PDF and shows page previews", async ({ page }) => {
  await page.goto("/")

  await page
    .locator('input[type="file"][accept="application/pdf,.pdf"]')
    .setInputFiles({
      name: "local-form.pdf",
      mimeType: "application/pdf",
      buffer: await createPdfBuffer(),
    })

  await expect(page.getByText("local-form.pdf loaded with 2 pages.")).toBeVisible()
  await expect(page.getByText("Page 1")).toBeVisible()
  await expect(page.getByText("Page 2")).toBeVisible()
  await expect(page.getByTestId("page-preview")).toBeVisible()
})

test("supports editing, signatures, stamp images, and signature reuse on desktop", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Desktop interaction coverage runs in the desktop project."
  )

  await page.goto("/")
  await page.getByTestId("sample-document-button").click()
  await expect(page.getByText("sample-travel-form.pdf loaded with 2 pages.")).toBeVisible()

  await page.getByTestId("add-text-button").click()
  await page.getByTestId("annotation-textarea").fill("Approved for reimbursement")

  const annotation = page.locator('[data-testid^="annotation-"]').first()
  const moveHandle = page.locator('[data-testid^="move-"]').first()
  const before = await annotation.boundingBox()
  const grip = await moveHandle.boundingBox()
  if (!before || !grip) {
    throw new Error("Expected annotation and move handle to exist.")
  }

  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + 80, grip.y + 70, { steps: 8 })
  await page.mouse.up()

  const after = await annotation.boundingBox()
  expect(after?.x).toBeGreaterThan((before.x ?? 0) + 20)

  await page.getByTestId("draw-signature-button").click()
  const signatureCanvas = page.getByTestId("signature-canvas")
  const canvasBox = await signatureCanvas.boundingBox()
  if (!canvasBox) {
    throw new Error("Signature canvas is not visible.")
  }

  await page.mouse.move(canvasBox.x + 40, canvasBox.y + 80)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 140, canvasBox.y + 130, { steps: 10 })
  await page.mouse.move(canvasBox.x + 240, canvasBox.y + 90, { steps: 10 })
  await page.mouse.up()
  await page.getByRole("button", { name: "Save & place" }).click()

  await expect(page.getByText("Signature saved locally and placed on page 1.")).toBeVisible()
  await expect(page.locator('[data-testid^="signature-tile-"]').first()).toBeVisible()
  await page.locator('[data-testid^="signature-tile-"]').first().click()

  await page
    .locator('input[type="file"][accept="image/*"]')
    .setInputFiles({
      name: "stamp.png",
      mimeType: "image/png",
      buffer: createPngBuffer(),
    })

  await expect(page.locator('[data-testid^="annotation-"]')).toHaveCount(4)
})

test("exports the edited PDF and JSON snapshot on desktop", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Desktop export coverage runs in the desktop project."
  )
  test.setTimeout(60_000)

  await page.addInitScript(() => {
    window.__downloads = []
    const originalClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function click(...args) {
      if (this.download) {
        window.__downloads?.push(this.download)
      }

      return originalClick.apply(this, args)
    }
  })

  await page.goto("/")
  await page.getByTestId("sample-document-button").click()
  await expect(page.getByText("sample-travel-form.pdf loaded with 2 pages.")).toBeVisible()
  await page.getByTestId("add-text-button").click()
  await page.getByTestId("annotation-textarea").fill("Signed and reviewed")

  await page.getByTestId("download-pdf-button").click({ timeout: 60_000 })
  await expect(page.getByText("Edited PDF downloaded.")).toBeVisible()

  await page.getByTestId("export-project-button").click()
  await expect(page.getByText("Annotation snapshot exported as JSON.")).toBeVisible()

  await expect
    .poll(() => page.evaluate(() => window.__downloads ?? []))
    .toEqual([
      "sample-travel-form-edited.pdf",
      "sample-travel-form-annotations.json",
    ])
})

test("shows strong validation for invalid files and empty text export", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name.includes("mobile"),
    "Desktop validation coverage is sufficient; mobile has a dedicated smoke test."
  )

  await page.goto("/")

  await page
    .locator('input[type="file"][accept="application/pdf,.pdf"]')
    .setInputFiles({
      name: "not-a-pdf.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    })

  await expect(page.getByTestId("error-alert")).toContainText(
    "Only PDF documents are supported."
  )

  await page.getByTestId("sample-document-button").click()
  await expect(page.getByText("sample-travel-form.pdf loaded with 2 pages.")).toBeVisible()
  await page.getByTestId("add-text-button").click()
  await expect(page.getByTestId("annotation-inspector")).toBeVisible()
  await page.getByTestId("annotation-textarea").fill("")
  await page.getByTestId("download-pdf-button").click()

  await expect(page.getByTestId("error-alert")).toContainText(
    "Text fields cannot be empty."
  )
})

test("keeps the primary workflow available on mobile", async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("mobile"),
    "Mobile smoke coverage runs in the mobile project."
  )

  await page.goto("/")
  await page.getByTestId("sample-document-button").click()
  await expect(page.getByTestId("page-preview")).toBeVisible()
  await page.getByTestId("add-text-button").click()
  await expect(page.getByTestId("annotation-inspector")).toBeVisible()
  await expect(page.getByTestId("annotation-textarea")).toBeVisible()
})
