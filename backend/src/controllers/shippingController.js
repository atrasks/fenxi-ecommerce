/**
 * 国际物流控制器
 * 处理物流跟踪、物流状态更新等功能
 */

const Shipping = require('../models/Shipping');
const Order = require('../models/Order');
const { createShippingTracker } = require('../services/shippingService');

/**
 * @desc    获取订单物流信息
 * @route   GET /api/shipping/:orderId
 * @access  Private
 */
const getOrderShipping = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // 查找订单的物流信息
    const shipping = await Shipping.findOne({ orderId });
    
    if (!shipping) {
      return res.status(404).json({ message: '未找到该订单的物流信息' });
    }
    
    res.status(200).json(shipping);
  } catch (error) {
    console.error('获取订单物流信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * @desc    获取物流跟踪信息
 * @route   GET /api/shipping/:orderId/tracking
 * @access  Private
 */
const getShippingTracking = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // 查找订单的物流信息
    const shipping = await Shipping.findOne({ orderId });
    
    if (!shipping) {
      return res.status(404).json({ message: '未找到该订单的物流信息' });
    }
    
    // 返回物流跟踪历史
    res.status(200).json({
      tracking: shipping.trackingHistory,
      carrier: shipping.carrier,
      trackingNumber: shipping.trackingNumber,
      status: shipping.status,
      estimatedDeliveryDate: shipping.estimatedDeliveryDate
    });
  } catch (error) {
    console.error('获取物流跟踪信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * @desc    更新物流跟踪信息（从第三方API）
 * @route   GET /api/shipping/:orderId/refresh
 * @access  Private
 */
const refreshShippingTracking = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // 查找订单的物流信息
    const shipping = await Shipping.findOne({ orderId });
    
    if (!shipping) {
      return res.status(404).json({ message: '未找到该订单的物流信息' });
    }
    
    // 创建物流跟踪服务实例
    const tracker = createShippingTracker(shipping.carrier);
    
    // 从第三方API获取最新物流信息
    const trackingInfo = await tracker.getTracking(shipping.trackingNumber);
    
    // 更新物流信息
    shipping.status = trackingInfo.status;
    shipping.trackingHistory = trackingInfo.trackingHistory;
    shipping.estimatedDeliveryDate = trackingInfo.estimatedDeliveryDate;
    shipping.lastUpdated = new Date();
    shipping.rawApiResponse = trackingInfo.rawData;
    
    // 如果物流状态为已送达，更新订单状态
    if (trackingInfo.status === 'delivered') {
      shipping.deliveredDate = new Date();
      
      // 更新关联订单
      const order = await Order.findById(orderId);
      if (order) {
        order.status = 'delivered';
        order.isDelivered = true;
        order.deliveredAt = new Date();
        await order.save();
      }
    }
    
    await shipping.save();
    
    res.status(200).json({
      message: '物流信息已更新',
      tracking: shipping.trackingHistory,
      status: shipping.status
    });
  } catch (error) {
    console.error('更新物流跟踪信息失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

/**
 * @desc    管理员添加物流信息
 * @route   POST /api/admin/shipping
 * @access  Admin
 */
const addShipping = async (req, res) => {
  try {
    const { orderId, carrier, trackingNumber, notes } = req.body;
    
    // 检查订单是否存在
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: '订单不存在' });
    }
    
    // 检查是否已有物流信息
    let shipping = await Shipping.findOne({ orderId });
    
    if (shipping) {
      return res.status(400).json({ message: '该订单已有物流信息' });
    }
    
    // 创建新的物流信息
    shipping = new Shipping({
      orderId,
      carrier,
      trackingNumber,
      notes,
      status: 'pending',
      shippedDate: new Date(),
      trackingHistory: [
        {
          timestamp: new Date(),
          description: '物流信息已创建',
          location: '发货仓库'
        }
      ]
    });
    
    // 保存物流信息
    await shipping.save();
    
    // 更新订单状态
    order.status = 'shipped';
    order.isShipped = true;
    order.shippedAt = new Date();
    order.shipping = shipping._id;
    await order.save();
    
    res.status(201).json({
      message: '物流信息已添加',
      shipping
    });
  } catch (error) {
    console.error('添加物流信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * @desc    管理员更新物流信息
 * @route   PUT /api/admin/shipping/:id
 * @access  Admin
 */
const updateShipping = async (req, res) => {
  try {
    const { id } = req.params;
    const { carrier, trackingNumber, status, notes } = req.body;
    
    // 查找物流信息
    const shipping = await Shipping.findById(id);
    
    if (!shipping) {
      return res.status(404).json({ message: '物流信息不存在' });
    }
    
    // 更新物流信息
    if (carrier) shipping.carrier = carrier;
    if (trackingNumber) shipping.trackingNumber = trackingNumber;
    if (status) shipping.status = status;
    if (notes) shipping.notes = notes;
    
    // 添加状态变更记录
    if (status && status !== shipping.status) {
      shipping.trackingHistory.unshift({
        timestamp: new Date(),
        description: `物流状态更新为: ${status}`,
        statusCode: status
      });
    }
    
    shipping.lastUpdated = new Date();
    
    // 保存物流信息
    await shipping.save();
    
    // 如果状态为已送达，更新订单状态
    if (status === 'delivered') {
      shipping.deliveredDate = new Date();
      
      // 更新关联订单
      const order = await Order.findById(shipping.orderId);
      if (order) {
        order.status = 'delivered';
        order.isDelivered = true;
        order.deliveredAt = new Date();
        await order.save();
      }
    }
    
    res.status(200).json({
      message: '物流信息已更新',
      shipping
    });
  } catch (error) {
    console.error('更新物流信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * @desc    管理员添加物流跟踪记录
 * @route   POST /api/admin/shipping/:id/tracking
 * @access  Admin
 */
const addTrackingRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, location, statusCode } = req.body;
    
    // 查找物流信息
    const shipping = await Shipping.findById(id);
    
    if (!shipping) {
      return res.status(404).json({ message: '物流信息不存在' });
    }
    
    // 添加跟踪记录
    const trackingRecord = {
      timestamp: new Date(),
      description,
      location,
      statusCode
    };
    
    shipping.trackingHistory.unshift(trackingRecord);
    shipping.lastUpdated = new Date();
    
    // 如果提供了状态码，更新物流状态
    if (statusCode) {
      shipping.status = statusCode;
      
      // 如果状态为已送达，更新订单状态
      if (statusCode === 'delivered') {
        shipping.deliveredDate = new Date();
        
        // 更新关联订单
        const order = await Order.findById(shipping.orderId);
        if (order) {
          order.status = 'delivered';
          order.isDelivered = true;
          order.deliveredAt = new Date();
          await order.save();
        }
      }
    }
    
    // 保存物流信息
    await shipping.save();
    
    res.status(201).json({
      message: '物流跟踪记录已添加',
      tracking: shipping.trackingHistory
    });
  } catch (error) {
    console.error('添加物流跟踪记录失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * @desc    获取所有物流信息（管理员）
 * @route   GET /api/admin/shipping
 * @access  Admin
 */
const getAllShipping = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, carrier } = req.query;
    
    // 构建查询条件
    const query = {};
    if (status) query.status = status;
    if (carrier) query.carrier = carrier;
    
    // 计算分页
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 查询物流信息
    const shipping = await Shipping.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // 计算总数
    const total = await Shipping.countDocuments(query);
    
    res.status(200).json({
      shipping,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    });
  } catch (error) {
    console.error('获取所有物流信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * @desc    获取物流统计信息（管理员）
 * @route   GET /api/admin/shipping/stats
 * @access  Admin
 */
const getShippingStats = async (req, res) => {
  try {
    // 按状态统计
    const statusStats = await Shipping.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 按物流公司统计
    const carrierStats = await Shipping.aggregate([
      {
        $group: {
          _id: '$carrier',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 最近7天的物流数据
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
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.day': 1
        }
      }
    ]);
    
    res.status(200).json({
      statusStats,
      carrierStats,
      dailyStats
    });
  } catch (error) {
    console.error('获取物流统计信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

module.exports = {
  getOrderShipping,
  getShippingTracking,
  refreshShippingTracking,
  addShipping,
  updateShipping,
  addTrackingRecord,
  getAllShipping,
  getShippingStats
};