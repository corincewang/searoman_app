/**
 * 用 JSZip 解析 xlsx（zip），列出 xl/ 下文件并打印 XML 内容，便于排查 drawing/rels/media 和 rId。
 * 使用前请在项目根目录执行 npm install，并在微信开发者工具中「工具 -> 构建 npm」。
 */
;(function () {
  if (typeof setImmediate !== 'undefined') return
  var fn = function (f) { return setTimeout(f, 0) }
  try { if (typeof global !== 'undefined') global.setImmediate = fn } catch (e) {}
  try { if (typeof globalThis !== 'undefined') globalThis.setImmediate = fn } catch (e) {}
  try { if (typeof self !== 'undefined') self.setImmediate = fn } catch (e) {}
  try { var g = (function () { return this })(); if (g) g.setImmediate = fn } catch (e) {}
})()

let JSZip
try {
  JSZip = require('jszip')
} catch (e) {
  JSZip = null
}

/** 将 ArrayBuffer 或 Uint8Array 转为 UTF-8 字符串 */
function bytesToUtf8(data) {
  if (!data) return ''
  const ab = data instanceof ArrayBuffer ? data : (data.buffer || data)
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(ab)
  const u8 = new Uint8Array(ab)
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return s
}

/**
 * 用 JSZip 解析 xlsx 的 base64，打印 xl/ 下所有文件：路径、XML 内容或媒体信息。
 * @param {string} base64 - 整个 xlsx 文件的 base64
 * @param {object} opts - { maxXmlLen: 每段 XML 最多打印字符数, log: 打印函数 }
 */
function inspectXlsxXlFolder(base64, opts) {
  const log = (opts && opts.log) || (typeof console !== 'undefined' ? console.log.bind(console) : () => {})
  const maxXmlLen = (opts && opts.maxXmlLen) || 4000

  if (!JSZip) {
    log('[inspectXlsx] 未找到 JSZip，请 npm install jszip 并在微信开发者工具中「构建 npm」')
    return Promise.resolve()
  }

  return JSZip.loadAsync(base64, { base64: true })
    .then((zip) => {
      const allNames = Object.keys(zip.files).filter((n) => n.startsWith('xl/') || n.startsWith('xl\\'))
      log('[inspectXlsx] ========== xl/ 下文件列表 ==========')
      log('[inspectXlsx] 共', allNames.length, '个:', allNames)

      const drawing = allNames.filter((n) => /xl[/\\]drawings[/\\]drawing\d+\.xml$/i.test(n) && !/[/\\]_rels[/\\]/.test(n))
      const rels = allNames.filter((n) => /xl[/\\]drawings[/\\]_rels[/\\]drawing\d+\.xml\.rels$/i.test(n))
      const media = allNames.filter((n) => /xl[/\\]media[/\\]/i.test(n) && !/[/\\]$/.test(n))

      log('[inspectXlsx] ---------- drawing XML 路径 ----------', drawing)
      log('[inspectXlsx] ---------- rels XML 路径 ----------', rels)
      log('[inspectXlsx] ---------- xl/media 路径（图片） ----------', media)

      const readAsText = (name) => {
        const f = zip.files[name]
        if (!f || f.dir) return Promise.resolve('')
        return f.async('string').catch(() => f.async('uint8array').then(bytesToUtf8))
      }

      const readSize = (name) => {
        const f = zip.files[name]
        if (!f || f.dir) return 0
        try {
          if (f._data && typeof f._data.uncompressedSize === 'number') return f._data.uncompressedSize
        } catch (e) {}
        return -1
      }

      return Promise.all(
        drawing.map((name) =>
          readAsText(name).then((xml) => {
            log('[inspectXlsx] ----- drawing:', name, '-----')
            log(xml.length > maxXmlLen ? xml.slice(0, maxXmlLen) + '\n... (截断)' : xml)
          })
        )
      )
        .then(() =>
          Promise.all(
            rels.map((name) =>
              readAsText(name).then((xml) => {
                log('[inspectXlsx] ----- rels:', name, '-----')
                log(xml.length > maxXmlLen ? xml.slice(0, maxXmlLen) + '\n... (截断)' : xml)
              })
            )
          )
        )
        .then(() => {
          log('[inspectXlsx] ----- xl/media 文件（仅列路径与大小）-----')
          media.forEach((name) => {
            const size = readSize(name)
            log('[inspectXlsx]', name, 'size:', size)
          })
          log('[inspectXlsx] ========== 结束 ==========')
        })
    })
    .catch((err) => {
      log('[inspectXlsx] JSZip 解析失败', err && err.message)
    })
}

module.exports = {
  inspectXlsxXlFolder,
  getJSZip: () => JSZip
}
