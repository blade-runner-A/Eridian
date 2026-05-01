/**
 * Convert a PNG file to ICO format for Windows.
 * ICO supports embedding PNG data directly for sizes >= 256x256.
 * This creates a multi-size ICO with 256x256 PNG entry.
 */
const fs = require('node:fs')
const path = require('node:path')

const pngPath = path.resolve(__dirname, '..', 'public', 'icon-1024.png')
const icoPath = path.resolve(__dirname, '..', 'build', 'icon.ico')

// Read the source PNG
const pngData = fs.readFileSync(pngPath)

// Verify it's a valid PNG
if (pngData[0] !== 0x89 || pngData[1] !== 0x50 || pngData[2] !== 0x4E || pngData[3] !== 0x47) {
  throw new Error('Source file is not a valid PNG')
}

// Extract dimensions from PNG IHDR chunk
const width = pngData.readUInt32BE(16)
const height = pngData.readUInt32BE(20)
console.log(`Source PNG: ${width}x${height}, ${pngData.length} bytes`)

// ICO format:
// Header: 6 bytes
//   - Reserved: 2 bytes (0)
//   - Type: 2 bytes (1 = ICO)
//   - Count: 2 bytes (number of images)
// Directory entry: 16 bytes each
//   - Width: 1 byte (0 = 256)
//   - Height: 1 byte (0 = 256)
//   - Color palette: 1 byte (0 = no palette)
//   - Reserved: 1 byte (0)
//   - Color planes: 2 bytes (1)
//   - Bits per pixel: 2 bytes (32)
//   - Image size: 4 bytes
//   - Offset: 4 bytes

const imageCount = 1
const headerSize = 6
const dirEntrySize = 16
const dataOffset = headerSize + (dirEntrySize * imageCount)

const ico = Buffer.alloc(dataOffset + pngData.length)

// ICO Header
ico.writeUInt16LE(0, 0)           // Reserved
ico.writeUInt16LE(1, 2)           // Type: ICO
ico.writeUInt16LE(imageCount, 4)  // Image count

// Directory entry for 256x256 (stored as 0 which means 256)
ico.writeUInt8(0, 6)              // Width (0 = 256)
ico.writeUInt8(0, 7)              // Height (0 = 256)
ico.writeUInt8(0, 8)              // Color palette
ico.writeUInt8(0, 9)              // Reserved
ico.writeUInt16LE(1, 10)          // Color planes
ico.writeUInt16LE(32, 12)         // Bits per pixel
ico.writeUInt32LE(pngData.length, 14) // Image data size
ico.writeUInt32LE(dataOffset, 18)     // Offset to image data

// Copy PNG data
pngData.copy(ico, dataOffset)

// Ensure build directory exists
const buildDir = path.dirname(icoPath)
fs.mkdirSync(buildDir, { recursive: true })

// Write ICO file
fs.writeFileSync(icoPath, ico)
console.log(`Created ICO: ${icoPath} (${ico.length} bytes)`)
