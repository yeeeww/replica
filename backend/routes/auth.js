const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// 회원가입
router.post('/register', [
  body('email').isEmail().withMessage('유효한 이메일을 입력해주세요.'),
  body('password').isLength({ min: 6 }).withMessage('비밀번호는 최소 6자 이상이어야 합니다.'),
  body('name').notEmpty().withMessage('이름을 입력해주세요.')
], authController.register);

// 로그인
router.post('/login', [
  body('email').isEmail().withMessage('유효한 이메일을 입력해주세요.'),
  body('password').notEmpty().withMessage('비밀번호를 입력해주세요.')
], authController.login);

// 현재 사용자 정보
router.get('/me', auth, authController.getCurrentUser);

// 회원 프로필 조회
router.get('/profile', auth, authController.getProfile);

// 회원 프로필 수정
router.put('/profile', auth, authController.updateProfile);

// 비밀번호 변경
router.put('/password', auth, authController.changePassword);

// 아이디(이메일) 찾기
router.post('/find-email', [
  body('name').notEmpty().withMessage('이름을 입력해주세요.'),
  body('phone').notEmpty().withMessage('연락처를 입력해주세요.')
], authController.findEmail);

// 비밀번호 찾기 (임시 비밀번호 발급)
router.post('/find-password', [
  body('email').isEmail().withMessage('유효한 이메일을 입력해주세요.'),
  body('name').notEmpty().withMessage('이름을 입력해주세요.')
], authController.findPassword);

module.exports = router;

