import { Buffer } from "node:buffer"

import { expect, test } from "@playwright/test"
import { PNG } from "pngjs"

function createPngBuffer(width: number, height: number, rgb: [number, number, number]) {
  const png = new PNG({ width, height })

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (width * y + x) << 2
      png.data[idx] = rgb[0]
      png.data[idx + 1] = rgb[1]
      png.data[idx + 2] = rgb[2]
      png.data[idx + 3] = 255
    }
  }

  return PNG.sync.write(png)
}

test("resizes, converts, previews, and downloads a processed image", async ({ page }) => {
  await page.goto("/")

  await page.getByTestId("file-input").setInputFiles({
    name: "landscape.png",
    mimeType: "image/png",
    buffer: createPngBuffer(200, 100, [33, 90, 180]),
  })

  await expect(page.getByText("landscape.png")).toBeVisible()
  await page.getByRole("checkbox", { name: "Resize output" }).click()
  await page.getByLabel("Max width").fill("100")
  await page.getByLabel("Max height").fill("100")

  await page.locator("#format").click()
  await page.getByRole("option", { name: "JPG" }).click()
  await page.getByTestId("process-button").click()

  await expect(page.getByText("Ready").first()).toBeVisible()
  await expect(page.getByText("100 × 50", { exact: true }).first()).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download" }).first().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe("landscape.jpg")
})

test("exports multiple processed images as a zip archive", async ({ page }) => {
  await page.goto("/")

  await page.getByTestId("file-input").setInputFiles([
    {
      name: "a.png",
      mimeType: "image/png",
      buffer: createPngBuffer(120, 120, [220, 80, 70]),
    },
    {
      name: "b.png",
      mimeType: "image/png",
      buffer: createPngBuffer(160, 90, [60, 150, 120]),
    },
  ])

  await page.getByTestId("process-button").click()
  await expect(page.getByText("Ready").last()).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download ZIP" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe("image-tools-export.zip")
})

test("accepts drag and drop uploads and reports invalid files", async ({ page }) => {
  await page.goto("/")

  const validBuffer = createPngBuffer(90, 90, [110, 110, 110])
  await page.evaluate(
    async ({ bytes }) => {
      const dt = new DataTransfer()
      const file = new File([new Uint8Array(bytes)], "drop.png", { type: "image/png" })
      dt.items.add(file)

      const target = document.querySelector("[data-testid='dropzone']")
      target?.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }))
    },
    { bytes: Array.from(validBuffer) },
  )

  await expect(page.getByText("drop.png")).toBeVisible()

  await page.getByTestId("file-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  })

  await expect(page.getByTestId("error-alert")).toContainText(
    "notes.txt: use PNG, JPG, WebP, or AVIF files.",
  )
})
