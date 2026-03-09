Page({
  data: {
    product: null
  },

  onLoad(options) {
    const id = options.id
    if (!id) return
    const app = getApp()
    const list = (app.globalData && app.globalData.products) || []
    const product = list.find(p => p.id === decodeURIComponent(id))
    this.setData({ product: product || null })
  },

  addToCart() {
    const product = this.data.product
    if (!product) return
    const app = getApp()
    if (!app.globalData.cart) app.globalData.cart = []
    const exist = app.globalData.cart.find(p => p.id === product.id)
    if (exist) {
      exist.cartons = (exist.cartons || 0) + (product.cartons || 1)
      exist.totalQty = exist.cartons * (product.pcsInCarton || 0)
      exist.amount = Math.round((exist.totalQty || 0) * (product.price || 0) * 100) / 100
    } else {
      app.globalData.cart.push({
        ...product,
        cartons: product.cartons || 1,
        totalQty: (product.cartons || 1) * (product.pcsInCarton || 0),
        amount: Math.round((product.cartons || 1) * (product.pcsInCarton || 0) * (product.price || 0) * 100) / 100
      })
    }
    wx.showToast({ title: '已加入购物车' })
  }
})
