Page({
  data: {
    product: null,
    cartons: 1,
    totalQty: 0,
    amount: 0,
    statusBarHeight: 20
  },

  onLoad(options) {
    const sys = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sys.statusBarHeight || 20 })
    const id = options.id
    if (!id) return
    const app = getApp()
    const list = (app.globalData && app.globalData.products) || []
    const product = list.find(p => p.id === decodeURIComponent(id))
    if (!product) {
      this.setData({ product: null })
      return
    }
    const pcsInCarton = product.pcsInCarton || 1
    const cartons = Math.max(1, product.cartons || 1)
    const totalQty = cartons * pcsInCarton
    const amount = Math.round(totalQty * (product.price || 0) * 100) / 100
    this.setData({
      product,
      cartons,
      totalQty,
      amount
    })
  },

  goBack() {
    wx.navigateBack()
  },

  onCartonsChange(e) {
    const delta = parseInt(e.currentTarget.dataset.delta, 10)
    const product = this.data.product
    if (!product || isNaN(delta)) return
    const pcsInCarton = Number(product.pcsInCarton) || 1
    let cartons = Number(this.data.cartons) || 1
    cartons = cartons + delta
    cartons = Math.max(1, cartons)
    const totalQty = cartons * pcsInCarton
    const amount = Math.round(totalQty * (Number(product.price) || 0) * 100) / 100
    this.setData({ cartons, totalQty, amount })
  },

  onTotalQtyChange(e) {
    const delta = parseInt(e.currentTarget.dataset.delta, 10)
    const product = this.data.product
    if (!product || isNaN(delta)) return
    const pcsInCarton = Number(product.pcsInCarton) || 1
    let totalQty = Number(this.data.totalQty) || pcsInCarton
    totalQty = totalQty + delta * pcsInCarton
    totalQty = Math.max(pcsInCarton, totalQty)
    const cartons = Math.floor(totalQty / pcsInCarton)
    const amount = Math.round(totalQty * (Number(product.price) || 0) * 100) / 100
    this.setData({ cartons, totalQty, amount })
  },

  addToCart() {
    const { product, cartons, totalQty, amount } = this.data
    if (!product) return
    const app = getApp()
    if (!app.globalData.cart) app.globalData.cart = []
    const exist = app.globalData.cart.find(p => p.id === product.id)
    if (exist) {
      exist.cartons = (exist.cartons || 0) + cartons
      exist.totalQty = (exist.totalQty || 0) + totalQty
      exist.amount = Math.round((exist.amount || 0) + amount * 100) / 100
    } else {
      app.globalData.cart.push({
        ...product,
        cartons,
        totalQty,
        amount
      })
    }
    wx.showToast({ title: '已加入购物车' })
    wx.navigateBack()
  }
})
