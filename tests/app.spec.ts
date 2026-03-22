import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { deflateSync } from "node:zlib"
import { jsPDF } from "jspdf"

function createPngBuffer(width: number, height: number) {
  const row = width * 4 + 1
  const raw = Buffer.alloc(row * height)

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * row
    raw[rowStart] = 0

    for (let x = 0; x < width; x += 1) {
    const offset = rowStart + 1 + x * 4
      raw[offset] = (x * 29 + y * 13) % 256
      raw[offset + 1] = (x * 11 + y * 17) % 256
      raw[offset + 2] = (x * 7 + y * 19) % 256
      raw[offset + 3] = 255
    }
  }

  const chunks = [
    pngChunk("IHDR", createIHDR(width, height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]

  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks])
}

function createIHDR(width: number, height: number) {
  const buffer = Buffer.alloc(13)
  buffer.writeUInt32BE(width, 0)
  buffer.writeUInt32BE(height, 4)
  buffer[8] = 8
  buffer[9] = 6
  buffer[10] = 0
  buffer[11] = 0
  buffer[12] = 0
  return buffer
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii")
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBuffer, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function createMinimalPdf() {
  const pdf = new jsPDF({
    unit: "pt",
    format: "letter",
  })
  pdf.setFontSize(18)
  pdf.text("Upload limit helper test PDF", 72, 90)
  return Buffer.from(pdf.output("arraybuffer"))
}

test("renders the three goal-oriented flows", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", {
      name: "Hit common upload limits without sending your files anywhere.",
    })
  ).toBeVisible()
  await expect(page.getByRole("tab", { name: "PDF" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Image" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Passport" })).toBeVisible()
})

test("compresses an image and offers a download", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("tab", { name: "Image" }).click()

  const imageBuffer = createPngBuffer(1600, 1200)

  await page.setInputFiles("#image-file", {
    name: `${randomUUID()}.png`,
    mimeType: "image/png",
    buffer: imageBuffer,
  })

  await expect(page.getByText("Image is under the limit")).toBeVisible()
  await expect(page.getByText("Passes target")).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download optimized image" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain("compressed")
})

test("checks and normalizes a passport photo", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("tab", { name: "Passport" }).click()

  const imageBuffer = createPngBuffer(900, 1200)

  await page.setInputFiles("#passport-file", {
    name: `${randomUUID()}.png`,
    mimeType: "image/png",
    buffer: imageBuffer,
  })

  await expect(
    page.getByRole("alert").locator('[data-slot="alert-title"]')
  ).toHaveText("Passport-ready export created")
  await expect(page.getByText("Needs attention").first()).toBeVisible()
  await expect(page.getByText("Passes target")).toBeVisible()
})

test("processes a PDF locally and returns a downloadable file", async ({ page }) => {
  await page.goto("/")

  const downloadPromise = page.waitForEvent("download")

  await page.setInputFiles("#pdf-file", {
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: createMinimalPdf(),
  })

  await expect(
    page.getByText(/Target reached|Best effort complete/)
  ).toBeVisible({ timeout: 20000 })
  await page.getByRole("button", { name: "Download compressed PDF" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain("compressed")
})

test("shows a validation error for the wrong file type", async ({ page }) => {
  await page.goto("/")

  await page.setInputFiles("#pdf-file", {
    name: "not-a-pdf.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("plain text"),
  })

  await expect(page.getByText("Unsupported file")).toBeVisible()
  await expect(page.getByText("Choose a PDF file for this tool.")).toBeVisible()
})
