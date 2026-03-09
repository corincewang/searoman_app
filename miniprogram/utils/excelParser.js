/**
 * 装箱单 Excel 解析器
 * 输入：表头在第 3 行（0-based index 2），数据从第 5 行起（0-based 4）；第 1-2 行为说明保留
 * 输出：商品对象数组，可直接用于淘宝式列表/详情/购物车
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

/**
 * 判断是否为“示例行”（跳过不进入商品列表）
 * @param {object} rowObj - 本行解析后的对象
 * @returns {boolean}
 */
function isExampleRow(rowObj) {
  return !!rowObj._exampleFlag
}

/**
 * 单行数组 → 按 schema 转成商品对象
 * @param {Array} row - 一行单元格数组
 * @param {Array} columns - schema.columns
 * @returns {object}
 */
function rowToProduct(row, columns) {
  const product = {
    id: null, // 解析后可生成：shopNo + itemNo + color + size 等组合唯一 id
    uploadedAt: null // 可选：上传时间，用于“按时间排序/近一周新品”
  }
  columns.forEach(col => {
    const raw = row[col.index]
    let value
    if (col.type === 'number') {
      value = parseNumber(raw)
    } else {
      value = parseString(raw)
    }
    product[col.key] = value
  })
  // 自动计算总数量、金额、体积（若 Excel 未填）
  if (product.totalQty == null && product.cartons != null && product.pcsInCarton != null) {
    product.totalQty = product.cartons * product.pcsInCarton
  }
  if (product.amount == null && product.totalQty != null && product.price != null) {
    product.amount = Math.round(product.totalQty * product.price * 100) / 100
  }
  if (product.cubeM3 == null && product.cartonLongCm != null && product.cartonWideCm != null && product.cartonHighCm != null) {
    product.cubeM3 = Math.round((product.cartonLongCm * product.cartonWideCm * product.cartonHighCm) / 1000000 * 100) / 100
  }
  // 生成唯一 id（用于列表/购物车 key）
  product.id = [product.shopNo, product.itemNo, product.color, product.size].filter(Boolean).join('_') || `row_${Date.now()}_${Math.random().toString(36).slice(2)}`
  return product
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
  const columns = schema.columns.filter(c => c.key !== '_exampleFlag')

  const result = []
  if (!rows || rows.length <= dataStartRowIndex) return result

  for (let i = dataStartRowIndex; i < rows.length; i++) {
    const row = rows[i] || []
    const product = rowToProduct(row, schema.columns)
    if (isExampleRow(product)) continue
    // 跳过空行：至少要有名称或货号
    if (!product.nameCn && !product.itemNo) continue
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
  parseString
}
