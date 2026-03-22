import { expect, test, type Download } from "@playwright/test"
import JSZip from "jszip"
import { PDFDocument, StandardFonts, degrees } from "pdf-lib"

async function createPdf(pageLabels: string[]) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  for (const label of pageLabels) {
    const page = pdf.addPage([612, 792])
    page.drawText(label, {
      x: 72,
      y: 700,
      size: 24,
      font,
    })
  }

  return Buffer.from(await pdf.save())
}

async function readDownload(download: Download) {
  const path = await download.path()

  if (!path) {
    throw new Error("Download path was not available.")
  }

  return Buffer.from(await (await import("node:fs/promises")).readFile(path))
}

test("home page showcases the available tools", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", {
      name: /Edit, split, merge, and extract PDFs without leaving the browser/i,
    })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: /open tool/i })).toHaveCount(7)
})

test("merge workspace combines multiple PDFs into one download", async ({ page }) => {
  const firstPdf = await createPdf(["Alpha page 1", "Alpha page 2"])
  const secondPdf = await createPdf(["Beta page 1", "Beta page 2"])

  await page.goto("/tools/merge")
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "alpha.pdf",
      mimeType: "application/pdf",
      buffer: firstPdf,
    },
    {
      name: "beta.pdf",
      mimeType: "application/pdf",
      buffer: secondPdf,
    },
  ])

  await expect(page.getByTestId("page-card-4")).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByTestId("primary-action").click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe("merged.pdf")

  const pdf = await PDFDocument.load(await readDownload(download))
  expect(pdf.getPageCount()).toBe(4)
})

test("reorder flow updates the visual output order", async ({ page }) => {
  const pdfBytes = await createPdf(["First", "Second", "Third"])

  await page.goto("/tools/reorder")
  await page.locator('input[type="file"]').setInputFiles({
    name: "sequence.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  })

  const firstHandle = page.getByLabel("Drag page 1")
  const thirdHandle = page.getByLabel("Drag page 3")
  const firstBox = await firstHandle.boundingBox()
  const thirdBox = await thirdHandle.boundingBox()

  if (!firstBox || !thirdBox) {
    throw new Error("Could not resolve page card positions.")
  }

  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + 20)
  await page.mouse.down()
  await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2, {
    steps: 10,
  })
  await page.mouse.up()

  await expect(page.getByTestId("page-card-1")).toContainText("source p.2")
})

test("rotate and delete flows are reflected in exported PDFs", async ({ page }) => {
  const pdfBytes = await createPdf(["Rotate me", "Keep me", "Remove me"])

  await page.goto("/tools/rotate")
  await page.locator('input[type="file"]').setInputFiles({
    name: "rotate.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  })

  await page.getByTestId("range-input").fill("1")
  await page.getByRole("button", { name: "Select", exact: true }).click()
  await page.getByRole("button", { name: /rotate right/i }).click()

  const rotateDownloadPromise = page.waitForEvent("download")
  await page.getByTestId("primary-action").click()
  const rotateDownload = await rotateDownloadPromise
  const rotatedPdf = await PDFDocument.load(await readDownload(rotateDownload))
  expect(rotatedPdf.getPage(0).getRotation().angle).toBe(degrees(90).angle)

  await page.goto("/tools/delete")
  await page.locator('input[type="file"]').setInputFiles({
    name: "delete.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  })

  await page.getByTestId("range-input").fill("3")
  await page.getByRole("button", { name: "Select", exact: true }).click()
  await page.getByRole("button", { name: /delete selected/i }).click()

  const deleteDownloadPromise = page.waitForEvent("download")
  await page.getByTestId("primary-action").click()
  const deleteDownload = await deleteDownloadPromise
  const trimmedPdf = await PDFDocument.load(await readDownload(deleteDownload))
  expect(trimmedPdf.getPageCount()).toBe(2)
})

test("extract pages exports only the selected pages", async ({ page }) => {
  const pdfBytes = await createPdf(["Page one", "Page two", "Page three"])

  await page.goto("/tools/extract-pages")
  await page.locator('input[type="file"]').setInputFiles({
    name: "extract.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  })

  await page.getByTestId("range-input").fill("2")
  await page.getByRole("button", { name: "Select", exact: true }).click()

  const downloadPromise = page.waitForEvent("download")
  await page.getByTestId("primary-action").click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe("extracted-pages.pdf")

  const extractedPdf = await PDFDocument.load(await readDownload(download))
  expect(extractedPdf.getPageCount()).toBe(1)
})

test("split tool packages range groups into a zip", async ({ page }) => {
  const pdfBytes = await createPdf(["One", "Two", "Three", "Four"])

  await page.goto("/tools/split")
  await page.locator('input[type="file"]').setInputFiles({
    name: "split.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  })

  await page.getByTestId("split-groups").fill("1-2\n3-4")

  const downloadPromise = page.waitForEvent("download")
  await page.getByTestId("primary-action").click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe("split-pdfs.zip")

  const zip = await JSZip.loadAsync(await readDownload(download))
  const fileNames = Object.keys(zip.files).sort()
  expect(fileNames).toEqual(["split-1.pdf", "split-2.pdf"])

  for (const fileName of fileNames) {
    const entry = zip.file(fileName)

    if (!entry) {
      throw new Error(`Missing ${fileName} in zip archive.`)
    }

    const pdf = await PDFDocument.load(await entry.async("uint8array"))
    expect(pdf.getPageCount()).toBe(2)
  }
})

test("extract text reads selectable text in-browser", async ({ page }) => {
  const pdfBytes = await createPdf(["Extracted text example", "Second page content"])

  await page.goto("/tools/extract-text")
  await page.locator('input[type="file"]').setInputFiles({
    name: "text.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  })

  await page.getByTestId("primary-action").click()
  await page.getByRole("tab", { name: "Output" }).click()
  await expect(page.getByTestId("text-output")).toHaveValue(/Extracted text example/)
  await expect(page.getByTestId("text-output")).toHaveValue(/Second page content/)
})
