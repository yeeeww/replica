const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const productController = require('../controllers/productController');
const { auth, adminAuth } = require('../middleware/auth');

// 상품 목록 조회
router.get('/', productController.getProducts);

// 상품 상세 조회
router.get('/:id', productController.getProduct);

// 상품 생성 (관리자)
router.post('/', [
  auth,
  adminAuth,
  body('name').notEmpty().withMessage('상품명을 입력해주세요.'),
  body('price').isFloat({ min: 0 }).withMessage('유효한 가격을 입력해주세요.'),
  body('category_id').isInt().withMessage('카테고리를 선택해주세요.')
], productController.createProduct);

// 상품 수정 (관리자)
router.put('/:id', [
  auth,
  adminAuth,
  body('name').notEmpty().withMessage('상품명을 입력해주세요.'),
  body('price').isFloat({ min: 0 }).withMessage('유효한 가격을 입력해주세요.')
], productController.updateProduct);

// 상품 삭제 (관리자)
router.delete('/:id', auth, adminAuth, productController.deleteProduct);

module.exports = router;

