import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildDir = join(__dirname, '../build')
const svgPath = join(buildDir, 'icon.svg')

async function generateIcons() {
  if (!existsSync(svgPath)) {
    console.error('SVG icon not found:', svgPath)
    process.exit(1)
  }

  const svgBuffer = readFileSync(svgPath)

  // Generate PNG icons for different sizes
  const sizes = [16, 32, 48, 64, 128, 256, 512]

  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(buildDir, `icon-${size}x${size}.png`))
    console.log(`Generated: icon-${size}x${size}.png`)
  }

  // Generate main icon.png (512x512)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(join(buildDir, 'icon.png'))
  console.log('Generated: icon.png')

  // Generate icon.ico for Windows
  const icoSizes = [16, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(
    icoSizes.map(size =>
      sharp(svgBuffer).resize(size, size).png().toBuffer()
    )
  )
  const icoBuffer = await pngToIco(pngBuffers)
  writeFileSync(join(buildDir, 'icon.ico'), icoBuffer)
  console.log('Generated: icon.ico')

  console.log('\n✅ Icons generated successfully!')
  console.log('\nFor macOS .icns, electron-builder can auto-generate from icon.png')
}

generateIcons().catch(console.error)
