/**
 * 装箱单 Excel 表头与 JSON 字段映射（与 excelSchema.json 一致，供不支持 require json 的环境）
 */
module.exports = {
  description: '装箱单 Excel 表头与 JSON 字段映射，第1-2行为说明保留不解析，表头为第3行，数据从第4行起',
  headerRowIndex: 2,
  dataStartRowIndex: 4,
  columns: [
    { index: 0, key: 'shopNo', type: 'string', required: true, header: 'shop No', label: '店铺编号' },
    { index: 1, key: 'photo', type: 'string', required: false, header: 'photo图片', label: '商品图片' },
    { index: 2, key: 'nameCn', type: 'string', required: true, header: '货物中文名称', label: '货物中文名称' },
    { index: 3, key: 'certificate', type: 'string', required: false, header: '证书类型及证书代码', label: '证书类型及代码' },
    { index: 4, key: 'barcode', type: 'string', required: false, header: 'Bar code', label: '条形码(13位)' },
    { index: 5, key: 'itemNo', type: 'string', required: true, header: '侧唛Item', label: '货号' },
    { index: 6, key: 'size', type: 'string', required: false, header: 'size规格', label: '规格' },
    { index: 7, key: 'color', type: 'string', required: false, header: 'Color颜色', label: '颜色' },
    { index: 8, key: 'material', type: 'string', required: false, header: 'Material材质', label: '材质' },
    { index: 9, key: 'price', type: 'number', required: true, header: 'price单价', label: '单价' },
    { index: 10, key: 'cartons', type: 'number', required: true, header: 'Cartons订货箱数', label: '订货箱数' },
    { index: 11, key: 'pcsInCarton', type: 'number', required: true, header: 'pcs in carton装箱数(PCS)', label: '装箱数(PCS)' },
    { index: 12, key: 'totalQty', type: 'number', required: false, header: 'Quanlity总数量', label: '总数量' },
    { index: 13, key: 'amount', type: 'number', required: false, header: 'Amount金额', label: '金额' },
    { index: 14, key: 'grossWeightKg', type: 'number', required: false, header: 'gross weight单箱毛重(公斤KG)', label: '单箱毛重(KG)' },
    { index: 15, key: 'cartonLongCm', type: 'number', required: false, header: 'long箱规长(CM)', label: '箱规长(CM)' },
    { index: 16, key: 'cartonWideCm', type: 'number', required: false, header: 'wide箱规宽(CM)', label: '箱规宽(CM)' },
    { index: 17, key: 'cartonHighCm', type: 'number', required: false, header: 'high箱规高(CM)', label: '箱规高(CM)' },
    { index: 18, key: 'cubeM3', type: 'number', required: false, header: 'cube单箱体积(m³)', label: '单箱体积(m³)' },
    { index: 19, key: '_exampleFlag', type: 'string', required: false, header: '本行是示例', label: '示例行标记(有则跳过)' }
  ]
}
