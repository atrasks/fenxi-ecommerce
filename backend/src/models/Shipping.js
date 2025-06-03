/**
 * 国际物流模型
 * 用于存储物流公司、物流单号、物流状态等信息
 */

const mongoose = require('mongoose');

// 物流状态历史记录模式
const trackingHistorySchema = new mongoose.Schema({
  // 状态时间
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  // 状态描述
  description: {
    type: String,
    required: true
  },
  // 状态位置
  location: {
    type: String,
    required: false
  },
  // 状态代码
  statusCode: {
    type: String,
    required: false
  }
});

// 国际物流模式
const shippingSchema = new mongoose.Schema({
  // 关联订单ID
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  // 物流公司
  carrier: {
    type: String,
    required: true,
    enum: ['DHL', 'UPS', 'FedEx', 'TNT', '17Track', '菜鸟', '云途', '其他']
  },
  // 物流单号
  trackingNumber: {
    type: String,
    required: true
  },
  // 物流状态
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned', 'unknown'],
    default: 'pending'
  },
  // 发货日期
  shippedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  // 预计送达日期
  estimatedDeliveryDate: {
    type: Date,
    required: false
  },
  // 实际送达日期
  deliveredDate: {
    type: Date,
    required: false
  },
  // 物流跟踪历史
  trackingHistory: [trackingHistorySchema],
  // 物流备注
  notes: {
    type: String,
    required: false
  },
  // 物流API响应原始数据
  rawApiResponse: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  // 最后更新时间
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// 创建索引
shippingSchema.index({ orderId: 1 });
shippingSchema.index({ trackingNumber: 1 });
shippingSchema.index({ carrier: 1 });
shippingSchema.index({ status: 1 });

// 更新最后更新时间的中间件
shippingSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

const Shipping = mongoose.model('Shipping', shippingSchema);

module.exports = Shipping;