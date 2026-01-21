const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { auth } = require('../middleware/auth');

// 상품의 리뷰 목록 조회 (로그인 불필요)
router.get('/product/:productId', reviewController.getProductReviews);

// 리뷰 작성 (로그인 필요)
router.post('/product/:productId', auth, reviewController.createReview);

// 리뷰 수정 (로그인 필요)
router.put('/:id', auth, reviewController.updateReview);

// 리뷰 삭제 (로그인 필요)
router.delete('/:id', auth, reviewController.deleteReview);

module.exports = router;
