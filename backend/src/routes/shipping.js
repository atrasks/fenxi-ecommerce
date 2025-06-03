/**
 * 物流路由
 */

const express = require('express');
const router = express.Router();
const { 
  getOrderShipping, 
  getTrackingInfo, 
  refreshTrackingInfo,
  addShipping,
  updateShipping,
  addTrackingEvent,
  getAllShippings,
  getShippingStats
} = require('../controllers/shippingController');
const { protect, admin } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/shipping/order/:orderId
 * @desc    获取订单的物流信息
 * @access  Private
 */
router.get('/order/:orderId', protect, getOrderShipping);

/**
 * @route   GET /api/shipping/track/:trackingNumber
 * @desc    获取物流跟踪信息
 * @access  Private
 */
router.get('/track/:trackingNumber', protect, getTrackingInfo);

/**
 * @route   POST /api/shipping
 * @desc    管理员添加物流信息
 * @access  Private/Admin
 */
router.post('/', protect, admin, addShipping);

/**
 * @route   PUT /api/shipping/:shippingId
 * @desc    管理员更新物流信息
 * @access  Private/Admin
 */
router.put('/:shippingId', protect, admin, updateShipping);

/**
 * @route   POST /api/shipping/:shippingId/events
 * @desc    管理员添加物流跟踪事件
 * @access  Private/Admin
 */
router.post('/:shippingId/events', protect, admin, addTrackingEvent);

/**
 * @route   GET /api/shipping
 * @desc    管理员获取所有物流信息
 * @access  Private/Admin
 */
router.get('/', protect, admin, getAllShippings);

/**
 * @route   GET /api/shipping/stats
 * @desc    管理员获取物流统计信息
 * @access  Private/Admin
 */
router.get('/stats', protect, admin, getShippingStats);

/**
 * @route   PUT /api/shipping/:shippingId/refresh
 * @desc    刷新物流信息
 * @access  Private
 */
router.put('/:shippingId/refresh', protect, refreshTrackingInfo);

module.exports = router;