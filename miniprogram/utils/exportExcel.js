/**
 * 购物车导出为装箱单格式 Excel（Step 7）
 * 小程序端需将 xlsx.mini.min.js 放入 utils 目录使用，见 README 或 PLAN
 */
let XLSX
try {
  XLSX = require('./xlsx.mini.min.js')
} catch (e) {
  try {
    XLSX = require('xlsx')
  } catch (e2) {
    throw new Error('请将 xlsx.mini.min.js 放入 miniprogram/utils 目录，或在小程序开发者工具中构建 npm 使用 xlsx')
  }
}

const schema = require('./excelSchema.js')

/** 表头行（与装箱单模板一致，排除 _exampleFlag） */
function getHeaderRow() {
  return schema.columns
    .filter(c => c.key !== '_exampleFlag')
    .map(c => c.header)
}

/** 商品对象转 Excel 行（与 schema 列顺序一致） */
function productToRow(item) {
  const cols = schema.columns.filter(c => c.key !== '_exampleFlag')
  const row = []
  cols.forEach(col => {
    let val = item[col.key]
    if (val == null) val = ''
    if (col.type === 'number' && val !== '') {
      const n = Number(val)
      row.push(isNaN(n) ? val : n)
    } else {
      row.push(String(val))
    }
  })
  return row
}

/**
 * 将购物车商品列表生成为 Excel 二进制（ArrayBuffer）
 * @param {Array} items - 购物车商品列表（与解析后的 product 结构一致）
 * @returns {{ buffer: ArrayBuffer, base64: string }}
 */
function buildCartExcel(items) {
  const header = getHeaderRow()
  const rows = items.map(productToRow)
  const data = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '装箱单')
  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
  const buffer = base64ToArrayBuffer(base64)
  return { buffer, base64 }
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

module.exports = {
  getHeaderRow,
  productToRow,
  buildCartExcel,
  base64ToArrayBuffer
}
