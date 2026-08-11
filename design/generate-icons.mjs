import sharp from "sharp"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const dir = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(dir, "..", "public", "icons")
mkdirSync(outDir, { recursive: true })

const jobs = [
  { src: "icon-source.svg", out: "icon-192.png", size: 192 },
  { src: "icon-source.svg", out: "icon-512.png", size: 512 },
  { src: "icon-maskable-source.svg", out: "icon-maskable-512.png", size: 512 },
]

for (const job of jobs) {
  const srcPath = path.join(dir, job.src)
  const outPath = path.join(outDir, job.out)
  await sharp(srcPath).resize(job.size, job.size).png().toFile(outPath)
  console.log("wrote", outPath)
}
