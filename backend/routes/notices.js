const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/noticeController');
const { auth, adminAuth } = require('../middleware/auth');

// 공개 라우트
router.get('/', noticeController.getNotices);
router.get('/:id', noticeController.getNotice);

// 관리자 전용 라우트
router.post('/', auth, adminAuth, noticeController.createNotice);
router.put('/:id', auth, adminAuth, noticeController.updateNotice);
router.delete('/:id', auth, adminAuth, noticeController.deleteNotice);

module.exports = router;
