const { parseSheetRows } = require('../../utils/excelParser.js')
const { translateBatch } = require('../../utils/translate.js')

let XLSX
try {
  XLSX = require('../../utils/xlsx.mini.min.js')
} catch (e) {
  XLSX = null
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
          encoding: 'base64',
          success: (e) => {
            try {
              const wb = XLSX.read(e.data, { type: 'base64' })
              const firstSheetName = wb.SheetNames[0]
              const sheet = wb.Sheets[firstSheetName]
              const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
              let products = parseSheetRows(rows, { headerRowIndex: 0, dataStartRowIndex: 1 })
              if (!products.length && rows.length > 2) {
                products = parseSheetRows(rows, { headerRowIndex: 0, dataStartRowIndex: 2 })
              }
              if (!products.length && rows.length > 3) {
                products = parseSheetRows(rows, { headerRowIndex: 1, dataStartRowIndex: 3 })
              }
              if (!products.length) {
                wx.showToast({ title: '未解析到有效数据行，请确认表头在第1行、数据从第2行起', icon: 'none' })
                this.setData({ parsing: false })
                return
              }
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
            } catch (err) {
              wx.showToast({ title: '解析失败：' + (err.message || '未知错误'), icon: 'none' })
            }
            this.setData({ parsing: false })
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
