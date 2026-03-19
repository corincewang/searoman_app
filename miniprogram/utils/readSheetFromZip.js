/**
 * 从 xlsx(zip) 中按 UTF-8 读取 sharedStrings 与第一张 sheet，转成与 sheet_to_json(header:1) 同格式的二维数组。
 * 与 CSV 相同：仅用 UTF-8 解码，保证中文正确。
 */

function decodeUtf8(u8) {
  if (!u8 || !u8.length) return ''
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(u8)
  const arr = new Uint8Array(u8)
  let s = ''
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i])
  return s
}

function unescapeXml(s) {
  if (!s) return ''
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
}

/** 解析 xl/sharedStrings.xml 得到字符串数组；兼容带命名空间前缀的 si/t 标签 */
function parseSharedStringsXml(xmlStr) {
  const list = []
  if (!xmlStr || typeof xmlStr !== 'string') return list
  const siReg = /<(?:[\w]+:)?si>([\s\S]*?)<\/(?:[\w]+:)?si>/gi
  let m
  while ((m = siReg.exec(xmlStr)) !== null) {
    const block = m[1]
    const parts = []
    const tAll = block.match(/<(?:[\w]+:)?t[^>]*>([\s\S]*?)<\/(?:[\w]+:)?t>/g)
    if (tAll) {
      tAll.forEach((tag) => {
        const inner = tag.replace(/<(?:[\w]+:)?t[^>]*>|<\/(?:[\w]+:)?t>/g, '')
        parts.push(unescapeXml(inner))
      })
    }
    list.push(parts.join(''))
  }
  return list
}

/** 单元格引用 "A1" -> { col: 0, row: 0 }，行在 XML 里为 1-based */
function cellRefToRowCol(ref) {
  if (!ref || typeof ref !== 'string') return { row: 0, col: 0 }
  const match = ref.match(/^([A-Z]+)(\d+)$/i)
  if (!match) return { row: 0, col: 0 }
  let col = 0
  const letters = match[1].toUpperCase()
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64)
  }
  col--
  const row = parseInt(match[2], 10) - 1
  return { row, col }
}

/** 解析区域 "A1:B2" -> { minRow, maxRow, minCol, maxCol } */
function parseRefRange(refStr) {
  const parts = (refStr || '').split(':')
  const start = cellRefToRowCol(parts[0])
  const end = parts[1] ? cellRefToRowCol(parts[1]) : start
  return {
    minRow: Math.min(start.row, end.row),
    maxRow: Math.max(start.row, end.row),
    minCol: Math.min(start.col, end.col),
    maxCol: Math.max(start.col, end.col)
  }
}

/** 从 sheet XML 解析 <mergeCells>，返回 ref 数组 */
function parseMergeCells(xmlStr) {
  const list = []
  if (!xmlStr || typeof xmlStr !== 'string') return list
  const reg = /<(?:[\w]+:)?mergeCell[^>]*ref="([^"]+)"[^>]*\/?>/gi
  let m
  while ((m = reg.exec(xmlStr)) !== null) list.push(m[1].trim())
  return list
}

/** 把合并区域左上角的值填满整个区域 */
function applyMergeRanges(grid, mergeRefs) {
  mergeRefs.forEach((refStr) => {
    const { minRow, maxRow, minCol, maxCol } = parseRefRange(refStr)
    const val = grid[minRow] && grid[minRow][minCol]
    if (val === undefined) return
    for (let r = minRow; r <= maxRow; r++) {
      if (!grid[r]) grid[r] = {}
      for (let c = minCol; c <= maxCol; c++) {
        grid[r][c] = val
      }
    }
  })
}

/** 从单元格内容块中取 <v> 或 <is><t> 的文本 */
function getCellValue(block, type, sharedStrings) {
  const vMatch = block.match(/<v>([\s\S]*?)<\/v>/i) || block.match(/<(?:[\w]+:)?v>([\s\S]*?)<\/(?:[\w]+:)?v>/i)
  const rawVal = vMatch ? vMatch[1].replace(/<[^>]+>/g, '').trim() : ''
  const idx = parseInt(rawVal, 10)
  const isSharedStrType = type === 's' || type === 'str'
  if ((isSharedStrType || (type === '' && !isNaN(idx) && idx >= 0 && idx < (sharedStrings.length || 0))) && sharedStrings.length) {
    if (!isNaN(idx) && idx >= 0 && idx < sharedStrings.length) return sharedStrings[idx]
  }
  if (type === 'inlinestr' || type === 'inlineStr') {
    const tags = block.match(/<(?:[\w]+:)?t[^>]*>([\s\S]*?)<\/(?:[\w]+:)?t>/gi) || []
    if (tags.length) {
      return tags.map((tag) => {
        const inner = tag.replace(/<(?:[\w]+:)?t[^>]*>|<\/(?:[\w]+:)?t>/g, '')
        return unescapeXml(inner)
      }).join('')
    }
  }
  if (type !== 's' && type !== 'str') {
    const num = parseFloat(rawVal)
    if (!isNaN(num) && rawVal !== '') return num
  }
  return rawVal
}

/** 从 <c ...> 属性串里取出 r 和 t（属性顺序任意） */
function parseCellAttrs(attrStr) {
  const rMatch = (attrStr || '').match(/\br="([^"]+)"/i)
  const tMatch = (attrStr || '').match(/\bt="([^"]*)"/i)
  return { ref: rMatch ? rMatch[1] : '', type: (tMatch ? tMatch[1] : '').toLowerCase() }
}

/** 解析 xl/worksheets/sheet1.xml 得到二维数组 rows[row][col]；兼容无命名空间、合并单元格 */
function parseSheetXml(xmlStr, sharedStrings) {
  const grid = {}
  if (!xmlStr || typeof xmlStr !== 'string') return []
  const mergeRefs = parseMergeCells(xmlStr)
  const rowReg = /<(?:[\w]+:)?row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:[\w]+:)?row>/gi
  let rowM
  while ((rowM = rowReg.exec(xmlStr)) !== null) {
    const rowContent = rowM[2]
    const cellBlockReg = /<(?:[\w]+:)?c([^>]*)>([\s\S]*?)<\/(?:[\w]+:)?c>/gi
    let cellM
    while ((cellM = cellBlockReg.exec(rowContent)) !== null) {
      const attrs = parseCellAttrs(cellM[1])
      const inner = cellM[2] || ''
      const { row, col } = cellRefToRowCol(attrs.ref)
      const value = getCellValue(inner, attrs.type, sharedStrings)
      if (!grid[row]) grid[row] = {}
      grid[row][col] = value
    }
  }
  applyMergeRanges(grid, mergeRefs)
  const rows = []
  const rowIndices = Object.keys(grid)
    .map(Number)
    .sort((a, b) => a - b)
  rowIndices.forEach((r) => {
    const rowObj = grid[r]
    const maxCol = Math.max(...Object.keys(rowObj).map(Number))
    const rowArr = []
    for (let c = 0; c <= maxCol; c++) rowArr[c] = rowObj[c] !== undefined ? rowObj[c] : ''
    rows.push(rowArr)
  })
  return rows
}

function getZipFile(zip, path) {
  if (!zip || !zip.files) return null
  const f = zip.files[path] || zip.files[path.replace(/\//g, '\\')]
  return f && !f.dir ? f : null
}

function readEntryAsUint8Array(entry) {
  if (!entry) return Promise.resolve(null)
  return entry.async('uint8array').catch(() => entry.async('arraybuffer').then((ab) => new Uint8Array(ab)))
}

/** 获取第一张 sheet 的路径（xl/worksheets/sheet1.xml） */
function getFirstSheetPath(zip) {
  const wbRels = getZipFile(zip, 'xl/_rels/workbook.xml.rels')
  const wb = getZipFile(zip, 'xl/workbook.xml')
  if (!wbRels || !wb) return 'xl/worksheets/sheet1.xml'
  return Promise.all([
    readEntryAsUint8Array(wbRels).then((u8) => (u8 ? decodeUtf8(u8) : '')),
    readEntryAsUint8Array(wb).then((u8) => (u8 ? decodeUtf8(u8) : ''))
  ]).then(([relsStr, wbStr]) => {
    const sheetRIdMatch = wbStr.match(/<sheet[^>]+r:id="(rId\d+)"[^>]*>/i) || wbStr.match(/<sheet[^>]+r:id="(rId\d+)"\/?>/i)
    const rId = sheetRIdMatch ? sheetRIdMatch[1] : 'rId1'
    const relMatch = relsStr.match(new RegExp('Id=["\']' + rId + '["\'][^>]*Target=["\']([^"\']+)["\']', 'i')) ||
      relsStr.match(new RegExp('Target=["\']([^"\']+)["\'][^>]*Id=["\']' + rId + '["\']', 'i'))
    let target = relMatch ? relMatch[1].replace(/^\.\.\//, '').replace(/\\/g, '/') : 'worksheets/sheet1.xml'
    if (target.indexOf('xl/') !== 0) target = 'xl/' + target
    return target
  })
}

/**
 * 从 JSZip 实例读取第一张 sheet，返回与 XLSX.utils.sheet_to_json(sheet, { header: 1 }) 同格式的二维数组。
 * 内部对 sharedStrings 与 sheet XML 做编码识别与 UTF-8/GBK 解码后再解析，避免中文乱码。
 * @param {Object} zip - JSZip.loadAsync(base64, { base64: true }) 的返回值
 * @returns {Promise<Array<Array>>} rows
 */
function readSheetFromZip(zip) {
  if (!zip || !zip.files) return Promise.resolve([])

  const ssEntry = getZipFile(zip, 'xl/sharedStrings.xml')
  const readSs = ssEntry
    ? readEntryAsUint8Array(ssEntry).then((u8) => (u8 ? decodeUtf8(u8) : ''))
    : Promise.resolve('')

  return readSs.then((sharedStringsXml) => {
    const sharedStrings = parseSharedStringsXml(sharedStringsXml)
    if (typeof console !== 'undefined') {
      console.log('[readSheetFromZip] sharedStrings 数量:', sharedStrings.length, '前5条:', sharedStrings.slice(0, 5))
    }
    return getFirstSheetPath(zip).then((sheetPath) => {
      if (typeof console !== 'undefined') console.log('[readSheetFromZip] sheet 路径:', sheetPath)
      const sheetEntry = getZipFile(zip, sheetPath)
      if (!sheetEntry) return []
      return readEntryAsUint8Array(sheetEntry).then((u8) => {
        const sheetStr = u8 ? decodeUtf8(u8) : ''
        const rows = parseSheetXml(sheetStr, sharedStrings)
        if (typeof console !== 'undefined') {
          console.log('[readSheetFromZip] 解析出行数:', rows.length, '原始行(前5行):', JSON.stringify(rows.slice(0, 5)))
        }
        return rows
      })
    })
  }).catch((e) => {
    if (typeof console !== 'undefined') console.log('[readSheetFromZip] 出错:', e)
    return []
  })
}

module.exports = {
  readSheetFromZip,
  parseSharedStringsXml,
  parseSheetXml
}
