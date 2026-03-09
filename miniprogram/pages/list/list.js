const { sampleProducts } = require('../../utils/sampleProducts.js')

Page({
  data: {
    products: [],
    sortBy: 'time', // time | category
    filterNewWeek: false
  },

  onLoad() {
    const app = getApp()
    let list = (app.globalData && app.globalData.products) || []
    if (!list || list.length === 0) {
      list = sampleProducts
      if (app.globalData) app.globalData.products = list
    }
    this.setData({ products: this._sortProducts(list) })
  },

  onShow() {
    const app = getApp()
    const list = (app.globalData && app.globalData.products) || []
    if (list.length > 0) {
      this.setData({ products: this._sortProducts(this._filter(list)) })
    }
  },

  _filter(list) {
    if (!this.data.filterNewWeek) return list
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return list.filter(p => (p.uploadedAt || 0) >= weekAgo)
  },

  _sortProducts(list) {
    const sorted = list.slice()
    if (this.data.sortBy === 'time') {
      sorted.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0))
    } else if (this.data.sortBy === 'category') {
      sorted.sort((a, b) => {
        const catA = (a.shopNo || '') + (a.nameCn || '')
        const catB = (b.shopNo || '') + (b.nameCn || '')
        return catA.localeCompare(catB)
      })
    }
    return sorted
  },

  onSortChange(e) {
    const sortBy = e.currentTarget.dataset.sort
    this.setData({ sortBy, products: this._sortProducts(this._filter(this.data.products)) })
  },

  onFilterNewWeek(e) {
    const filterNewWeek = !!e.detail.value.length
    const app = getApp()
    const list = (app.globalData && app.globalData.products) || []
    this.setData({ filterNewWeek, products: this._sortProducts(filterNewWeek ? this._filter(list) : list) })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(id)}` })
  },

  goUpload() {
    wx.switchTab({ url: '/pages/upload/upload' })
  }
})
