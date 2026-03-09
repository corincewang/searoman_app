const { parseSheetRows } = require('../../utils/excelParser.js')

let XLSX
try {
  XLSX = require('../../utils/xlsx.mini.min.js')
} catch (e) {
  try {
    XLSX = require('xlsx')
  } catch (e2) {
    XLSX = null
  }
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
    const name = e.currentTarget.dataset.name
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
    if (!XLSX) {
      wx.showToast({
        title: '请将 xlsx.mini.min.js 放入 utils 目录',
        icon: 'none'
      })
      return
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: (res) => {
        const path = res.tempFiles[0].path
        this.setData({ parsing: true })
        wx.getFileSystemManager().readFile({
          filePath: path,
          encoding: 'base64',
          success: (e) => {
            try {
              const wb = XLSX.read(e.data, { type: 'base64' })
              const firstSheetName = wb.SheetNames[0]
              const sheet = wb.Sheets[firstSheetName]
              const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
              const products = parseSheetRows(rows)
              if (!products.length) {
                wx.showToast({ title: '未解析到有效数据行', icon: 'none' })
                this.setData({ parsing: false })
                return
              }
              const app = getApp()
              app.globalData.products = products
              wx.showToast({ title: `已解析 ${products.length} 条` })
              wx.switchTab({ url: '/pages/list/list' })
            } catch (err) {
              wx.showToast({ title: '解析失败', icon: 'none' })
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
