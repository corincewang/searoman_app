const { buildCartExcel } = require('../../utils/exportExcel.js')
const { convertProductPhotosToLocalPaths } = require('../../utils/photoUtil.js')

function buildGroups(items) {
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
  return groups
}

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
    const hasDataUrl = items.some(it => it.photo && typeof it.photo === 'string' && it.photo.indexOf('data:image/') === 0)
    const apply = () => {
      this.setData({ items, groups: buildGroups(items) })
    }
    if (hasDataUrl) {
      convertProductPhotosToLocalPaths(items, apply)
    } else {
      apply()
    }
  },

  exportExcel() {
    const items = this.data.items
    if (!items.length) {
      wx.showToast({ title: '购物车为空', icon: 'none' })
      return
    }
    try {
      const { buffer, base64 } = buildCartExcel(items)
      if (!buffer || !buffer.byteLength) {
        wx.showToast({ title: '生成文件为空', icon: 'none' })
        return
      }
      const fs = wx.getFileSystemManager()
      const name = `装箱单导出_${Date.now()}.xlsx`
      const filePath = `${wx.env.USER_DATA_PATH}/${name}`

      const doWrite = () => {
        fs.writeFile({
          filePath,
          data: buffer,
          encoding: 'binary',
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
            const msg = (err && err.errMsg) ? err.errMsg : '写入失败'
            const isLimit = msg.indexOf('maximum size') >= 0 || msg.indexOf('storage limit') >= 0
            wx.showToast({
              title: isLimit ? '存储已满，请删除本小程序后重新打开再试' : (msg.indexOf('fail') === 0 ? '写入失败' : msg),
              icon: 'none',
              duration: isLimit ? 3500 : 2000
            })
            if (typeof console !== 'undefined') console.error('[exportExcel] writeFile fail', err)
          }
        })
      }

      const app = getApp()
      const list = (app.globalData.exportedFiles || []).slice()
      if (list.length === 0) {
        doWrite()
        return
      }
      let pending = list.length
      list.forEach((item) => {
        fs.unlink({
          filePath: item.path,
          complete: () => {
            pending--
            if (pending <= 0) {
              app.globalData.exportedFiles = []
              try { wx.setStorageSync('exportedFiles', []) } catch (e) {}
              doWrite()
            }
          }
        })
      })
    } catch (e) {
      wx.showToast({ title: e.message || '导出失败', icon: 'none' })
    }
  }
})
