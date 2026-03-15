// 最先加载：为 JSZip 等 npm 包提供 setImmediate（小程序环境没有）
require('./utils/polyfillSetImmediate.js')

const { sampleProducts } = require('./utils/sampleProducts.js')

const EXPORTED_FILES_KEY = 'exportedFiles'
const PRODUCTS_KEY = 'products'

App({
  onLaunch() {
    try {
      const savedProducts = wx.getStorageSync(PRODUCTS_KEY)
      if (savedProducts && Array.isArray(savedProducts) && savedProducts.length > 0) {
        this.globalData.products = savedProducts
      }
    } catch (e) {}
    if (!this.globalData.products || this.globalData.products.length === 0) {
      this.globalData.products = sampleProducts
    }
    try {
      const saved = wx.getStorageSync(EXPORTED_FILES_KEY)
      if (saved && Array.isArray(saved)) this.globalData.exportedFiles = saved
    } catch (e) {}
  },
  globalData: {
    products: [],
    cart: [],
    exportedFiles: [] // 购物车导出的 Excel，在「上传」tab 展示
  }
})
