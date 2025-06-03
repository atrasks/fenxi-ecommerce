/**
 * 物流路由
 */

const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/shippingController');
const { isAuth, isAdmin } = require('../middlewares/auth');

/**
 * @route   GET /api/shipping/tracking/:trackingNumber
 * @desc    获取物流跟踪信息（通过物流单号）
 * @access  Public
 */
router.get('/tracking/:trackingNumber', (req, res) => {
  res.status(200).json({ message: '物流跟踪信息查询功能正在开发中' });
});

/**
 * @route   GET /api/shipping/orders/:orderId/tracking
 * @desc    获取订单的物流跟踪信息
 * @access  Private
 */
router.get('/orders/:orderId/tracking', isAuth, shippingController.getShippingTracking);

/**
 * @route   POST /api/shipping/orders/:orderId/tracking
 * @desc    添加订单物流信息（管理员）
 * @access  Admin
 */
router.post('/orders/:orderId/tracking', isAuth, isAdmin, shippingController.addShipping);

/**
 * @route   PUT /api/shipping/orders/:orderId/tracking
 * @desc    更新订单物流信息（管理员）
 * @access  Admin
 */
router.put('/orders/:orderId/tracking', isAuth, isAdmin, shippingController.updateShipping);

/**
 * @route   POST /api/shipping/orders/:orderId/tracking/events
 * @desc    添加物流跟踪事件（管理员）
 * @access  Admin
 */
router.post('/orders/:orderId/tracking/events', isAuth, isAdmin, shippingController.addTrackingRecord);

/**
 * @route   GET /api/shipping/admin/all
 * @desc    获取所有物流信息（管理员）
 * @access  Admin
 */
router.get('/admin/all', isAuth, isAdmin, shippingController.getAllShipping);

/**
 * @route   GET /api/shipping/admin/stats
 * @desc    获取物流统计信息（管理员）
 * @access  Admin
 */
router.get('/admin/stats', isAuth, isAdmin, shippingController.getShippingStats);

/**
 * @route   POST /api/shipping/refresh/:trackingNumber
 * @desc    从第三方API刷新物流信息
 * @access  Admin
 */
router.post('/refresh/:trackingNumber', isAuth, isAdmin, shippingController.refreshShippingTracking);

module.exports = router;