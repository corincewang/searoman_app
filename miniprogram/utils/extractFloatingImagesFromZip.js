/**
 * 从 readZipEntry 的 entries 中解析「浮动图片」（drawing）并取出对应 xl/media 的图片数据。
 * 浮动图片通过 xl/drawings/drawingN.xml 描述位置（row/col），通过 _rels 关联到 xl/media/imageN.png。
 */

function decodeUtf8(ab) {
  if (!ab) return ''
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(ab)
  const u8 = new Uint8Array(ab)
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return s
}

/** base64 字符串解码为 ArrayBuffer（小程序无 atob；需去掉换行等非 base64 字符） */
function base64DecodeToArrayBuffer(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') return null
  const cleaned = base64Str.replace(/\s/g, '').replace(/=+$/, '')
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const rev = {}
  for (let i = 0; i < chars.length; i++) rev[chars[i]] = i
  const len = cleaned.length
  const outLen = (len * 3) >> 2
  const u8 = new Uint8Array(outLen)
  let j = 0
  for (let i = 0; i < len; i += 4) {
    const a = rev[cleaned[i]] ?? 0
    const b = rev[cleaned[i + 1]] ?? 0
    const c = rev[cleaned[i + 2]] ?? 0
    const d = rev[cleaned[i + 3]] ?? 0
    u8[j++] = (a << 2) | (b >> 4)
    if (j < outLen) u8[j++] = ((b & 15) << 4) | (c >> 2)
    if (j < outLen) u8[j++] = ((c & 3) << 6) | d
  }
  return u8.buffer
}

/** 从 drawing XML 字符串中解析出 [ { row, col, rId } ]，row/col 为 0-based；兼容带命名空间的开闭标签。
 * 行列采用「图片中心点」所在的单元格：同时读取 from / to 的 row、col，取中点再四舍五入。
 */
function parseDrawingXml(xmlStr) {
  const list = []
  if (!xmlStr || typeof xmlStr !== 'string') return list
  const anchorReg = /<(?:[\w]+:)?(?:oneCellAnchor|twoCellAnchor)[^>]*>([\s\S]*?)<\/(?:[\w]+:)?(?:oneCellAnchor|twoCellAnchor)>/gi
  let m
  while ((m = anchorReg.exec(xmlStr)) !== null) {
    const block = m[1]
    // from 区块
    const fromMatch = block.match(/<(?:[\w]+:)?from[^>]*>([\s\S]*?)<\/(?:[\w]+:)?from>/i)
    const fromPart = fromMatch ? fromMatch[1] : block
    const fromRowMatch = fromPart.match(/<(?:[\w]+:)?row[^>]*>(\d+)<\/(?:[\w]+:)?row>/i) || fromPart.match(/row[^>]*>(\d+)<\//i)
    const fromColMatch = fromPart.match(/<(?:[\w]+:)?col[^>]*>(\d+)<\/(?:[\w]+:)?col>/i) || fromPart.match(/col[^>]*>(\d+)<\//i)
    // to 区块
    const toMatch = block.match(/<(?:[\w]+:)?to[^>]*>([\s\S]*?)<\/(?:[\w]+:)?to>/i)
    const toPart = toMatch ? toMatch[1] : block
    const toRowMatch = toPart.match(/<(?:[\w]+:)?row[^>]*>(\d+)<\/(?:[\w]+:)?row>/i) || toPart.match(/row[^>]*>(\d+)<\//i)
    const toColMatch = toPart.match(/<(?:[\w]+:)?col[^>]*>(\d+)<\/(?:[\w]+:)?col>/i) || toPart.match(/col[^>]*>(\d+)<\//i)

    const rowFrom = fromRowMatch ? parseInt(fromRowMatch[1], 10) : (toRowMatch ? parseInt(toRowMatch[1], 10) : null)
    const rowTo = toRowMatch ? parseInt(toRowMatch[1], 10) : rowFrom
    const colFrom = fromColMatch ? parseInt(fromColMatch[1], 10) : (toColMatch ? parseInt(toColMatch[1], 10) : null)
    const colTo = toColMatch ? parseInt(toColMatch[1], 10) : colFrom

    if (rowFrom == null || colFrom == null) continue
    const rowCenter = (rowFrom + rowTo) / 2
    const colCenter = (colFrom + colTo) / 2
    const row = Math.round(rowCenter)
    const col = Math.round(colCenter)

    const embedMatch = block.match(/(?:r:)?embed="(rId\d+)"/i) || block.match(/embed="(rId\d+)"/i)
    if (!isNaN(row) && !isNaN(col) && embedMatch) {
      list.push({
        row,
        col,
        rId: embedMatch[1]
      })
    }
  }
  if (list.length === 0 && xmlStr.indexOf('rId') >= 0 && typeof console !== 'undefined') {

  }
  return list
}

/** 从 drawing rels XML 解析 rId -> 目标路径；兼容单引号与 Id/Target 任意顺序 */
function parseDrawingRels(relsStr) {
  const map = {}
  if (!relsStr || typeof relsStr !== 'string') return map
  function norm(t) {
    t = (t || '').replace(/^\.\.\//, '').replace(/\\/g, '/')
    return t.indexOf('xl/') === 0 ? t : (t.indexOf('media') >= 0 ? 'xl/' + t.replace(/^xl\//, '') : t)
  }
  let m
  const reg1 = /Relationship[^>]*Id=["'](rId\d+)["'][^>]*Target=["']([^"']+)["']/gi
  while ((m = reg1.exec(relsStr)) !== null) map[m[1]] = norm(m[2])
  const reg2 = /Relationship[^>]*Target=["']([^"']+)["'][^>]*Id=["'](rId\d+)["']/gi
  while ((m = reg2.exec(relsStr)) !== null) map[m[2]] = norm(m[1])
  return map
}

/** ArrayBuffer 转 base64（readZipEntry 未传 encoding 时的备用） */
function arrayBufferToBase64Fallback(ab) {
  if (!ab || !ab.byteLength) return ''
  const u8 = new Uint8Array(ab)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let s = ''
  for (let i = 0; i < u8.length; i += 3) {
    const a = u8[i]
    const b = u8[i + 1]
    const c = u8[i + 2]
    s += chars[a >> 2]
    s += chars[((a & 3) << 4) | (b >> 4)]
    s += b !== undefined ? chars[((b & 15) << 2) | (c >> 6)] : '='
    s += c !== undefined ? chars[c & 63] : '='
  }
  return s
}

/** 将 entry 的 data（ArrayBuffer 或 base64 字符串）转为 data URL */
function entryToDataUrl(entry) {
  if (!entry || entry.errMsg !== 'readZipEntry:ok' || !entry.data) return ''
  let base64
  if (entry.data instanceof ArrayBuffer) {
    try {
      base64 = (typeof wx !== 'undefined' && wx.arrayBufferToBase64) ? wx.arrayBufferToBase64(entry.data) : ''
    } catch (e) {}
    if (!base64) base64 = arrayBufferToBase64Fallback(entry.data)
  } else if (typeof entry.data === 'string') {
    base64 = entry.data
  } else {
    return ''
  }
  if (!base64) return ''
  return 'data:image/png;base64,' + base64
}

/** 根据 entriesEncoding 把 entry.data 转成 UTF-8 字符串（用于 XML） */
function entryDataToUtf8String(item, entriesEncoding) {
  if (!item || !item.data) return ''
  if (item.data instanceof ArrayBuffer) return decodeUtf8(item.data)
  if (typeof item.data !== 'string') return ''
  if (entriesEncoding === 'base64') {
    const ab = base64DecodeToArrayBuffer(item.data)
    return ab ? decodeUtf8(ab) : ''
  }
  return item.data
}

/**
 * 从 readZipEntry(filePath, entries: 'all') 的返回中提取浮动图片，按行号对应到数据行。
 * @param {Object} entries - res.entries，key 为 zip 内路径，value 为 { data, errMsg }
 * @param {number} dataStartRowIndex - 数据起始行（0-based）
 * @param {number} photoCol - 图片所在列（0-based）
 * @param {string} [entriesEncoding] - 若 readZipEntry 传了 encoding: 'base64'，则传 'base64'
 * @returns {Array<string>} 按数据行下标对应的 dataUrl 数组
 */
function extractFloatingImagesFromZipEntries(entries, dataStartRowIndex, photoCol, entriesEncoding) {
  const result = []
  if (!entries || typeof entries !== 'object') return result

  const keys = Object.keys(entries)
  const drawingPaths = keys.filter(k => /^xl[/\\]drawings[/\\]drawing\d+\.xml$/i.test(k) && !/[/\\]_rels[/\\]/.test(k))
  const relsPaths = keys.filter(k => /^xl[/\\]drawings[/\\]_rels[/\\]drawing\d+\.xml\.rels$/i.test(k))
  const mediaPathRe = /^xl[/\\]media[/\\]image/i
  const mediaKeys = keys.filter(k => mediaPathRe.test(k))

  if (typeof console !== 'undefined') {

  }

  if (drawingPaths.length === 0) {

    return result
  }

  const rIdToMedia = {}
  for (const p of relsPaths) {
    const item = entries[p]
    const str = entryDataToUtf8String(item, entriesEncoding)
    if (!str) continue
    const map = parseDrawingRels(str)
    Object.assign(rIdToMedia, map)
  }

  const rowColToRId = []
  for (const p of drawingPaths) {
    const item = entries[p]
    const str = entryDataToUtf8String(item, entriesEncoding)
    if (!str) continue
    const list = parseDrawingXml(str)
    rowColToRId.push(...list)
  }

  if (typeof console !== 'undefined') {
    const rIds = [...new Set(rowColToRId.map(x => x.rId))]

  }
  if (rowColToRId.length === 0) {

    const mediaPaths = keys.filter(k => mediaPathRe.test(k)).sort((a, b) => {
      const na = parseInt((a.match(/\d+/) || [0])[0], 10)
      const nb = parseInt((b.match(/\d+/) || [0])[0], 10)
      return na - nb
    })
    const byDataIndexFallback = []
    for (let i = 0; i < mediaPaths.length; i++) {
      const entry = entries[mediaPaths[i]]
      const dataUrl = entryToDataUrl(entry)
      if (dataUrl) byDataIndexFallback[i] = dataUrl
    }
    if (typeof console !== 'undefined' && byDataIndexFallback.filter(Boolean).length === 0) {

    }
    return byDataIndexFallback
  }

  const mediaKeyList = keys.filter(k => k.indexOf('media') >= 0)
  for (let idx = 0; idx < rowColToRId.length; idx++) {
    const { row, col, rId } = rowColToRId[idx]
    let mediaPath = rIdToMedia[rId]
    if (!mediaPath) continue
    mediaPath = mediaPath.replace(/^\.\.\//, '').replace(/\\/g, '/')
    if (mediaPath.indexOf('xl/') !== 0) mediaPath = 'xl/' + mediaPath
    let entry = entries[mediaPath]
    if (!entry) {
      const alt = mediaPath.replace(/\//g, '\\')
      entry = entries[alt]
    }

    if (!entry) continue
    const dataUrl = entryToDataUrl(entry)

    if (dataUrl) result.push({ row, col, dataUrl })
  }

  result.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)
  if (typeof console !== 'undefined') {


  }

  // 每行只保留第一张图，避免复制/隐藏锚点导致一行多图
  const seenRows = new Set()
  const onePerRow = result.filter(r => {
    if (seenRows.has(r.row)) return false
    seenRows.add(r.row)
    return true
  })

  const ROW_TOLERANCE = 3
  const COL_TOLERANCE = 2
  const byDataIndex = []
  for (const r of onePerRow) {
    const dataIndex = r.row - dataStartRowIndex
    if (dataIndex < -ROW_TOLERANCE) continue
    const di = Math.max(0, dataIndex)
    if (photoCol != null && Math.abs(r.col - photoCol) > COL_TOLERANCE) continue
    byDataIndex[di] = r.dataUrl
  }
  return byDataIndex
}

/**
 * 用 JSZip 解析 xlsx zip：用 .async("string") 读 XML、.async("base64") 读图片，避免 readZipEntry 返回的 data 异常。
 * @param {Object} zip - JSZip.loadAsync(base64, { base64: true }) 的返回值
 * @param {number} dataStartRowIndex - 数据起始行（0-based）
 * @param {number} [photoCol] - 图片所在列（0-based），可选
 * @returns {Promise<Array<string>>} 按数据行下标对应的 dataUrl 数组
 */
function extractFloatingImagesFromJSZip(zip, dataStartRowIndex, photoCol) {
  const result = []
  if (!zip || !zip.files) return Promise.resolve(result)

  const keys = Object.keys(zip.files)
  const drawingPaths = keys.filter(k => /^xl[/\\]drawings[/\\]drawing\d+\.xml$/i.test(k) && !/[/\\]_rels[/\\]/.test(k))
  const relsPaths = keys.filter(k => /^xl[/\\]drawings[/\\]_rels[/\\]drawing\d+\.xml\.rels$/i.test(k))
  const mediaPathRe = /^xl[/\\]media[/\\]image/i
  const mediaPathsSorted = keys.filter(k => mediaPathRe.test(k) && !/[/\\]$/.test(k)).sort((a, b) => {
    const na = parseInt((a.match(/\d+/) || [0])[0], 10)
    const nb = parseInt((b.match(/\d+/) || [0])[0], 10)
    return na - nb
  })

  const getFile = (path) => zip.files[path] || zip.files[path.replace(/\//g, '\\')]
  const readString = (path) => {
    const f = getFile(path)
    if (!f || f.dir) return Promise.resolve('')
    return f.async('string').catch(() => f.async('uint8array').then((u8) => {
      if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(u8)
      let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s
    }))
  }
  const readBase64 = (path) => {
    const f = getFile(path)
    if (!f || f.dir) return Promise.resolve('')
    return f.async('base64').catch(() => Promise.resolve(''))
  }

  if (drawingPaths.length === 0) {

    return Promise.resolve(result)
  }

  let rIdToMedia = {}
  let rowColToRId = []

  return Promise.all(relsPaths.map(p => readString(p).then(str => ({ p, str }))))
    .then((relsContents) => {
      relsContents.forEach(({ str }) => {
        if (!str) return
        const map = parseDrawingRels(str)
        Object.assign(rIdToMedia, map)
      })
      return Promise.all(drawingPaths.map(p => readString(p).then(str => ({ p, str }))))
    })
    .then((drawingContents) => {
      drawingContents.forEach(({ str }) => {
        if (!str) return
        rowColToRId = rowColToRId.concat(parseDrawingXml(str))
      })
      if (typeof console !== 'undefined') {
        const rIds = [...new Set(rowColToRId.map(x => x.rId))]


      }
      if (rowColToRId.length === 0) {

        return Promise.all(mediaPathsSorted.map((path, i) =>
          readBase64(path).then((base64) => {
            if (!base64) return null
            const ext = (path.match(/\.(\w+)$/) || [])[1] || 'png'
            const mime = ext.toLowerCase() === 'jpg' || ext.toLowerCase() === 'jpeg' ? 'jpeg' : 'png'
            return { dataIndex: i, dataUrl: 'data:image/' + mime + ';base64,' + base64 }
          })
        )).then((items) => {
          const byDataIndex = []
          items.forEach((item) => { if (item) byDataIndex[item.dataIndex] = item.dataUrl })
          return byDataIndex
        })
      }
      return Promise.all(rowColToRId.map(({ row, col, rId }) => {
        let mediaPath = rIdToMedia[rId]
        if (!mediaPath) return Promise.resolve(null)
        mediaPath = mediaPath.replace(/^\.\.\//, '').replace(/\\/g, '/')
        if (mediaPath.indexOf('xl/') !== 0) mediaPath = 'xl/' + mediaPath
        return readBase64(mediaPath).then((base64) => {
          if (!base64) return null
          const ext = (mediaPath.match(/\.(\w+)$/) || [])[1] || 'png'
          const mime = ext.toLowerCase() === 'jpg' || ext.toLowerCase() === 'jpeg' ? 'jpeg' : 'png'
          return { row, col, dataUrl: 'data:image/' + mime + ';base64,' + base64 }
        })
      })).then((items) => {
        const withUrl = items.filter(Boolean)
        withUrl.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)
        // 每行只保留第一张图，避免复制/隐藏锚点导致一行多图
        const seenRows = new Set()
        const onePerRow = withUrl.filter(r => {
          if (seenRows.has(r.row)) return false
          seenRows.add(r.row)
          return true
        })

        const ROW_TOLERANCE = 3
        const COL_TOLERANCE = 2
        const byDataIndex = []
        onePerRow.forEach((r) => {
          const dataIndex = r.row - dataStartRowIndex
          if (dataIndex < -ROW_TOLERANCE) return
          const di = Math.max(0, dataIndex)
          if (photoCol != null && Math.abs(r.col - photoCol) > COL_TOLERANCE) return
          byDataIndex[di] = r.dataUrl
        })
        return byDataIndex
      })
    })
}

module.exports = {
  extractFloatingImagesFromZipEntries,
  extractFloatingImagesFromJSZip,
  parseDrawingXml,
  parseDrawingRels
}
