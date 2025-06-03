/**
 * 国际物流控制器
 * 处理物流信息的获取、更新和管理
 */

const Shipping = require('../models/Shipping');
const Order = require('../models/Order');
const { createShippingTracker } = require('../services/shippingService');
const mongoose = require('mongoose');

/**
 * 获取订单的物流信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Object} - 物流信息
 */
exports.getOrderShipping = async (req, res) => {
  try {
    const { orderId } = req.params;

    // 验证订单ID格式
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: '无效的订单ID格式' });
    }

    // 查找订单关联的物流信息
    const shipping = await Shipping.findOne({ order: orderId });

    if (!shipping) {
      return res.status(404).json({ message: '未找到该订单的物流信息' });
    }

    res.status(200).json(shipping);
  } catch (error) {
    console.error('获取订单物流信息失败:', error);
    res.status(500).json({ message: '获取订单物流信息失败', error: error.message });
  }
};

/**
 * 获取物流跟踪信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Object} - 物流跟踪信息
 */
exports.getTrackingInfo = async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    const { carrier } = req.query;

    if (!trackingNumber) {
      return res.status(400).json({ message: '物流单号不能为空' });
    }

    if (!carrier) {
      return res.status(400).json({ message: '物流公司代码不能为空' });
    }

    // 创建对应物流公司的跟踪器
    const tracker = createShippingTracker(carrier);
    
    // 获取跟踪信息
    const trackingInfo = await tracker.getTracking(trackingNumber);

    res.status(200).json(trackingInfo);
  } catch (error) {
    console.error('获取物流跟踪信息失败:', error);
    res.status(500).json({ message: '获取物流跟踪信息失败', error: error.message });
  }
};

/**
 * 从第三方API更新物流跟踪信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Object} - 更新后的物流信息
 */
exports.refreshTrackingInfo = async (req, res) => {
  try {
    const { shippingId } = req.params;

    // 验证物流ID格式
    if (!mongoose.Types.ObjectId.isValid(shippingId)) {
      return res.status(400).json({ message: '无效的物流ID格式' });
    }

    // 查找物流信息
    const shipping = await Shipping.findById(shippingId);

    if (!shipping) {
      return res.status(404).json({ message: '未找到物流信息' });
    }

    // 创建对应物流公司的跟踪器
    const tracker = createShippingTracker(shipping.carrier);
    
    // 获取最新的跟踪信息
    const trackingInfo = await tracker.getTracking(shipping.trackingNumber);

    // 更新物流信息
    shipping.status = trackingInfo.status;
    shipping.trackingHistory = trackingInfo.trackingHistory;
    shipping.estimatedDeliveryDate = trackingInfo.estimatedDeliveryDate;
    shipping.apiResponse = trackingInfo.rawData;
    shipping.lastUpdated = new Date();

    // 如果物流状态为已送达，更新送达日期
    if (trackingInfo.status === 'delivered' && !shipping.deliveredDate) {
      shipping.deliveredDate = new Date();
      
      // 更新关联订单的状态
      if (shipping.order) {
        const order = await Order.findById(shipping.order);
        if (order) {
          order.status = 'delivered';
          await order.save();
        }
      }
    }

    await shipping.save();

    res.status(200).json(shipping);
  } catch (error) {
    console.error('更新物流跟踪信息失败:', error);
    res.status(500).json({ message: '更新物流跟踪信息失败', error: error.message });
  }
};

/**
 * 管理员添加物流信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Object} - 新创建的物流信息
 */
exports.addShipping = async (req, res) => {
  try {
    const { 
      orderId, 
      carrier, 
      trackingNumber, 
      status = 'pending',
      shippedDate,
      estimatedDeliveryDate,
      notes
    } = req.body;

    // 验证必填字段
    if (!orderId || !carrier || !trackingNumber) {
      return res.status(400).json({ 
        message: '订单ID、物流公司和物流单号为必填项' 
      });
    }

    // 验证订单ID格式
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: '无效的订单ID格式' });
    }

    // 检查订单是否存在
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: '未找到相关订单' });
    }

    // 检查是否已存在该订单的物流信息
    const existingShipping = await Shipping.findOne({ order: orderId });
    if (existingShipping) {
      return res.status(400).json({ 
        message: '该订单已存在物流信息，请使用更新接口' 
      });
    }

    // 创建新的物流信息
    const newShipping = new Shipping({
      order: orderId,
      carrier,
      trackingNumber,
      status,
      shippedDate: shippedDate ? new Date(shippedDate) : new Date(),
      estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null,
      notes
    });

    // 尝试从第三方API获取物流信息
    try {
      const tracker = createShippingTracker(carrier);
      const trackingInfo = await tracker.getTracking(trackingNumber);
      
      newShipping.status = trackingInfo.status;
      newShipping.trackingHistory = trackingInfo.trackingHistory;
      newShipping.estimatedDeliveryDate = trackingInfo.estimatedDeliveryDate || newShipping.estimatedDeliveryDate;
      newShipping.apiResponse = trackingInfo.rawData;
    } catch (trackingError) {
      console.warn('获取第三方物流信息失败，使用默认值:', trackingError.message);
      // 如果获取失败，使用默认值，不影响创建流程
    }

    // 保存物流信息
    await newShipping.save();

    // 更新订单状态为已发货
    order.status = 'shipped';
    await order.save();

    res.status(201).json(newShipping);
  } catch (error) {
    console.error('添加物流信息失败:', error);
    res.status(500).json({ message: '添加物流信息失败', error: error.message });
  }
};

/**
 * 管理员更新物流信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Object} - 更新后的物流信息
 */
exports.updateShipping = async (req, res) => {
  try {
    const { shippingId } = req.params;
    const { 
      carrier, 
      trackingNumber, 
      status,
      shippedDate,
      estimatedDeliveryDate,
      deliveredDate,
      notes
    } = req.body;

    // 验证物流ID格式
    if (!mongoose.Types.ObjectId.isValid(shippingId)) {
      return res.status(400).json({ message: '无效的物流ID格式' });
    }

    // 查找物流信息
    const shipping = await Shipping.findById(shippingId);

    if (!shipping) {
      return res.status(404).json({ message: '未找到物流信息' });
    }

    // 更新字段
    if (carrier) shipping.carrier = carrier;
    if (trackingNumber) shipping.trackingNumber = trackingNumber;
    if (shippedDate) shipping.shippedDate = new Date(shippedDate);
    if (estimatedDeliveryDate) shipping.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
    if (notes !== undefined) shipping.notes = notes;

    // 如果状态发生变化，记录状态变更历史
    if (status && status !== shipping.status) {
      shipping.statusHistory.push({
        status: shipping.status,
        timestamp: new Date(),
        note: `状态从 ${shipping.status} 变更为 ${status}`
      });
      shipping.status = status;

      // 如果状态变为已送达，更新送达日期
      if (status === 'delivered' && !shipping.deliveredDate) {
        shipping.deliveredDate = deliveredDate ? new Date(deliveredDate) : new Date();
        
        // 更新关联订单的状态
        if (shipping.order) {
          const order = await Order.findById(shipping.order);
          if (order) {
            order.status = 'delivered';
            await order.save();
          }
        }
      }
    } else if (deliveredDate && status === 'delivered') {
      // 如果明确设置了送达日期且状态为已送达
      shipping.deliveredDate = new Date(deliveredDate);
    }

    // 如果更新了物流公司或单号，尝试重新获取物流信息
    if ((carrier && carrier !== shipping.carrier) || 
        (trackingNumber && trackingNumber !== shipping.trackingNumber)) {
      try {
        const tracker = createShippingTracker(carrier || shipping.carrier);
        const trackingInfo = await tracker.getTracking(trackingNumber || shipping.trackingNumber);
        
        shipping.trackingHistory = trackingInfo.trackingHistory;
        shipping.apiResponse = trackingInfo.rawData;
        
        // 只有当没有明确设置状态时，才使用API返回的状态
        if (!status) {
          shipping.status = trackingInfo.status;
        }
        
        // 只有当没有明确设置预计送达日期时，才使用API返回的日期
        if (!estimatedDeliveryDate && trackingInfo.estimatedDeliveryDate) {
          shipping.estimatedDeliveryDate = trackingInfo.estimatedDeliveryDate;
        }
      } catch (trackingError) {
        console.warn('获取第三方物流信息失败:', trackingError.message);
        // 如果获取失败，继续使用现有数据，不影响更新流程
      }
    }

    shipping.lastUpdated = new Date();
    await shipping.save();

    res.status(200).json(shipping);
  } catch (error) {
    console.error('更新物流信息失败:', error);
    res.status(500).json({ message: '更新物流信息失败', error: error.message });
  }
};

/**
 * 管理员添加物流跟踪记录
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Object} - 更新后的物流信息
 */
exports.addTrackingEvent = async (req, res) => {
  try {
    const { shippingId } = req.params;
    const { description, location, status, timestamp } = req.body;

    // 验证必填字段
    if (!description) {
      return res.status(400).json({ message: '事件描述为必填项' });
    }

    // 验证物流ID格式
    if (!mongoose.Types.ObjectId.isValid(shippingId)) {
      return res.status(400).json({ message: '无效的物流ID格式' });
    }

    // 查找物流信息
    const shipping = await Shipping.findById(shippingId);

    if (!shipping) {
      return res.status(404).json({ message: '未找到物流信息' });
    }

    // 创建新的跟踪事件
    const newEvent = {
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      description,
      location: location || '',
      statusCode: status || shipping.status
    };

    // 添加到跟踪历史
    shipping.trackingHistory.push(newEvent);

    // 如果提供了新状态，更新物流状态
    if (status && status !== shipping.status) {
      shipping.statusHistory.push({
        status: shipping.status,
        timestamp: new Date(),
        note: `状态从 ${shipping.status} 变更为 ${status}`
      });
      shipping.status = status;

      // 如果状态变为已送达，更新送达日期
      if (status === 'delivered' && !shipping.deliveredDate) {
        shipping.deliveredDate = new Date();
        
        // 更新关联订单的状态
        if (shipping.order) {
          const order = await Order.findById(shipping.order);
          if (order) {
            order.status = 'delivered';
            await order.save();
          }
        }
      }
    }

    shipping.lastUpdated = new Date();
    await shipping.save();

    res.status(200).json(shipping);
  } catch (error) {
    console.error('添加物流跟踪事件失败:', error);
    res.status(500).json({ message: '添加物流跟踪事件失败', error: error.message });
  }
};

/**
 * 管理员获取所有物流信息（支持分页和过滤）
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Object} - 物流信息列表
 */
exports.getAllShippings = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      carrier,
      trackingNumber,
      orderId,
      startDate,
      endDate,
      sort = '-createdAt'
    } = req.query;

    // 构建查询条件
    const query = {};
    
    if (status) query.status = status;
    if (carrier) query.carrier = carrier;
    if (trackingNumber) query.trackingNumber = { $regex: trackingNumber, $options: 'i' };
    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) query.order = orderId;
    
    // 日期范围过滤
    if (startDate || endDate) {
      query.shippedDate = {};
      if (startDate) query.shippedDate.$gte = new Date(startDate);
      if (endDate) query.shippedDate.$lte = new Date(endDate);
    }

    // 计算总数
    const total = await Shipping.countDocuments(query);
    
    // 获取分页数据
    const shippings = await Shipping.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('order', 'orderNumber customer totalAmount');

    res.status(200).json({
      shippings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取物流信息列表失败:', error);
    res.status(500).json({ message: '获取物流信息列表失败', error: error.message });
  }
};

/**
 * 管理员获取物流统计信息
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Object} - 物流统计信息
 */
exports.getShippingStats = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('获取物流统计信息失败:', error);
    res.status(500).json({ message: '获取物流统计信息失败', error: error.message });
  }
};