;(function () {
  if (typeof setImmediate !== 'undefined') return
  var fn = function (f) { return setTimeout(f, 0) }
  try { if (typeof global !== 'undefined') global.setImmediate = fn } catch (e) {}
  try { if (typeof globalThis !== 'undefined') globalThis.setImmediate = fn } catch (e) {}
  try { if (typeof self !== 'undefined') self.setImmediate = fn } catch (e) {}
  try { var g = (function () { return this })(); if (g) g.setImmediate = fn } catch (e) {}
})()

const { parseSheetRows, mergeZipAndXlsxRows } = require('../../utils/excelParser.js')
const { translateBatch } = require('../../utils/translate.js')
const { extractFloatingImagesFromJSZip } = require('../../utils/extractFloatingImagesFromZip.js')
const { readSheetFromZip } = require('../../utils/readSheetFromZip.js')
const { convertProductPhotosToLocalPaths } = require('../../utils/photoUtil.js')
const { inspectXlsxXlFolder } = require('../../utils/inspectXlsxZip.js')
const schema = require('../../utils/excelSchema.js')

let XLSX
try {
  XLSX = require('../../utils/xlsx.mini.min.js')
} catch (e) {
  XLSX = null
}

let JSZip
try {
  JSZip = require('jszip')
} catch (e) {
  JSZip = null
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

/** ArrayBuffer 转二进制字符串，供 XLSX.read(..., { type: 'binary' }) 使用 */
function arrayBufferToBinary(ab) {
  if (!ab || !ab.byteLength) return ''
  const u8 = new Uint8Array(ab)
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return s
}

/** ArrayBuffer 转 base64，供 JSZip.loadAsync 使用 */
function arrayBufferToBase64(ab) {
  if (!ab || !ab.byteLength) return ''
  const u8 = new Uint8Array(ab)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let s = ''
  for (let i = 0; i < u8.length; i += 3) {
    const a = u8[i]
    const b = u8[i + 1]
    const c = u8[i + 2]
    s += chars[a >> 2]
    s += chars[((a & 3) << 4) | (b >> 4)]
    s += b !== undefined ? chars[((b & 15) << 2) | (c >> 6)] : '='
    s += c !== undefined ? chars[c & 63] : '='
  }
  return s
}

function cleanTranslatedName(val) {
  if (val == null) return ''
  return String(val)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/\\n/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

Page({
  data: {
    parsing: false,
    importProgress: 0,
    importStatusText: '',
    exportedFiles: [],
    importHistory: []
  },

  onLoad() {},

  onShow() {
    const app = getApp()
    const list = (app.globalData.exportedFiles || []).map(item => ({
      ...item,
      timeStr: formatTime(item.time)
    }))
    const importHistory = (app.globalData.productImportBatches || []).map(item => ({
      ...item,
      timeStr: formatTime(item.time)
    }))
    this.setData({ exportedFiles: list, importHistory })
  },

  openExported(e) {
    const path = e.currentTarget.dataset.path
    if (!path) return
    wx.openDocument({
      filePath: path,
      fileType: 'xlsx',
      showMenu: true,
      fail: () => {
        wx.showToast({ title: '文件已失效或不存在', icon: 'none' })
      }
    })
  },

  _setImportProgress(progress, text) {
    this.setData({
      importProgress: Math.max(0, Math.min(100, Number(progress) || 0)),
      importStatusText: text || ''
    })
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: (res) => {
        const filePath = res.tempFiles[0].path
        const sourceFileName = res.tempFiles[0].name || `导入_${Date.now()}.xlsx`
        const lowerFileName = sourceFileName.toLowerCase()
        if (!lowerFileName.endsWith('.xlsx') && !lowerFileName.endsWith('.xls')) {
          wx.showToast({ title: '请选择 xlsx 或 xls 文件', icon: 'none' })
          return
        }
        if (!XLSX) {
          wx.showToast({ title: '请将 xlsx.mini.min.js 放入 utils 目录', icon: 'none' })
          return
        }
        this.setData({ parsing: true, importProgress: 5, importStatusText: '导入中：准备读取文件…' })
        wx.getFileSystemManager().readFile({
          filePath,
          success: (e) => {
            try {
              this._setImportProgress(20, '导入中：读取文件完成')
              const importTime = Date.now()
              const importId = `import_${importTime}_${Math.random().toString(36).slice(2)}`
              const ab = e.data
              if (!ab || !ab.byteLength) {
                wx.showToast({ title: '读取文件为空', icon: 'none' })
                this.setData({ parsing: false, importProgress: 0, importStatusText: '' })
                return
              }
              const base64ForZip = arrayBufferToBase64(ab)
              const dataStartRowIndex = schema.dataStartRowIndex ?? 1
              const photoCol = 1
              const doTranslateAndFinish = () => {
                this._setImportProgress(80, '导入中：正在处理商品名称…')
                const nameCnList = products.map(p => p.nameCn || '')
                translateBatch(nameCnList, (enList) => {
                  products.forEach((p, i) => { p.nameEn = cleanTranslatedName(enList[i] || '') || '' })
                  // 避免导入后 id 冲突：把“导入批次”前缀拼到每条记录的 id 前面
                  const newProducts = (products || []).map(p => ({
                    ...p,
                    id: `${importId}_${p.id}`,
                    batchId: importId,
                    sourceFileName,
                    uploadedAt: p.uploadedAt || importTime
                  }))

                  // 合并展示：追加到历史 products，而不是覆盖
                  let existed = []
                  try {
                    const saved = wx.getStorageSync('products')
                    if (Array.isArray(saved)) existed = saved
                  } catch (err) {}

                  const combined = existed.concat(newProducts)
                  const app = getApp()
                  app.globalData.products = combined
                  try { wx.setStorageSync('products', combined) } catch (err) {}

                  let batches = []
                  try {
                    const savedBatches = wx.getStorageSync('productImportBatches')
                    if (Array.isArray(savedBatches)) batches = savedBatches
                  } catch (err) {}
                  const newBatch = {
                    id: importId,
                    fileName: sourceFileName,
                    time: importTime,
                    count: newProducts.length
                  }
                  batches.unshift(newBatch)
                  app.globalData.productImportBatches = batches
                  app.globalData.pendingFocusBatchId = importId
                  try { wx.setStorageSync('productImportBatches', batches) } catch (err) {}
                  this._setImportProgress(100, '导入中：完成')
                  wx.showToast({ title: `已解析 ${products.length} 条` })
                  wx.switchTab({ url: '/pages/list/list' })
                  this.setData({ parsing: false, importProgress: 0, importStatusText: '' })
                })
              }
              let products
              const finishWithRows = (rows) => {
                if (!rows || !rows.length) {
                  wx.showToast({ title: '未解析到有效数据行，请确认表头在第1行、数据从第2行起', icon: 'none' })
                  this.setData({ parsing: false, importProgress: 0, importStatusText: '' })
                  return
                }
                this._setImportProgress(45, '导入中：正在解析表格…')
                products = parseSheetRows(rows, { headerRowIndex: 0, dataStartRowIndex: 1 })
                if (!products.length && rows.length > 2) products = parseSheetRows(rows, { headerRowIndex: 0, dataStartRowIndex: 2 })
                if (!products.length && rows.length > 3) products = parseSheetRows(rows, { headerRowIndex: 1, dataStartRowIndex: 3 })
                if (!products.length) {
                  wx.showToast({ title: '未解析到有效数据行，请确认表头在第1行、数据从第2行起', icon: 'none' })
                  this.setData({ parsing: false, importProgress: 0, importStatusText: '' })
                  return
                }
                if (!JSZip) {
                  this._setImportProgress(70, '导入中：正在整理数据…')
                  doTranslateAndFinish()
                  return
                }
                this._setImportProgress(60, '导入中：正在提取图片…')
                JSZip.loadAsync(base64ForZip, { base64: true })
                  .then((zip) => extractFloatingImagesFromJSZip(zip, dataStartRowIndex, photoCol))
                  .then((byDataIndex) => {
                    ;(byDataIndex || []).forEach((dataUrl, i) => {
                      if (dataUrl && products[i]) products[i].photo = dataUrl
                    })
                    convertProductPhotosToLocalPaths(products, doTranslateAndFinish)
                  })
                  .catch(() => doTranslateAndFinish())
              }
              if (JSZip) {
                const getXlsxRows = () => {
                  const arr = new Uint8Array(ab)
                  const wb = XLSX.read(arr, { type: 'array', codepage: 65001 })
                  const sheet = wb.Sheets[wb.SheetNames[0]]
                  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
                }
                this._setImportProgress(30, '导入中：正在读取工作表…')
                JSZip.loadAsync(base64ForZip, { base64: true })
                  .then((zip) => {
                    inspectXlsxXlFolder(base64ForZip, { maxXmlLen: 6000 }).then(() => {})
                    return Promise.all([readSheetFromZip(zip), Promise.resolve(zip)]).then(([rowsFromZip]) => ({ rowsFromZip }))
                  })
                  .then(({ rowsFromZip }) => {
                    const xlsxRows = getXlsxRows()
                    const merged = mergeZipAndXlsxRows(rowsFromZip, xlsxRows)
                    console.log('[upload] zip+xlsx 合并: zip行数=', rowsFromZip ? rowsFromZip.length : 0, 'xlsx行数=', xlsxRows.length, '合并后=', merged.length)
                    finishWithRows(merged.length ? merged : xlsxRows)
                  })
                  .catch(() => {
                    finishWithRows(getXlsxRows())
                  })
              } else {
                this._setImportProgress(35, '导入中：正在读取工作表…')
                const arr = new Uint8Array(ab)
                const wb = XLSX.read(arr, { type: 'array', codepage: 65001 })
                const sheet = wb.Sheets[wb.SheetNames[0]]
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
                finishWithRows(rows)
              }
            } catch (err) {
              wx.showToast({ title: '解析失败：' + (err.message || '未知错误'), icon: 'none' })
              this.setData({ parsing: false, importProgress: 0, importStatusText: '' })
            }
          },
          fail: () => {
            this.setData({ parsing: false, importProgress: 0, importStatusText: '' })
            wx.showToast({ title: '读取文件失败', icon: 'none' })
          }
        })
      }
    })
  }
})
