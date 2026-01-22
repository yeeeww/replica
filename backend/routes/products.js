const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const productController = require('../controllers/productController');
const { auth, adminAuth } = require('../middleware/auth');
const pool = require('../config/database');

// 상품 목록 조회
router.get('/', productController.getProducts);

// Weekly Best 상품 조회 (대분류별) - 공개 API
router.get('/weekly-best/:categorySlug', async (req, res) => {
  const client = await pool.connect();
  try {
    const { categorySlug } = req.params;
    const { limit = 10 } = req.query;

    const result = await client.query(`
      SELECT p.id, p.name, p.price, p.department_price, p.image_url, p.is_active,
             c.name as category_name, c.slug as category_slug
      FROM weekly_best_products wb
      JOIN products p ON wb.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE wb.category_slug = $1 AND p.is_active = true
      ORDER BY wb.display_order ASC
      LIMIT $2
    `, [categorySlug, parseInt(limit)]);

    res.json({ products: result.rows });
  } catch (error) {
    console.error('Get weekly best products error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

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

