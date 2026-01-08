const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const orderController = require('../controllers/orderController');
const { auth, adminAuth } = require('../middleware/auth');

// 모든 라우트에 인증 필요
router.use(auth);

// 주문 목록 조회
router.get('/', orderController.getOrders);

// 주문 상세 조회
router.get('/:id', orderController.getOrder);

// 주문 생성
router.post('/', [
  body('shipping_name').notEmpty().withMessage('수령인 이름을 입력해주세요.'),
  body('shipping_phone').notEmpty().withMessage('연락처를 입력해주세요.'),
  body('shipping_address').notEmpty().withMessage('배송 주소를 입력해주세요.'),
  body('items').isArray({ min: 1 }).withMessage('주문할 상품을 선택해주세요.')
], orderController.createOrder);

// 주문 상태 변경 (관리자)
router.patch('/:id/status', [
  adminAuth,
  body('status').notEmpty().withMessage('상태를 입력해주세요.')
], orderController.updateOrderStatus);

module.exports = router;

