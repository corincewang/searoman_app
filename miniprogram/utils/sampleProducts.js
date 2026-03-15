/**
 * 默认示例数据：对应「已有填写好的 Excel 表」解析后的结果
 * 用于默认流程：不依赖上传，直接进入淘宝式列表展示
 */
const sampleProducts = [
  {
    id: 'F1-10958_181305_白色_10*4.4',
    shopNo: 'F1-10958',
    nameCn: '豹猫玩偶',
    nameEn: 'Plush Cat',
    certificate: 'CE:ZJ250710112',
    barcode: '6935750093065',
    itemNo: '181305',
    size: '10*4.4',
    color: '白色',
    material: '球皮TPR 内料PVA',
    price: 2.2,
    cartons: 20,
    pcsInCarton: 200,
    totalQty: 4000,
    amount: 8800,
    grossWeightKg: 13,
    cartonLongCm: 59,
    cartonWideCm: 36,
    cartonHighCm: 44,
    cubeM3: 0.09,
    uploadedAt: Date.now() - 2 * 24 * 60 * 60 * 1000 // 2 天前，便于测“近一周”
  },
  {
    id: 'F1-10958_181305_灰色_10*4.4',
    shopNo: 'F1-10958',
    nameCn: '豹猫玩偶',
    nameEn: 'Plush Cat',
    certificate: 'CE:ZJ250710112',
    barcode: '6935750093066',
    itemNo: '181305',
    size: '10*4.4',
    color: '灰色',
    material: '球皮TPR 内料PVA',
    price: 2.2,
    cartons: 15,
    pcsInCarton: 200,
    totalQty: 3000,
    amount: 6600,
    grossWeightKg: 13,
    cartonLongCm: 59,
    cartonWideCm: 36,
    cartonHighCm: 44,
    cubeM3: 0.09,
    uploadedAt: Date.now() - 1 * 24 * 60 * 60 * 1000
  },
  {
    id: 'F1-10959_182001_黑色_12*5',
    shopNo: 'F1-10959',
    nameCn: '新款杯子',
    nameEn: 'New Cup',
    certificate: '',
    barcode: '6935750093070',
    itemNo: '182001',
    size: '12*5',
    color: '黑色',
    material: '不锈钢',
    price: 5.5,
    cartons: 10,
    pcsInCarton: 100,
    totalQty: 1000,
    amount: 5500,
    grossWeightKg: 8,
    cartonLongCm: 40,
    cartonWideCm: 30,
    cartonHighCm: 35,
    cubeM3: 0.042,
    uploadedAt: Date.now() // 今天，便于测“近一周新品”
  }
]

module.exports = {
  sampleProducts
}
