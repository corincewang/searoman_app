/**
 * 商品图片处理：将 data URL 转为本地临时路径，避免长 base64 在小程序中带来的限制。
 */

/**
 * 将 products 中 photo 为 data URL 的项写入临时文件，并替换为本地路径。
 * @param {Array<{ photo?: string }>} products - 商品列表
 * @param {function} [callback] - 全部完成后调用；不传则同步返回（仅当无 data URL 时有效）
 */
function convertProductPhotosToLocalPaths(products, callback) {
  if (!Array.isArray(products) || products.length === 0) {
    if (typeof callback === 'function') callback()
    return
  }

  const fs = wx.getFileSystemManager()
  const baseDir = (typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH) ? wx.env.USER_DATA_PATH : ''
  const dataUrlPrefix = 'data:image/'
  const toWrite = []
  products.forEach((p, i) => {
    const photo = p && p.photo
    if (typeof photo === 'string' && photo.indexOf(dataUrlPrefix) === 0) {
      const comma = photo.indexOf(',')
      const base64 = comma >= 0 ? photo.slice(comma + 1) : ''
      if (base64) toWrite.push({ index: i, base64 })
    }
  })

  if (toWrite.length === 0) {
    if (typeof callback === 'function') callback()
    return
  }

  let pending = toWrite.length
  toWrite.forEach(({ index, base64 }) => {
    const filePath = `${baseDir}/photo_${index}_${Date.now()}.png`
    fs.writeFile({
      filePath,
      data: base64,
      encoding: 'base64',
      success: () => {
        if (products[index]) products[index].photo = filePath
        pending--
        if (pending === 0 && typeof callback === 'function') callback()
      },
      fail: () => {
        pending--
        if (pending === 0 && typeof callback === 'function') callback()
      }
    })
  })
}

module.exports = {
  convertProductPhotosToLocalPaths
}
