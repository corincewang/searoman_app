/**
 * 小程序无 setImmediate，JSZip 依赖它。必须在 app.js 最顶部 require，早于任何可能加载 jszip 的代码。
 * 使用 Function 构造以在严格模式下拿到全局 this；并挂到 global（JSZip 源码用 global.setImmediate）。
 */
;(function () {
  if (typeof setImmediate !== 'undefined') return
  var fn = function (f) { return setTimeout(f, 0) }
  var g
  try { g = new Function('return this')() } catch (e) {
    try { g = (function () { return this })() } catch (e2) {}
  }
  if (g) g.setImmediate = fn
  if (typeof global !== 'undefined') global.setImmediate = fn
  if (typeof globalThis !== 'undefined') globalThis.setImmediate = fn
  if (typeof self !== 'undefined') self.setImmediate = fn
  if (typeof wx !== 'undefined' && wx) wx.setImmediate = fn
  if (g && typeof g.global !== 'undefined') g.global.setImmediate = fn
})()
