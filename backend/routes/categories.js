const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const categoryController = require('../controllers/categoryController');
const { auth, adminAuth } = require('../middleware/auth');

// 카테고리 목록 조회
router.get('/', categoryController.getCategories);

// 카테고리 생성 (관리자)
router.post('/', [
  auth,
  adminAuth,
  body('name').notEmpty().withMessage('카테고리명을 입력해주세요.'),
  body('slug').notEmpty().withMessage('슬러그를 입력해주세요.')
], categoryController.createCategory);

// 카테고리 수정 (관리자)
router.put('/:id', [
  auth,
  adminAuth,
  body('name').notEmpty().withMessage('카테고리명을 입력해주세요.'),
  body('slug').notEmpty().withMessage('슬러그를 입력해주세요.')
], categoryController.updateCategory);

// 카테고리 삭제 (관리자)
router.delete('/:id', auth, adminAuth, categoryController.deleteCategory);

module.exports = router;

