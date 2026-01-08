const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const cartController = require('../controllers/cartController');
const { auth } = require('../middleware/auth');

// 모든 라우트에 인증 필요
router.use(auth);

// 장바구니 조회
router.get('/', cartController.getCart);

// 장바구니에 상품 추가
router.post('/', [
  body('product_id').isInt().withMessage('유효한 상품 ID를 입력해주세요.'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('수량은 1 이상이어야 합니다.')
], cartController.addToCart);

// 장바구니 상품 수량 변경
router.put('/:id', [
  body('quantity').isInt({ min: 1 }).withMessage('수량은 1 이상이어야 합니다.')
], cartController.updateCartItem);

// 장바구니 상품 삭제
router.delete('/:id', cartController.removeFromCart);

// 장바구니 비우기
router.delete('/', cartController.clearCart);

module.exports = router;

