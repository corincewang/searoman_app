const { sampleProducts } = require('../../utils/sampleProducts.js')

Page({
  data: {
    products: [],
    searchKeyword: '',
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
    this._refreshProducts(list)
  },

  onShow() {
    const app = getApp()
    const list = (app.globalData && app.globalData.products) || []
    if (list.length > 0) {
      this._refreshProducts(list)
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: (e.detail.value || '').trim() })
    const app = getApp()
    const list = (app.globalData && app.globalData.products) || []
    this._refreshProducts(list)
  },

  onSearchConfirm() {
    // 键盘确认时保持当前结果即可，已在 onSearchInput 中刷新
  },

  _refreshProducts(fullList) {
    const list = this._searchFilter(this._filter(fullList))
    this.setData({ products: this._sortProducts(list) })
  },

  _searchFilter(list) {
    const kw = (this.data.searchKeyword || '').trim().toLowerCase()
    if (!kw) return list
    return list.filter(p => {
      const shopNo = (p.shopNo || '').toLowerCase()
      const itemNo = (p.itemNo || '').toLowerCase()
      const nameCn = (p.nameCn || '').toLowerCase()
      const color = (p.color || '').toLowerCase()
      const size = (p.size || '').toLowerCase()
      const barcode = (p.barcode || '').toLowerCase()
      return shopNo.indexOf(kw) >= 0 || itemNo.indexOf(kw) >= 0 || nameCn.indexOf(kw) >= 0 ||
        color.indexOf(kw) >= 0 || size.indexOf(kw) >= 0 || barcode.indexOf(kw) >= 0
    })
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
    this.setData({ sortBy })
    const app = getApp()
    this._refreshProducts(app.globalData.products || [])
  },

  onFilterNewWeek(e) {
    const filterNewWeek = !!e.detail.value.length
    this.setData({ filterNewWeek })
    const app = getApp()
    this._refreshProducts(app.globalData.products || [])
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(id)}` })
  },

  goUpload() {
    wx.switchTab({ url: '/pages/upload/upload' })
  }
})
