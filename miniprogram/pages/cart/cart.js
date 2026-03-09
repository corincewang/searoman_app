const { buildCartExcel } = require('../../utils/exportExcel.js')

Page({
  data: {
    items: []
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) })
  },

  onShow() {
    const app = getApp()
    const items = (app.globalData && app.globalData.cart) || []
    const groups = []
    const map = {}
    items.forEach(it => {
      const key = it.shopNo || '其他'
      if (!map[key]) {
        map[key] = { shopNo: key, items: [] }
        groups.push(map[key])
      }
      map[key].items.push(it)
    })
    this.setData({ items, groups })
  },

  exportExcel() {
    const items = this.data.items
    if (!items.length) {
      wx.showToast({ title: '购物车为空', icon: 'none' })
      return
    }
    try {
      const { buffer, base64 } = buildCartExcel(items)
      const fs = wx.getFileSystemManager()
      const name = `装箱单导出_${Date.now()}.xlsx`
      const filePath = `${wx.env.USER_DATA_PATH}/${name}`

      fs.writeFile({
        filePath,
        data: buffer,
        encoding: undefined,
        success: () => {
          const app = getApp()
          const list = app.globalData.exportedFiles || []
          list.unshift({ path: filePath, name, time: Date.now() })
          if (list.length > 30) list.pop()
          app.globalData.exportedFiles = list
          try { wx.setStorageSync('exportedFiles', list) } catch (e) {}
          wx.openDocument({
            filePath,
            fileType: 'xlsx',
            showMenu: true,
            success: () => {
              wx.showToast({ title: '已生成，已存入「上传」tab' })
            },
            fail: (err) => {
              wx.showToast({ title: '打开失败', icon: 'none' })
            }
          })
        },
        fail: (err) => {
          wx.showToast({ title: '写入失败', icon: 'none' })
        }
      })
    } catch (e) {
      wx.showToast({ title: e.message || '导出失败', icon: 'none' })
    }
  }
})
