const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const pool = require('../config/database');

// 관리자: 회원 목록
router.get('/users', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, email, name, role, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 1000
    `);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

module.exports = router;
