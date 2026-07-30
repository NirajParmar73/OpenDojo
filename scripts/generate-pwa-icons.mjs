import { deflateSync } from 'node:zlib'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}

function encodePng(width, height, pixels) {
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    rows[rowStart] = 0
    pixels.copy(rows, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const palette = {
  white: [255, 255, 255, 255],
  gold: [245, 190, 66, 255],
  admin: [15, 118, 110, 255],
  adminDark: [10, 75, 70, 255],
  platform: [55, 48, 163, 255],
  platformDark: [30, 27, 75, 255],
  student: [180, 35, 24, 255],
  studentDark: [111, 24, 18, 255]
}

function renderIcon(size, surface) {
  const scale = 3
  const width = size * scale
  const pixels = Buffer.alloc(width * width * 4)
  const color = value => palette[value]
  const point = value => Math.round(value / 512 * width)

  function setPixel(x, y, fill) {
    if (x < 0 || y < 0 || x >= width || y >= width) return
    const offset = (y * width + x) * 4
    pixels[offset] = fill[0]
    pixels[offset + 1] = fill[1]
    pixels[offset + 2] = fill[2]
    pixels[offset + 3] = fill[3]
  }

  function rect(x, y, w, h, fill) {
    const left = point(x)
    const top = point(y)
    const right = point(x + w)
    const bottom = point(y + h)
    for (let py = top; py < bottom; py++) {
      for (let px = left; px < right; px++) setPixel(px, py, fill)
    }
  }

  function circle(cx, cy, radius, fill) {
    const centerX = point(cx)
    const centerY = point(cy)
    const scaledRadius = point(radius)
    const radiusSquared = scaledRadius ** 2
    for (let y = centerY - scaledRadius; y <= centerY + scaledRadius; y++) {
      for (let x = centerX - scaledRadius; x <= centerX + scaledRadius; x++) {
        if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radiusSquared) setPixel(x, y, fill)
      }
    }
  }

  function polygon(points, fill) {
    const scaled = points.map(([x, y]) => [point(x), point(y)])
    const minY = Math.floor(Math.min(...scaled.map(([, y]) => y)))
    const maxY = Math.ceil(Math.max(...scaled.map(([, y]) => y)))
    for (let y = minY; y <= maxY; y++) {
      const intersections = []
      for (let index = 0; index < scaled.length; index++) {
        const [x1, y1] = scaled[index]
        const [x2, y2] = scaled[(index + 1) % scaled.length]
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          intersections.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
        }
      }
      intersections.sort((a, b) => a - b)
      for (let index = 0; index < intersections.length; index += 2) {
        for (let x = Math.ceil(intersections[index]); x <= Math.floor(intersections[index + 1]); x++) {
          setPixel(x, y, fill)
        }
      }
    }
  }

  function line(x1, y1, x2, y2, thickness, fill) {
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.sqrt(dx * dx + dy * dy)
    const nx = -dy / length * thickness / 2
    const ny = dx / length * thickness / 2
    polygon([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], fill)
  }

  rect(0, 0, 512, 512, color(surface))

  if (surface === 'admin') {
    polygon([[92, 195], [256, 94], [420, 195], [393, 225], [256, 142], [119, 225]], color('white'))
    rect(112, 211, 288, 42, color('white'))
    rect(137, 253, 54, 139, color('white'))
    rect(321, 253, 54, 139, color('white'))
    rect(112, 365, 288, 36, color('gold'))
    circle(390, 125, 59, color('student'))
    polygon([[390, 78], [350, 164], [374, 164], [383, 143], [417, 143], [426, 164], [450, 164], [410, 78]], color('white'))
    rect(380, 124, 40, 15, color('student'))
  } else if (surface === 'platform') {
    const nodes = [[256, 116], [128, 218], [384, 218], [172, 368], [340, 368]]
    for (const [x, y] of nodes) line(256, 254, x, y, 24, color('white'))
    for (const [x, y] of nodes) {
      circle(x, y, 43, color('white'))
      circle(x, y, 19, color('platformDark'))
    }
    circle(256, 254, 82, color('gold'))
    rect(222, 203, 28, 103, color('platformDark'))
    circle(265, 231, 35, color('platformDark'))
    circle(265, 231, 16, color('gold'))
    rect(244, 247, 28, 18, color('gold'))
  } else {
    circle(256, 172, 67, color('white'))
    circle(276, 154, 57, color('white'))
    polygon([[119, 403], [139, 329], [181, 272], [226, 245], [286, 245], [331, 272], [373, 329], [393, 403]], color('white'))
    polygon([[201, 248], [256, 307], [311, 248], [285, 238], [256, 271], [227, 238]], color('studentDark'))
    rect(148, 323, 216, 36, color('gold'))
    rect(242, 323, 28, 86, color('studentDark'))
  }

  const output = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const totals = [0, 0, 0, 0]
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const source = ((y * scale + sy) * width + x * scale + sx) * 4
          for (let channel = 0; channel < 4; channel++) totals[channel] += pixels[source + channel]
        }
      }
      const target = (y * size + x) * 4
      for (let channel = 0; channel < 4; channel++) output[target + channel] = Math.round(totals[channel] / (scale * scale))
    }
  }
  return encodePng(size, size, output)
}

for (const surface of ['admin', 'platform', 'student']) {
  for (const size of [180, 192, 512]) {
    await writeFile(join(projectRoot, 'public', `${surface}-pwa-icon-${size}.png`), renderIcon(size, surface))
  }
  await writeFile(join(projectRoot, 'public', `${surface}-pwa-icon-maskable-512.png`), renderIcon(512, surface))
}
