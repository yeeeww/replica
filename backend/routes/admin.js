const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const pool = require('../config/database');
const { spawn } = require('child_process');
const path = require('path');

// 크롤링 상태 저장 (메모리)
let crawlStatus = {
  isRunning: false,
  logs: [],
  startTime: null,
  endTime: null,
  savedCount: 0,
  targetCount: 0
};

// 크롤러 프로세스 참조
let crawlerProcess = null;

// 관리자: 회원 목록 (검색/필터 지원)
router.get('/users', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { search, role, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT u.id, u.email, u.name, u.phone, u.role, u.points, u.is_active, u.created_at, u.last_login_at,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = u.id AND status != 'cancelled') as total_spent
      FROM users u
    `;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(u.email ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      conditions.push(`u.role = $${paramIndex++}`);
      params.push(role);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Count
    const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get users
    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), offset);

    const result = await client.query(query, params);

    res.json({ 
      users: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 관리자: 회원 상세 조회
router.get('/users/:id', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    // 회원 정보
    const userResult = await client.query(`
      SELECT u.id, u.email, u.name, u.phone, u.role, u.points, 
             u.gender, u.address, u.birth_date, u.customs_number, u.profile_image,
             u.referral_source, u.memo, u.is_active, u.created_at, u.last_login_at,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = u.id AND status != 'cancelled') as total_spent
      FROM users u
      WHERE u.id = $1
    `, [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: '회원을 찾을 수 없습니다.' });
    }

    // 최근 주문 내역
    const ordersResult = await client.query(`
      SELECT id, total_amount, status, created_at
      FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [id]);

    // 적립금 내역
    const pointsResult = await client.query(`
      SELECT ph.*, a.name as admin_name
      FROM points_history ph
      LEFT JOIN users a ON ph.admin_id = a.id
      WHERE ph.user_id = $1
      ORDER BY ph.created_at DESC
      LIMIT 20
    `, [id]);

    res.json({
      user: userResult.rows[0],
      orders: ordersResult.rows,
      pointsHistory: pointsResult.rows
    });
  } catch (error) {
    console.error('Get user detail error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 관리자: 회원 정보 수정
router.put('/users/:id', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, phone, role, gender, address, birthDate, customsNumber, memo, is_active } = req.body;

    const result = await client.query(`
      UPDATE users SET
        name = COALESCE($1, name),
        phone = $2,
        role = COALESCE($3, role),
        gender = $4,
        address = $5,
        birth_date = $6,
        customs_number = $7,
        memo = $8,
        is_active = COALESCE($9, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING id, email, name, phone, role, points, gender, address, birth_date, customs_number, memo, is_active
    `, [name, phone || null, role, gender || null, address || null, birthDate || null, customsNumber || null, memo || null, is_active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '회원을 찾을 수 없습니다.' });
    }

    res.json({ message: '회원 정보가 수정되었습니다.', user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 관리자: 적립금 지급/차감
router.post('/users/:id/points', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { amount, type, description } = req.body;
    const adminId = req.user.id;

    if (!amount || amount === 0) {
      return res.status(400).json({ message: '적립금 금액을 입력해주세요.' });
    }

    // 회원 존재 확인
    const userResult = await client.query('SELECT points FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: '회원을 찾을 수 없습니다.' });
    }

    const currentPoints = userResult.rows[0].points || 0;
    const newPoints = currentPoints + parseInt(amount);

    if (newPoints < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '적립금이 부족합니다.' });
    }

    // 적립금 업데이트
    await client.query('UPDATE users SET points = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newPoints, id]);

    // 적립금 내역 추가
    await client.query(`
      INSERT INTO points_history (user_id, amount, type, description, admin_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, amount, type || (amount > 0 ? 'add' : 'deduct'), description || '관리자 지급/차감', adminId]);

    await client.query('COMMIT');

    res.json({ 
      message: amount > 0 ? '적립금이 지급되었습니다.' : '적립금이 차감되었습니다.',
      points: newPoints
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update points error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 관리자: 크롤링 시작
router.post('/crawl/start', auth, adminAuth, async (req, res) => {
  if (crawlStatus.isRunning) {
    return res.status(400).json({ message: '크롤링이 이미 진행 중입니다.' });
  }

  const { limit = 20, category = '' } = req.body;
  const crawlLimit = Math.max(1, parseInt(limit) || 20); // 최소 1개, 상한 없음
  const categoryFilter = (category || '').trim();

  // 상태 초기화
  crawlStatus = {
    isRunning: true,
    logs: [],
    startTime: new Date().toISOString(),
    endTime: null,
    savedCount: 0,
    targetCount: crawlLimit,
    categoryFilter: categoryFilter
  };

  const filterInfo = categoryFilter ? `, 카테고리: "${categoryFilter}"` : '';
  crawlStatus.logs.push(`[${new Date().toLocaleTimeString()}] 크롤링 시작 (목표: ${crawlLimit}개${filterInfo})`);

  // Python 크롤러 실행
  const crawlerPath = path.join(__dirname, '../../replmoa_crawler.py');
  
  // Python 경로 탐색 (Windows / Linux 호환)
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  
  // -u 옵션: unbuffered stdout/stderr (실시간 출력)
  crawlerProcess = spawn(pythonCmd, ['-u', crawlerPath], {
    env: {
      ...process.env,
      CRAWL_LIMIT: crawlLimit.toString(),
      CRAWL_CATEGORY: categoryFilter,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUNBUFFERED: '1'
    },
    cwd: path.join(__dirname, '../..'),
    shell: true
  });

  crawlerProcess.stdout.on('data', (data) => {
    const lines = data.toString('utf-8').split('\n').filter(l => l.trim());
    lines.forEach(line => {
      crawlStatus.logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
      // 저장 성공 카운트
      if (line.includes('[OK] 저장:')) {
        crawlStatus.savedCount++;
      }
      // 로그 최대 500줄 유지
      if (crawlStatus.logs.length > 500) {
        crawlStatus.logs = crawlStatus.logs.slice(-500);
      }
    });
  });

  crawlerProcess.stderr.on('data', (data) => {
    const lines = data.toString('utf-8').split('\n').filter(l => l.trim());
    lines.forEach(line => {
      crawlStatus.logs.push(`[${new Date().toLocaleTimeString()}] [ERROR] ${line}`);
    });
  });

  crawlerProcess.on('close', (code, signal) => {
    crawlStatus.isRunning = false;
    crawlStatus.endTime = new Date().toISOString();
    crawlerProcess = null;
    
    if (signal === 'SIGTERM' || signal === 'SIGKILL') {
      crawlStatus.logs.push(`[${new Date().toLocaleTimeString()}] 크롤링 중지됨 - 총 ${crawlStatus.savedCount}개 저장됨`);
    } else {
      const status = code === 0 ? '완료' : `오류 (코드: ${code})`;
      crawlStatus.logs.push(`[${new Date().toLocaleTimeString()}] 크롤링 ${status} - 총 ${crawlStatus.savedCount}개 저장됨`);
    }
  });

  crawlerProcess.on('error', (err) => {
    crawlStatus.isRunning = false;
    crawlStatus.endTime = new Date().toISOString();
    crawlerProcess = null;
    crawlStatus.logs.push(`[${new Date().toLocaleTimeString()}] [ERROR] 크롤러 실행 실패: ${err.message}`);
    console.error('Crawler process error:', err);
  });

  // 프로세스 시작 확인 로그
  crawlStatus.logs.push(`[${new Date().toLocaleTimeString()}] Python 프로세스 시작됨 (PID: ${crawlerProcess.pid || 'N/A'})`);

  res.json({ 
    message: '크롤링이 시작되었습니다.',
    targetCount: crawlLimit
  });
});

// 관리자: 크롤링 중지
router.post('/crawl/stop', auth, adminAuth, (req, res) => {
  if (!crawlStatus.isRunning || !crawlerProcess) {
    return res.status(400).json({ message: '실행 중인 크롤링이 없습니다.' });
  }

  try {
    // Windows와 Unix 모두에서 프로세스 종료
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', crawlerProcess.pid, '/f', '/t'], { shell: true });
    } else {
      crawlerProcess.kill('SIGTERM');
    }
    
    crawlStatus.logs.push(`[${new Date().toLocaleTimeString()}] 크롤링 중지 요청됨...`);
    
    res.json({ message: '크롤링 중지 요청이 전송되었습니다.' });
  } catch (error) {
    console.error('Stop crawl error:', error);
    res.status(500).json({ message: '크롤링 중지에 실패했습니다.' });
  }
});

// 관리자: 크롤링 상태 조회
router.get('/crawl/status', auth, adminAuth, (req, res) => {
  res.json({
    isRunning: crawlStatus.isRunning,
    logs: crawlStatus.logs,
    startTime: crawlStatus.startTime,
    endTime: crawlStatus.endTime,
    savedCount: crawlStatus.savedCount,
    targetCount: crawlStatus.targetCount
  });
});

// 관리자: 크롤링 로그 초기화
router.post('/crawl/clear-logs', auth, adminAuth, (req, res) => {
  if (crawlStatus.isRunning) {
    return res.status(400).json({ message: '크롤링 진행 중에는 로그를 초기화할 수 없습니다.' });
  }
  
  crawlStatus = {
    isRunning: false,
    logs: [],
    startTime: null,
    endTime: null,
    savedCount: 0,
    targetCount: 0
  };
  
  res.json({ message: '로그가 초기화되었습니다.' });
});

// ========== 추천/히트/인기 상품 관리 ==========

// 추천/히트/인기 상품 목록 조회
router.get('/featured/:type', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { type } = req.params;
    const validTypes = ['recommended', 'hot', 'popular'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: '유효하지 않은 타입입니다.' });
    }

    const column = `is_${type}`;
    const result = await client.query(`
      SELECT p.id, p.name, p.price, p.image_url, p.is_active, p.featured_order,
             p.is_recommended, p.is_hot, p.is_popular,
             c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.${column} = true
      ORDER BY p.featured_order ASC, p.id DESC
    `);

    res.json({ products: result.rows });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 상품 검색 (추천/히트/인기 추가용)
router.get('/featured-search', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { search, limit = 20 } = req.query;
    
    let query = `
      SELECT p.id, p.name, p.price, p.image_url, p.is_active,
             p.is_recommended, p.is_hot, p.is_popular,
             c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `;
    const params = [];
    
    if (search) {
      query += ` AND (p.name ILIKE $1 OR c.name ILIKE $1)`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await client.query(query, params);
    res.json({ products: result.rows });
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 추천/히트/인기 상품 추가
router.post('/featured/:type/:productId', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { type, productId } = req.params;
    const validTypes = ['recommended', 'hot', 'popular'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: '유효하지 않은 타입입니다.' });
    }

    const column = `is_${type}`;
    const result = await client.query(
      `UPDATE products SET ${column} = true WHERE id = $1 RETURNING id, name`,
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    res.json({ message: '상품이 추가되었습니다.', product: result.rows[0] });
  } catch (error) {
    console.error('Add featured product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 추천/히트/인기 상품 제거
router.delete('/featured/:type/:productId', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { type, productId } = req.params;
    const validTypes = ['recommended', 'hot', 'popular'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: '유효하지 않은 타입입니다.' });
    }

    const column = `is_${type}`;
    const result = await client.query(
      `UPDATE products SET ${column} = false WHERE id = $1 RETURNING id, name`,
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    res.json({ message: '상품이 제거되었습니다.', product: result.rows[0] });
  } catch (error) {
    console.error('Remove featured product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 추천/히트/인기 상품 순서 변경
router.put('/featured/:type/order', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { type } = req.params;
    const { productIds } = req.body; // [1, 3, 2, 5, ...] 순서대로
    const validTypes = ['recommended', 'hot', 'popular'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: '유효하지 않은 타입입니다.' });
    }

    if (!Array.isArray(productIds)) {
      return res.status(400).json({ message: '상품 ID 배열이 필요합니다.' });
    }

    await client.query('BEGIN');

    for (let i = 0; i < productIds.length; i++) {
      await client.query(
        'UPDATE products SET featured_order = $1 WHERE id = $2',
        [i + 1, productIds[i]]
      );
    }

    await client.query('COMMIT');
    res.json({ message: '순서가 변경되었습니다.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update featured order error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// ========== Weekly Best 상품 관리 (대분류별) ==========

// Weekly Best 상품 목록 조회 (대분류별)
router.get('/weekly-best/:categorySlug', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { categorySlug } = req.params;

    const result = await client.query(`
      SELECT wb.id, wb.display_order, wb.created_at,
             p.id as product_id, p.name, p.price, p.image_url, p.is_active,
             c.name as category_name, c.slug as category_slug
      FROM weekly_best_products wb
      JOIN products p ON wb.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE wb.category_slug = $1
      ORDER BY wb.display_order ASC, wb.created_at DESC
    `, [categorySlug]);

    res.json({ products: result.rows });
  } catch (error) {
    console.error('Get weekly best products error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// Weekly Best 상품 추가
router.post('/weekly-best/:categorySlug/:productId', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { categorySlug, productId } = req.params;

    // 상품 존재 확인
    const productCheck = await client.query('SELECT id, name FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    // 현재 최대 순서 조회
    const maxOrder = await client.query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM weekly_best_products WHERE category_slug = $1',
      [categorySlug]
    );

    const result = await client.query(`
      INSERT INTO weekly_best_products (category_slug, product_id, display_order)
      VALUES ($1, $2, $3)
      ON CONFLICT (category_slug, product_id) DO NOTHING
      RETURNING id
    `, [categorySlug, productId, maxOrder.rows[0].next_order]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: '이미 추가된 상품입니다.' });
    }

    res.json({ message: '상품이 추가되었습니다.', product: productCheck.rows[0] });
  } catch (error) {
    console.error('Add weekly best product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// Weekly Best 상품 제거
router.delete('/weekly-best/:categorySlug/:productId', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { categorySlug, productId } = req.params;

    const result = await client.query(
      'DELETE FROM weekly_best_products WHERE category_slug = $1 AND product_id = $2 RETURNING id',
      [categorySlug, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '등록된 상품을 찾을 수 없습니다.' });
    }

    res.json({ message: '상품이 제거되었습니다.' });
  } catch (error) {
    console.error('Remove weekly best product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// Weekly Best 상품 순서 변경
router.put('/weekly-best/:categorySlug/order', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { categorySlug } = req.params;
    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
      return res.status(400).json({ message: '상품 ID 배열이 필요합니다.' });
    }

    await client.query('BEGIN');

    for (let i = 0; i < productIds.length; i++) {
      await client.query(
        'UPDATE weekly_best_products SET display_order = $1 WHERE category_slug = $2 AND product_id = $3',
        [i + 1, categorySlug, productIds[i]]
      );
    }

    await client.query('COMMIT');
    res.json({ message: '순서가 변경되었습니다.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update weekly best order error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// ========== 사이트 설정 관리 ==========

// 설정 조회
router.get('/settings', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM site_settings ORDER BY id');
    
    // 설정을 객체로 변환
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    
    res.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// 설정 수정
router.put('/settings', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { register_points, purchase_points_rate } = req.body;
    
    await client.query('BEGIN');
    
    if (register_points !== undefined) {
      await client.query(`
        INSERT INTO site_settings (setting_key, setting_value, description)
        VALUES ('register_points', $1, '회원가입 시 지급되는 적립금')
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
      `, [register_points.toString()]);
    }
    
    if (purchase_points_rate !== undefined) {
      await client.query(`
        INSERT INTO site_settings (setting_key, setting_value, description)
        VALUES ('purchase_points_rate', $1, '구매 시 적립률 (결제금액의 %)')
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
      `, [purchase_points_rate.toString()]);
    }
    
    await client.query('COMMIT');
    
    // 업데이트된 설정 반환
    const result = await client.query('SELECT * FROM site_settings ORDER BY id');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    
    res.json({ message: '설정이 저장되었습니다.', settings });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update settings error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

module.exports = router;
