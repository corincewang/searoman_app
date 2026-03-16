/** 只保留英文字母和空格，去掉标点等 */
function onlyEnAndSpaces(str) {
  if (str == null || typeof str !== 'string') return ''
  return str.replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * 中文 → 英文翻译（用于商品名称等）
 * 使用 MyMemory 免费 API，需在微信公众平台将 api.mymemory.translated.net 加入 request 合法域名
 * 返回结果只保留英文和空格，不含标点。
 */
function translateToEn(zhText, callback) {
  if (!zhText || typeof zhText !== 'string') {
    if (callback) callback('')
    return
  }
  const q = zhText.trim()
  if (!q) {
    if (callback) callback('')
    return
  }
  wx.request({
    url: 'https://api.mymemory.translated.net/get',
    data: {
      q: q,
      langpair: 'zh-CN|en'
    },
    success(res) {
      if (res.statusCode === 200 && res.data && res.data.responseData && res.data.responseData.translatedText) {
        const en = onlyEnAndSpaces(String(res.data.responseData.translatedText))
        if (callback) callback(en)
      } else {
        if (callback) callback('')
      }
    },
    fail() {
      if (callback) callback('')
    }
  })
}

/**
 * 批量翻译（去重后逐个请求，避免限流）
 * @param {Array<string>} zhList - 中文列表
 * @param {function(Array<string>)} callback - 回调，参数为与 zhList 同序的英文列表
 */
function translateBatch(zhList, callback) {
  if (!zhList || !zhList.length) {
    if (callback) callback([])
    return
  }
  const uniq = []
  const map = {}
  zhList.forEach(z => {
    const k = (z || '').trim()
    if (k && map[k] === undefined) {
      map[k] = uniq.length
      uniq.push(k)
    }
  })
  const enList = new Array(zhList.length).fill('')
  let done = 0
  if (uniq.length === 0) {
    if (callback) callback(enList)
    return
  }
  function onOne(zh, en) {
    zhList.forEach((z, i) => {
      if ((z || '').trim() === zh) enList[i] = en
    })
    done++
    if (done >= uniq.length && callback) callback(enList)
  }
  uniq.forEach((zh, i) => {
    setTimeout(() => {
      translateToEn(zh, (en) => onOne(zh, en))
    }, i * 200)
  })
}

module.exports = {
  translateToEn,
  translateBatch
}
