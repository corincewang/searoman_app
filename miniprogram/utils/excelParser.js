/**
 * 装箱单 Excel 解析器
 * 输入：默认表头第 1 行（index 0）、数据第 2 行起（index 1）；可通过 options 覆盖
 * 输出：商品对象数组（含 quotationDate、en71CertNo 等），可直接用于列表/详情/购物车
 */

const schema = require('./excelSchema.js')

/**
 * 从单元格值解析数字（去掉 ¥、逗号、单位）
 * @param {*} val - 单元格值
 * @returns {number|null}
 */
function parseNumber(val) {
  if (val == null || val === '') return null
  if (typeof val === 'number' && !isNaN(val)) return val
  const s = String(val).replace(/[¥,\s]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

/**
 * 从单元格值解析字符串
 * @param {*} val
 * @returns {string}
 */
function parseString(val) {
  if (val == null) return ''
  return String(val).trim()
}

function cleanCellText(val) {
  if (val == null) return ''
  return String(val)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 清理商品名称中的 XML/HTML 实体与换行噪声（如 &#10;）。
 * nameCn 优先保留中文主文本，避免把原表里附带的英文行拼进中文名。
 */
function cleanNameText(val, preferChinese) {
  if (val == null) return ''
  let s = String(val)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/&#\d+;?/g, '')
    .replace(/&#x[0-9a-fA-F]+;?/g, '')

  // 如果单元格里混了中英文两行，中文名只取包含中文的那一行
  if (preferChinese) {
    const parts = s.split(/\n+/).map(x => x.trim()).filter(Boolean)
    const chineseLine = parts.find(x => /[\u4e00-\u9fff]/.test(x))
    if (chineseLine) s = chineseLine
  }

  return s.replace(/\s+/g, ' ').trim()
}

/**
 * 判断是否为“示例行”（跳过不进入商品列表，仅当 schema 含 _exampleFlag 时有效）
 */
function isExampleRow(rowObj) {
  return rowObj.hasOwnProperty('_exampleFlag') && !!rowObj._exampleFlag
}

/**
 * 根据表头行推断列索引映射（表头与 schema 不一致时用）
 * @param {Array} headerRow - 表头行
 * @param {Array} columns - schema.columns
 * @returns {Object|null} key -> index，若匹配到的列不足则返回 null 表示用 schema 固定 index
 */
function buildColumnMapFromHeader(headerRow, columns) {
  if (!headerRow || !Array.isArray(headerRow) || !columns.length) return null
  const map = {}
  const headerStr = (i) => String(headerRow[i] ?? '').trim().toLowerCase()
  for (const col of columns) {
    if (!col.key || col.key[0] === '_') continue
    const label = (col.label || '').trim()
    const header = (col.header || '').trim()
    const headerLow = header.toLowerCase()
    for (let i = 0; i < headerRow.length; i++) {
      const cell = String(headerRow[i] ?? '').trim()
      const cellLow = cell.toLowerCase().replace(/\s+/g, '')
      if (label && cell.indexOf(label) >= 0) { map[col.key] = i; break }
      if (headerLow && cellLow.indexOf(headerLow.replace(/\s+/g, '').slice(0, 8)) >= 0) { map[col.key] = i; break }
      const firstWord = headerLow.split(/\s+/)[0]
      if (firstWord && firstWord.length >= 2 && cellLow.indexOf(firstWord) >= 0) { map[col.key] = i; break }
    }
    if (map[col.key] == null) map[col.key] = col.index
  }
  return map
}

/**
 * 单行数组 → 按 schema 转成商品对象
 * @param {Array} row - 一行单元格数组
 * @param {Array} columns - schema.columns
 * @param {Object} [colMap] - 可选，key -> 列 index，不传则用 col.index
 * @returns {object}
 */
function rowToProduct(row, columns, colMap) {
  const product = {
    id: null,
    uploadedAt: null
  }
  columns.forEach(col => {
    let idx = (colMap && colMap[col.key] != null) ? colMap[col.key] : col.index
    if (col.key === 'nameCn') idx = 1
    if (col.key === 'price') idx = 9
    const raw = row[idx]
    let value
    if (col.type === 'number') {
      value = parseNumber(raw)
      if (col.key === 'price' && value == null && raw != null) value = parseNumber(String(raw).replace(/[¥,\s]/g, ''))
      if (col.key === 'price' && value == null) value = parseNumber(row[8]) || parseNumber(row[10])
      if (col.key === 'price' && value == null) {
        // 避免误抓到体积等小数列：仅在价格附近列做兜底扫描
        const nearPriceCols = [7, 8, 9, 10, 11, 12]
        for (let k = 0; k < nearPriceCols.length; k++) {
          const j = nearPriceCols[k]
          if (j < 0 || j >= row.length) continue
          const n = parseNumber(row[j])
          if (n != null && n >= 0.01 && n <= 10000) { value = n; break }
        }
      }
    } else {
      value = cleanCellText(parseString(raw))
      if (col.key === 'nameCn') value = cleanNameText(value, true)
      if (col.key === 'nameEn') value = cleanNameText(value, false)
    }
    product[col.key] = value
  })
  if (product.quotationDate === undefined) product.quotationDate = ''
  if (product.en71CertNo === undefined) product.en71CertNo = ''
  // 订货箱数/数量/金额：解析时一律默认为 0，由客户在详情页从 0 往上加
  product.cartons = 0
  product.totalQty = 0
  product.amount = 0
  // 体积等仍按 Excel 计算（若未填）
  if (product.cubeM3 == null && product.cartonLongCm != null && product.cartonWideCm != null && product.cartonHighCm != null) {
    product.cubeM3 = Math.round((product.cartonLongCm * product.cartonWideCm * product.cartonHighCm) / 1000000 * 100) / 100
  }
  // 生成唯一 id（用于列表/购物车 key）
  product.id = [product.shopNo, product.itemNo, product.color, product.size].filter(Boolean).join('_') || `row_${Date.now()}_${Math.random().toString(36).slice(2)}`
  return product
}

/** 中文列（含货号、证书、规格、颜色、材质）用 zip；index 1 用 zip（图片/中文名都在此列，名字从 index 1 读） */
const CHINESE_COLUMNS = [2, 3, 5, 6, 7, 8]
const PHOTO_COLUMN_INDEX = 1

/**
 * 合并 zip 解析行与 xlsx 解析行：index 1 和中文列（含货号）用 zip；其余列用 xlsx。合并后名字在 index 1。
 * @param {Array<Array>} zipRows - readSheetFromZip 得到的二维数组（UTF-8 XML）
 * @param {Array<Array>} xlsxRows - XLSX.utils.sheet_to_json(header:1) 得到的二维数组
 * @returns {Array<Array>} 合并后的二维数组
 */
function mergeZipAndXlsxRows(zipRows, xlsxRows) {
  if (!zipRows && !xlsxRows) return []
  const zip = zipRows || []
  const xlsx = xlsxRows || []
  const maxRows = Math.max(zip.length, xlsx.length)
  const result = []
  for (let r = 0; r < maxRows; r++) {
    const zipRow = zip[r] || []
    const xlsxRow = xlsx[r] || []
    const maxCols = Math.max(zipRow.length, xlsxRow.length)
    const row = []
    for (let c = 0; c < maxCols; c++) {
      if (c === PHOTO_COLUMN_INDEX || CHINESE_COLUMNS.indexOf(c) >= 0) {
        row[c] = zipRow[c] !== undefined && zipRow[c] !== '' ? zipRow[c] : (c === PHOTO_COLUMN_INDEX ? '' : xlsxRow[c])
      } else {
        // xlsx 对合并单元格的非首行可能返回空串；空串时回退到 zip（zip 已做合并填充）
        row[c] = xlsxRow[c] !== undefined && xlsxRow[c] !== '' ? xlsxRow[c] : zipRow[c]
      }
    }
    result.push(row)
  }
  return result
}

/**
 * 解析 Excel 表数据（二维数组）为商品列表
 * @param {Array<Array>} rows - 整个 sheet 的二维数组，行=数组，列=单元格
 * @param {object} options - { headerRowIndex, dataStartRowIndex } 不传则用 schema 默认值
 * @returns {Array<object>} 商品对象数组
 */
function parseSheetRows(rows, options = {}) {
  const headerRowIndex = options.headerRowIndex ?? schema.headerRowIndex
  const dataStartRowIndex = options.dataStartRowIndex ?? schema.dataStartRowIndex
  const columns = schema.columns.filter(c => c.key && c.key[0] !== '_')

  const result = []
  if (!rows || rows.length <= dataStartRowIndex) return result

  const headerRow = rows[headerRowIndex] || []
  const colMap = buildColumnMapFromHeader(headerRow, schema.columns)
  let lastNonNullPrice = null

  for (let i = dataStartRowIndex; i < rows.length; i++) {
    const row = rows[i] || []
    const product = rowToProduct(row, schema.columns, colMap)
    if (isExampleRow(product)) continue
    if (!product.nameCn && !product.itemNo) continue

    // Excel 合并单元格（价格跨多行）场景：空价格沿用上一条非空价格
    if (product.price == null && lastNonNullPrice != null) {
      product.price = lastNonNullPrice
    } else if (product.price != null) {
      lastNonNullPrice = product.price
    }

    product.uploadedAt = product.uploadedAt || Date.now()
    result.push(product)
  }
  return result
}

/**
 * 供外部用 xlsx 读到的 sheet 调用
 * @param {object} sheet - xlsx 库返回的 sheet 对象（如 XLSX.utils.sheet_to_json(sheet, { header: 1 }) 得到二维数组）
 * @param {object} options
 * @returns {Array<object>}
 */
function parseSheet(sheet, options = {}) {
  let rows = sheet
  if (!Array.isArray(sheet) || (sheet.length && !Array.isArray(sheet[0]))) {
    return []
  }
  return parseSheetRows(rows, options)
}

module.exports = {
  schema,
  parseSheetRows,
  parseSheet,
  rowToProduct,
  parseNumber,
  parseString,
  mergeZipAndXlsxRows
}
