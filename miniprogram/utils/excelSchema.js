/**
 * 装箱单 Excel 表头与 JSON 字段映射
 * 表头按顺序读取，中英都保留；支持单行表头（表头第1行，数据第2行起）
 */
module.exports = {
  description: '装箱单 Excel 表头与 JSON 字段映射，表头第1行、数据第2行起；支持新表（含报价日期、EN71证书）',
  headerRowIndex: 0,
  dataStartRowIndex: 1,
  columns: [
    { index: 0, key: 'shopNo', type: 'string', required: true, header: 'Shop No', label: '店铺编号' },
    { index: 2, key: 'nameCn', type: 'string', required: true, header: 'Name 货物中文名称', label: '货物中文名称' },
    { index: 3, key: 'certificate', type: 'string', required: false, header: '证书&代码 Certificate & Code', label: '证书及代码' },
    { index: 4, key: 'barcode', type: 'string', required: false, header: 'Bar Code 条形码(13位)', label: '条形码' },
    { index: 5, key: 'itemNo', type: 'string', required: true, header: '侧唛 Item 货号', label: '货号' },
    { index: 6, key: 'size', type: 'string', required: false, header: 'Size/规格', label: '规格' },
    { index: 7, key: 'color', type: 'string', required: false, header: 'Color 颜色', label: '颜色' },
    { index: 8, key: 'material', type: 'string', required: false, header: 'Material 材质', label: '材质' },
    { index: 9, key: 'price', type: 'number', required: true, header: 'Price 价格', label: '单价' },
    { index: 10, key: 'cartons', type: 'number', required: true, header: 'Cartons 订货箱数', label: '订货箱数' },
    { index: 11, key: 'pcsInCarton', type: 'number', required: true, header: 'Pcs In Carton 装箱数(PCS)', label: '装箱数(PCS)' },
    { index: 12, key: 'totalQty', type: 'number', required: false, header: 'Quantity 总数量', label: '总数量' },
    { index: 13, key: 'amount', type: 'number', required: false, header: 'Amount 金额', label: '金额' },
    { index: 14, key: 'grossWeightKg', type: 'number', required: false, header: 'Gross Weight 单箱货物毛重(公斤KG)', label: '单箱毛重(KG)' },
    { index: 15, key: 'cartonLongCm', type: 'number', required: false, header: 'Long 箱规长(CM)', label: '箱规长(CM)' },
    { index: 16, key: 'cartonWideCm', type: 'number', required: false, header: 'Wide 箱规宽(CM)', label: '箱规宽(CM)' },
    { index: 17, key: 'cartonHighCm', type: 'number', required: false, header: 'High 箱规高(CM)', label: '箱规高(CM)' },
    { index: 18, key: 'cubeM3', type: 'number', required: false, header: 'Cube 单箱体积(m³)', label: '单箱体积(m³)' },
    { index: 19, key: 'quotationDate', type: 'string', required: false, header: '商品报价日期 Quotation Date', label: '报价日期' },
    { index: 20, key: 'en71CertNo', type: 'string', required: false, header: '对应的EN71证书的编号', label: 'EN71证书编号' }
  ]
}
