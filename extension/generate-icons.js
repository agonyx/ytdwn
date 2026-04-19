const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const sizes = [16, 32, 48, 128];
const svgPath = path.join(__dirname, "icons", "icon.svg");
const svg = fs.readFileSync(svgPath);

async function generate() {
  for (const size of sizes) {
    const outPath = path.join(__dirname, "icons", `icon${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(outPath);
    console.log(`Generated ${outPath}`);
  }
}

generate().catch(console.error);
