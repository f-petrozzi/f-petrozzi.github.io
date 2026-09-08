import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
// Originals stay local; committed WebP assets keep clean builds visually identical.
if (existsSync("docs/F.png") && existsSync("docs/f-background.png")) {
  await mkdir("public/brand", { recursive: true });
  await sharp("docs/F.png")
    .trim()
    .resize({ width: 144 })
    .webp({ quality: 85 })
    .toFile("public/brand/f-mark.webp");
  await sharp("docs/f-background.png")
    .resize({ width: 720 })
    .webp({ quality: 85 })
    .toFile("public/brand/f-art.webp");
}
