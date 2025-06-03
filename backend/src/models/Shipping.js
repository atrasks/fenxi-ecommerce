/**
 * 国际物流模型
 */

const mongoose = require('mongoose');

/**
 * 物流状态历史记录模式
 */
const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in_transit', 'delivered', 'exception', 'returned']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    default: ''
  }
});

/**
 * 国际物流模式
 */
const shippingSchema = new mongoose.Schema({
  // 关联订单ID
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  // 物流公司
  carrier: {
    type: String,
    required: true,
    trim: true
  },
  // 物流单号
  trackingNumber: {
    type: String,
    required: true,
    trim: true
  },
  // 物流状态
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in_transit', 'delivered', 'exception', 'returned'],
    default: 'pending'
  },
  // 状态历史记录
  statusHistory: [statusHistorySchema],
  // 发货日期
  shippedDate: {
    type: Date,
    default: Date.now
  },
  // 预计送达日期
  estimatedDeliveryDate: {
    type: Date,
    default: null
  },
  // 实际送达日期
  deliveredDate: {
    type: Date,
    default: null
  },
  // 跟踪历史
  trackingHistory: [
    {
      timestamp: {
        type: Date,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      location: {
        type: String,
        default: ''
      },
      statusCode: {
        type: String,
        default: 'unknown'
      }
    }
  ],
  // 备注
  notes: {
    type: String,
    default: ''
  },
  // 原始API响应
  apiResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // 最后更新时间
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 创建索引
shippingSchema.index({ order: 1 }, { unique: true });
shippingSchema.index({ trackingNumber: 1 });
shippingSchema.index({ carrier: 1 });
shippingSchema.index({ status: 1 });
shippingSchema.index({ shippedDate: 1 });

// 更新最后更新时间的中间件
shippingSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

const Shipping = mongoose.model('Shipping', shippingSchema);

module.exports = Shipping;