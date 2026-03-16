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

Page({
  data: {
    parsing: false,
    exportedFiles: []
  },

  onLoad() {},

  onShow() {
    const app = getApp()
    const list = (app.globalData.exportedFiles || []).map(item => ({
      ...item,
      timeStr: formatTime(item.time)
    }))
    this.setData({ exportedFiles: list })
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

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: (res) => {
        const filePath = res.tempFiles[0].path
        const fileName = (res.tempFiles[0].name || '').toLowerCase()
        if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
          wx.showToast({ title: '请选择 xlsx 或 xls 文件', icon: 'none' })
          return
        }
        if (!XLSX) {
          wx.showToast({ title: '请将 xlsx.mini.min.js 放入 utils 目录', icon: 'none' })
          return
        }
        this.setData({ parsing: true })
        wx.getFileSystemManager().readFile({
          filePath,
          success: (e) => {
            try {
              const ab = e.data
              if (!ab || !ab.byteLength) {
                wx.showToast({ title: '读取文件为空', icon: 'none' })
                this.setData({ parsing: false })
                return
              }
              const base64ForZip = arrayBufferToBase64(ab)
              const dataStartRowIndex = schema.dataStartRowIndex ?? 1
              const photoCol = 1
              const doTranslateAndFinish = () => {
                wx.showLoading({ title: '正在翻译商品名称…' })
                const nameCnList = products.map(p => p.nameCn || '')
                translateBatch(nameCnList, (enList) => {
                  products.forEach((p, i) => { p.nameEn = (enList[i] || '').trim() || '' })
                  const app = getApp()
                  app.globalData.products = products
                  try { wx.setStorageSync('products', products) } catch (err) {}
                  wx.hideLoading()
                  wx.showToast({ title: `已解析 ${products.length} 条` })
                  wx.switchTab({ url: '/pages/list/list' })
                  this.setData({ parsing: false })
                })
              }
              let products
              const finishWithRows = (rows) => {
                if (!rows || !rows.length) {
                  wx.showToast({ title: '未解析到有效数据行，请确认表头在第1行、数据从第2行起', icon: 'none' })
                  this.setData({ parsing: false })
                  return
                }
                products = parseSheetRows(rows, { headerRowIndex: 0, dataStartRowIndex: 1 })
                if (!products.length && rows.length > 2) products = parseSheetRows(rows, { headerRowIndex: 0, dataStartRowIndex: 2 })
                if (!products.length && rows.length > 3) products = parseSheetRows(rows, { headerRowIndex: 1, dataStartRowIndex: 3 })
                if (!products.length) {
                  wx.showToast({ title: '未解析到有效数据行，请确认表头在第1行、数据从第2行起', icon: 'none' })
                  this.setData({ parsing: false })
                  return
                }
                if (!JSZip) {
                  doTranslateAndFinish()
                  return
                }
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
                const arr = new Uint8Array(ab)
                const wb = XLSX.read(arr, { type: 'array', codepage: 65001 })
                const sheet = wb.Sheets[wb.SheetNames[0]]
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
                finishWithRows(rows)
              }
            } catch (err) {
              wx.showToast({ title: '解析失败：' + (err.message || '未知错误'), icon: 'none' })
              this.setData({ parsing: false })
            }
          },
          fail: () => {
            this.setData({ parsing: false })
            wx.showToast({ title: '读取文件失败', icon: 'none' })
          }
        })
      }
    })
  }
})
