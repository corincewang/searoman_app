const { sampleProducts } = require('../../utils/sampleProducts.js')
const PRODUCT_IMPORT_BATCHES_KEY = 'productImportBatches'

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
    allProducts: [],
    products: [],
    batchOptions: [],
    selectedBatchIndex: 0,
    loadedCount: 0,
    totalInBatch: 0,
    hasMore: false,
    searchKeyword: '',
    sortBy: 'time', // time | category
    filterNewWeek: false
  },

  onLoad() {
    this._initData()
  },

  onShow() {
    this._initData()
  },

  onReachBottom() {
    this.loadMore()
  },

  _initData() {
    const app = getApp()
    let list = (app.globalData && app.globalData.products) || []
    if (!list || list.length === 0) {
      list = sampleProducts.map(p => ({ ...p, batchId: 'sample', sourceFileName: '示例数据' }))
      if (app.globalData) app.globalData.products = list
    }
    let batches = (app.globalData && app.globalData.productImportBatches) || []
    if (!Array.isArray(batches) || batches.length === 0) {
      try {
        const saved = wx.getStorageSync(PRODUCT_IMPORT_BATCHES_KEY)
        if (Array.isArray(saved)) batches = saved
      } catch (e) {}
    }
    const batchOptions = this._buildBatchOptions(list, batches)
    const prev = this.data.batchOptions[this.data.selectedBatchIndex]
    let selectedBatchIndex = 0
    const pendingFocusBatchId = app.globalData && app.globalData.pendingFocusBatchId
    if (pendingFocusBatchId && batchOptions.length) {
      const pendingIdx = batchOptions.findIndex(b => b.id === pendingFocusBatchId)
      selectedBatchIndex = pendingIdx >= 0 ? pendingIdx : 0
      if (app.globalData) app.globalData.pendingFocusBatchId = ''
    } else if (prev && batchOptions.length) {
      const idx = batchOptions.findIndex(b => b.id === prev.id)
      selectedBatchIndex = idx >= 0 ? idx : 0
    }
    this.setData({ allProducts: list, batchOptions, selectedBatchIndex })
    this._refreshCurrentBatch()
  },

  _buildBatchOptions(list, batches) {
    const countMap = {}
    const timeMap = {}
    list.forEach((p) => {
      const bid = p.batchId || 'legacy'
      countMap[bid] = (countMap[bid] || 0) + 1
      const t = p.uploadedAt || 0
      if (!timeMap[bid] || t > timeMap[bid]) timeMap[bid] = t
    })

    const fromMeta = (Array.isArray(batches) ? batches : [])
      .map((b) => ({
        id: b.id,
        fileName: b.fileName || b.id,
        time: b.time || timeMap[b.id] || 0,
        count: countMap[b.id] || b.count || 0
      }))
      .filter((b) => b.count > 0)

    const existedIds = {}
    fromMeta.forEach((b) => { existedIds[b.id] = true })

    Object.keys(countMap).forEach((id) => {
      if (id === 'legacy' || existedIds[id]) return
      fromMeta.push({
        id,
        fileName: '历史导入文件',
        time: timeMap[id] || 0,
        count: countMap[id]
      })
    })

    fromMeta.sort((a, b) => (b.time || 0) - (a.time || 0))

    if (countMap.legacy) {
      fromMeta.push({
        id: 'legacy',
        fileName: '历史数据',
        time: timeMap.legacy || 0,
        count: countMap.legacy
      })
    }

    return fromMeta.map((b) => ({
      ...b,
      label: `${b.fileName}`,
      timeStr: formatTime(b.time)
    }))
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: (e.detail.value || '').trim() })
    this._refreshCurrentBatch()
  },

  onSearchConfirm() {
    // 键盘确认时保持当前结果即可，已在 onSearchInput 中刷新
  },

  _refreshCurrentBatch() {
    const { allProducts, batchOptions, selectedBatchIndex } = this.data
    if (!batchOptions.length) {
      this.setData({ products: [], loadedCount: 0, totalInBatch: 0, hasMore: false })
      return
    }
    const current = batchOptions[selectedBatchIndex]
    const fullList = (allProducts || []).filter((p) => (p.batchId || 'legacy') === current.id)
    const sorted = this._sortProducts(this._searchFilter(this._filter(fullList)))
    this._currentBatchList = sorted
    const firstPage = sorted.slice(0, 40)
    this.setData({
      products: firstPage,
      loadedCount: firstPage.length,
      totalInBatch: sorted.length,
      hasMore: firstPage.length < sorted.length
    })
  },

  loadMore() {
    if (!this.data.hasMore) return
    const list = this._currentBatchList || []
    const nextCount = Math.min(this.data.loadedCount + 40, list.length)
    const next = list.slice(0, nextCount)
    this.setData({
      products: next,
      loadedCount: next.length,
      hasMore: next.length < list.length
    })
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
    this._refreshCurrentBatch()
  },

  onFilterNewWeek(e) {
    const filterNewWeek = !!e.detail.value.length
    this.setData({ filterNewWeek })
    this._refreshCurrentBatch()
  },

  onBatchPickerChange(e) {
    const selectedBatchIndex = Number(e.detail.value) || 0
    this.setData({ selectedBatchIndex })
    this._refreshCurrentBatch()
  },

  prevBatch() {
    const idx = this.data.selectedBatchIndex
    if (idx <= 0) return
    this.setData({ selectedBatchIndex: idx - 1 })
    this._refreshCurrentBatch()
  },

  nextBatch() {
    const idx = this.data.selectedBatchIndex
    if (idx >= this.data.batchOptions.length - 1) return
    this.setData({ selectedBatchIndex: idx + 1 })
    this._refreshCurrentBatch()
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(id)}` })
  },

  goUpload() {
    wx.switchTab({ url: '/pages/upload/upload' })
  }
})
