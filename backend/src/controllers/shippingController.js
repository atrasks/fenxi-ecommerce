/**
 * 国际物流控制器
 */

const asyncHandler = require('express-async-handler');
const Shipping = require('../models/Shipping');
const Order = require('../models/Order');
const { createShippingTracker } = require('../services/shippingService');

/**
 * @desc    获取订单的物流信息
 * @route   GET /api/shipping/order/:orderId
 * @access  Private
 */
const getOrderShipping = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId;

  const shipping = await Shipping.findOne({ order: orderId });

  if (!shipping) {
    res.status(404);
    throw new Error('该订单暂无物流信息');
  }

  res.status(200).json(shipping);
});

/**
 * @desc    获取物流跟踪信息
 * @route   GET /api/shipping/track/:trackingNumber
 * @access  Private
 */
const getTrackingInfo = asyncHandler(async (req, res) => {
  const trackingNumber = req.params.trackingNumber;

  const shipping = await Shipping.findOne({ trackingNumber });

  if (!shipping) {
    res.status(404);
    throw new Error('未找到该物流单号的信息');
  }

  // 如果物流信息最后更新时间超过6小时，则从第三方API获取最新信息
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  if (shipping.lastUpdated < sixHoursAgo) {
    await refreshTrackingInfoInternal(shipping);
  }

  res.status(200).json(shipping);
});

/**
 * @desc    从第三方API更新物流跟踪信息
 * @route   PUT /api/shipping/:shippingId/refresh
 * @access  Private
 */
const refreshTrackingInfo = asyncHandler(async (req, res) => {
  const shippingId = req.params.shippingId;

  const shipping = await Shipping.findById(shippingId);

  if (!shipping) {
    res.status(404);
    throw new Error('未找到该物流信息');
  }

  await refreshTrackingInfoInternal(shipping);

  res.status(200).json(shipping);
});

/**
 * 内部函数：从第三方API更新物流跟踪信息
 */
const refreshTrackingInfoInternal = async (shipping) => {
  try {
    const tracker = createShippingTracker(shipping.carrier);
    const trackingInfo = await tracker.getTracking(shipping.trackingNumber);

    // 更新物流状态
    shipping.status = trackingInfo.status;
    shipping.trackingHistory = trackingInfo.trackingHistory;
    shipping.apiResponse = trackingInfo.apiResponse;
    shipping.lastUpdated = new Date();

    // 如果状态变更，添加到状态历史
    const lastStatus = shipping.statusHistory.length > 0 
      ? shipping.statusHistory[shipping.statusHistory.length - 1].status 
      : null;

    if (lastStatus !== trackingInfo.status) {
      shipping.statusHistory.push({
        status: trackingInfo.status,
        timestamp: new Date(),
        note: '系统自动更新'
      });
    }

    // 如果已送达，更新送达日期
    if (trackingInfo.status === 'delivered' && !shipping.deliveredDate) {
      shipping.deliveredDate = new Date();

      // 更新订单状态为已送达
      const order = await Order.findById(shipping.order);
      if (order && order.status !== 'delivered') {
        order.status = 'delivered';
        order.deliveredAt = new Date();
        await order.save();
      }
    }

    // 如果有预计送达日期
    if (trackingInfo.estimatedDeliveryDate) {
      shipping.estimatedDeliveryDate = trackingInfo.estimatedDeliveryDate;
    }

    await shipping.save();
    return shipping;
  } catch (error) {
    console.error('更新物流信息失败:', error);
    // 不抛出错误，只记录日志
    return shipping;
  }
};

/**
 * @desc    管理员添加物流信息
 * @route   POST /api/shipping
 * @access  Private/Admin
 */
const addShipping = asyncHandler(async (req, res) => {
  const { orderId, carrier, trackingNumber, notes } = req.body;

  // 检查订单是否存在
  const order = await Order.findById(orderId);
  if (!order) {
    res.status(404);
    throw new Error('订单不存在');
  }

  // 检查是否已存在该订单的物流信息
  const existingShipping = await Shipping.findOne({ order: orderId });
  if (existingShipping) {
    res.status(400);
    throw new Error('该订单已存在物流信息');
  }

  // 创建物流信息
  const shipping = await Shipping.create({
    order: orderId,
    carrier,
    trackingNumber,
    notes,
    status: 'pending',
    statusHistory: [
      {
        status: 'pending',
        timestamp: new Date(),
        note: '物流信息已创建'
      }
    ]
  });

  // 更新订单状态为已发货
  order.status = 'shipped';
  order.shippedAt = new Date();
  await order.save();

  // 尝试从第三方API获取物流信息
  try {
    await refreshTrackingInfoInternal(shipping);
  } catch (error) {
    // 忽略错误，继续返回创建的物流信息
    console.error('获取物流信息失败:', error);
  }

  res.status(201).json(shipping);
});

/**
 * @desc    管理员更新物流信息
 * @route   PUT /api/shipping/:shippingId
 * @access  Private/Admin
 */
const updateShipping = asyncHandler(async (req, res) => {
  const shippingId = req.params.shippingId;
  const { carrier, trackingNumber, status, notes } = req.body;

  const shipping = await Shipping.findById(shippingId);

  if (!shipping) {
    res.status(404);
    throw new Error('未找到该物流信息');
  }

  // 更新物流信息
  if (carrier) shipping.carrier = carrier;
  if (trackingNumber) shipping.trackingNumber = trackingNumber;
  if (notes) shipping.notes = notes;

  // 如果状态变更，添加到状态历史
  if (status && status !== shipping.status) {
    shipping.status = status;
    shipping.statusHistory.push({
      status,
      timestamp: new Date(),
      note: req.body.statusNote || '管理员手动更新'
    });

    // 如果状态为已送达，更新送达日期
    if (status === 'delivered' && !shipping.deliveredDate) {
      shipping.deliveredDate = new Date();

      // 更新订单状态为已送达
      const order = await Order.findById(shipping.order);
      if (order && order.status !== 'delivered') {
        order.status = 'delivered';
        order.deliveredAt = new Date();
        await order.save();
      }
    }
  }

  await shipping.save();

  res.status(200).json(shipping);
});

/**
 * @desc    管理员添加物流跟踪记录
 * @route   POST /api/shipping/:shippingId/events
 * @access  Private/Admin
 */
const addTrackingEvent = asyncHandler(async (req, res) => {
  const shippingId = req.params.shippingId;
  const { description, location, statusCode } = req.body;

  const shipping = await Shipping.findById(shippingId);

  if (!shipping) {
    res.status(404);
    throw new Error('未找到该物流信息');
  }

  // 添加跟踪记录
  shipping.trackingHistory.push({
    timestamp: new Date(),
    description,
    location: location || '',
    statusCode: statusCode || 'unknown'
  });

  // 如果提供了状态码，更新物流状态
  if (statusCode) {
    const tracker = createShippingTracker(shipping.carrier);
    const status = tracker.mapStatusCode(statusCode);
    
    if (status && status !== shipping.status) {
      shipping.status = status;
      shipping.statusHistory.push({
        status,
        timestamp: new Date(),
        note: '根据新添加的跟踪记录更新'
      });

      // 如果状态为已送达，更新送达日期
      if (status === 'delivered' && !shipping.deliveredDate) {
        shipping.deliveredDate = new Date();

        // 更新订单状态为已送达
        const order = await Order.findById(shipping.order);
        if (order && order.status !== 'delivered') {
          order.status = 'delivered';
          order.deliveredAt = new Date();
          await order.save();
        }
      }
    }
  }

  await shipping.save();

  res.status(200).json(shipping);
});

/**
 * @desc    管理员获取所有物流信息
 * @route   GET /api/shipping
 * @access  Private/Admin
 */
const getAllShippings = asyncHandler(async (req, res) => {
  const pageSize = Number(req.query.pageSize) || 10;
  const page = Number(req.query.page) || 1;

  // 构建查询条件
  const queryFilter = {};
  
  // 按状态筛选
  if (req.query.status) {
    queryFilter.status = req.query.status;
  }
  
  // 按物流公司筛选
  if (req.query.carrier) {
    queryFilter.carrier = { $regex: req.query.carrier, $options: 'i' };
  }
  
  // 按物流单号筛选
  if (req.query.trackingNumber) {
    queryFilter.trackingNumber = { $regex: req.query.trackingNumber, $options: 'i' };
  }

  // 按日期范围筛选
  if (req.query.startDate && req.query.endDate) {
    queryFilter.shippedDate = {
      $gte: new Date(req.query.startDate),
      $lte: new Date(req.query.endDate)
    };
  } else if (req.query.startDate) {
    queryFilter.shippedDate = { $gte: new Date(req.query.startDate) };
  } else if (req.query.endDate) {
    queryFilter.shippedDate = { $lte: new Date(req.query.endDate) };
  }

  const count = await Shipping.countDocuments(queryFilter);
  
  const shippings = await Shipping.find(queryFilter)
    .populate('order', 'orderNumber totalPrice user')
    .sort({ createdAt: -1 })
    .limit(pageSize)
    .skip(pageSize * (page - 1));

  res.status(200).json({
    shippings,
    page,
    pages: Math.ceil(count / pageSize),
    total: count
  });
});

/**
 * @desc    管理员获取物流统计信息
 * @route   GET /api/shipping/stats
 * @access  Private/Admin
 */
const getShippingStats = asyncHandler(async (req, res) => {
  // 按状态统计
  const statusStats = await Shipping.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // 按物流公司统计
  const carrierStats = await Shipping.aggregate([
    { $group: { _id: '$carrier', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // 最近7天的物流统计
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const dailyStats = await Shipping.aggregate([
    { 
      $match: { 
        createdAt: { $gte: sevenDaysAgo } 
      } 
    },
    {
      $group: {
        _id: { 
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } 
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    statusStats,
    carrierStats,
    dailyStats
  });
});

module.exports = {
  getOrderShipping,
  getTrackingInfo,
  refreshTrackingInfo,
  addShipping,
  updateShipping,
  addTrackingEvent,
  getAllShippings,
  getShippingStats
};