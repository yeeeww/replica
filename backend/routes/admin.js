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

  const { limit = 100, category = '', urlSource = 'both', speedMode = 'normal', skipS3 = false } = req.body;
  const rawLimit = parseInt(limit);
  const isUnlimited = rawLimit === 0;
  const crawlLimit = isUnlimited ? 0 : Math.max(1, rawLimit || 100);
  const categoryFilter = (category || '').trim();
  const crawlUrlSource = ['sitemap', 'category', 'both'].includes(urlSource) ? urlSource : 'both';
  const crawlSpeedMode = ['fast', 'normal'].includes(speedMode) ? speedMode : 'normal';
  const crawlSkipS3 = skipS3 === true ? 'true' : 'false';

  // 상태 초기화
  crawlStatus = {
    isRunning: true,
    logs: [],
    startTime: new Date().toISOString(),
    endTime: null,
    savedCount: 0,
    targetCount: isUnlimited ? 999999 : crawlLimit,
    categoryFilter: categoryFilter,
    urlSource: crawlUrlSource,
    // 상세 진행 상태
    phase: 'init',  // init, sitemap, category_url, crawling, retry, done
    sitemapCount: 0,
    categoryUrlCount: 0,
    totalUrls: 0,
    scannedCount: 0,
    skipCount: 0,
    failCount: 0,
    timeoutCount: 0,
    retryCount: 0,
    categoryUrlDone: false,
    elapsedStr: '',
    remainStr: '',
    successRate: 0,
  };

  const filterInfo = categoryFilter ? `, 카테고리: "${categoryFilter}"` : '';
  const sourceInfo = crawlUrlSource === 'both' ? '사이트맵+카테고리' : crawlUrlSource === 'sitemap' ? '사이트맵' : '카테고리';
  const limitInfo = isUnlimited ? '전체(무제한)' : `${crawlLimit}개`;
  const speedInfo = crawlSpeedMode === 'fast' ? '⚡고속' : '일반';
  const s3Info = crawlSkipS3 === 'true' ? ', S3스킵' : '';
  crawlStatus.logs.push(`[${new Date().toLocaleTimeString()}] 크롤링 시작 (목표: ${limitInfo}${filterInfo}, 소스: ${sourceInfo}, 속도: ${speedInfo}${s3Info})`);

  // Python 크롤러 실행
  const crawlerPath = path.join(__dirname, '../../replmoa_crawler.py');
  
  // Python 경로 탐색 (Windows / Linux 호환)
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  
  // 중지 플래그 파일 삭제 (이전 실행에서 남은 것)
  const stopFlagPath = path.join(__dirname, '..', 'crawl_stop.flag');
  try { require('fs').unlinkSync(stopFlagPath); } catch(e) {}
  
  // -u 옵션: unbuffered stdout/stderr (실시간 출력)
  crawlerProcess = spawn(pythonCmd, ['-u', crawlerPath], {
    env: {
      ...process.env,
      CRAWL_LIMIT: crawlLimit.toString(),
      CRAWL_CATEGORY: categoryFilter,
      CRAWL_URL_SOURCE: crawlUrlSource,
      CRAWL_SPEED_MODE: crawlSpeedMode,
      CRAWL_SKIP_S3: crawlSkipS3,
      CRAWL_STOP_FLAG: stopFlagPath,  // 중지 플래그 경로 전달
      PYTHONIOENCODING: 'utf-8',
      PYTHONUNBUFFERED: '1'
    },
    cwd: path.join(__dirname, '../..'),
    shell: true,
    detached: process.platform !== 'win32'  // Linux에서 프로세스 그룹으로 실행
  });

  crawlerProcess.stdout.on('data', (data) => {
    const lines = data.toString('utf-8').split('\n').filter(l => l.trim());
    lines.forEach(line => {
      crawlStatus.logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
      
      // ===== 단계 감지 =====
      if (line.includes('[SITEMAP] 사이트맵 불러오는 중')) {
        crawlStatus.phase = 'sitemap';
      }
      else if (line.includes('[SITEMAP] 사이트맵에서')) {
        const m = line.match(/(\d+)개의 상품 URL/);
        if (m) crawlStatus.sitemapCount = parseInt(m[1]);
      }
      else if (line.includes('[CATEGORY]') && line.includes('병렬 페이지 순회 시작')) {
        crawlStatus.phase = 'category_url';
      }
      else if (line.includes('[CATEGORY]') && line.includes('누적') && line.includes('수집 중')) {
        const m = line.match(/누적 (\d+)개/);
        if (m) crawlStatus.categoryUrlCount = parseInt(m[1]);
      }
      else if (line.includes('[CATEGORY-BG] 카테고리에서 신규')) {
        const m = line.match(/신규 (\d+)개/);
        if (m) crawlStatus.categoryUrlCount = parseInt(m[1]);
        crawlStatus.categoryUrlDone = true;
      }
      else if (line.includes('[SCAN] 병렬 크롤링 시작')) {
        crawlStatus.phase = 'crawling';
      }
      else if (line.includes('[RETRY]') && line.includes('재시도 시작')) {
        crawlStatus.phase = 'retry';
        const m = line.match(/(\d+)개 URL/);
        if (m) crawlStatus.retryCount = parseInt(m[1]);
      }
      
      // ===== 저장 성공 카운트 =====
      if (line.match(/\[\+\d+\]/)) {
        crawlStatus.savedCount++;
      }
      
      // ===== 진행률 파싱 =====
      if (line.includes('진행:') && line.includes('스캔')) {
        // "진행: 1,800/41,742 (4.3%) | 경과: 3시간 20분 | 남은: ~74시간"
        const scanMatch = line.match(/진행:\s*([\d,]+)\/([\d,]+)/);
        if (scanMatch) {
          crawlStatus.scannedCount = parseInt(scanMatch[1].replace(/,/g, ''));
          crawlStatus.totalUrls = parseInt(scanMatch[2].replace(/,/g, ''));
        }
        const savedMatch = line.match(/저장:\s*([\d,]+)개/);
        if (savedMatch) {
          crawlStatus.savedCount = parseInt(savedMatch[1].replace(/,/g, ''));
        }
        const skipMatch = line.match(/스킵:\s*([\d,]+)/);
        if (skipMatch) crawlStatus.skipCount = parseInt(skipMatch[1].replace(/,/g, ''));
        const failMatch = line.match(/실패:\s*([\d,]+)/);
        if (failMatch) crawlStatus.failCount = parseInt(failMatch[1].replace(/,/g, ''));
        const timeoutMatch = line.match(/타임아웃:\s*([\d,]+)/);
        if (timeoutMatch) crawlStatus.timeoutCount = parseInt(timeoutMatch[1].replace(/,/g, ''));
        const elapsedMatch = line.match(/경과:\s*([^\|]+)/);
        if (elapsedMatch) crawlStatus.elapsedStr = elapsedMatch[1].trim();
        const remainMatch = line.match(/남은:\s*([^\|]+)/);
        if (remainMatch) crawlStatus.remainStr = remainMatch[1].trim();
        const rateMatch = line.match(/성공률:\s*([\d.]+)%/);
        if (rateMatch) crawlStatus.successRate = parseFloat(rateMatch[1]);
      }
      
      // ===== 타임아웃 카운트 (개별) =====
      if (line.includes('[TIMEOUT]')) {
        crawlStatus.timeoutCount++;
      }
      
      // ===== 완료 감지 =====
      if (line.includes('크롤링 완료!')) {
        crawlStatus.phase = 'done';
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
    const pid = crawlerProcess.pid;
    
    // 1. 중지 플래그 파일 생성 (크롤러가 확인)
    const fs = require('fs');
    const path = require('path');
    const stopFlagPath = path.join(__dirname, '..', 'crawl_stop.flag');
    fs.writeFileSync(stopFlagPath, Date.now().toString());
    
    // 2. 프로세스 강제 종료 (자식 프로세스 포함)
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', pid, '/f', '/t'], { shell: true });
    } else {
      // Linux: 프로세스 그룹 전체 종료 (SIGKILL)
      try {
        process.kill(-pid, 'SIGKILL');  // 프로세스 그룹 전체
      } catch (e) {
        // 그룹 종료 실패시 개별 종료
        spawn('pkill', ['-KILL', '-P', pid.toString()], { shell: true });  // 자식 프로세스
        crawlerProcess.kill('SIGKILL');  // 메인 프로세스
      }
    }
    
    // 3. 상태 업데이트
    setTimeout(() => {
      crawlStatus.isRunning = false;
      crawlStatus.endTime = new Date().toISOString();
      crawlerProcess = null;
      // 중지 플래그 파일 삭제
      try { fs.unlinkSync(stopFlagPath); } catch(e) {}
    }, 1000);
    
    crawlStatus.logs.push(`[${new Date().toLocaleTimeString()}] 크롤링 강제 중지됨 (PID: ${pid})`);
    
    res.json({ message: '크롤링이 강제 중지되었습니다.' });
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

const isMissingWeeklyBestTable = (error) =>
  error?.code === '42P01' || (error?.message || '').includes('weekly_best_products');

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
    if (isMissingWeeklyBestTable(error)) {
      console.warn('weekly_best_products 테이블이 없어 빈 리스트를 반환합니다. (admin)');
      return res.json({ products: [] });
    }
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
    if (isMissingWeeklyBestTable(error)) {
      console.warn('weekly_best_products 테이블이 없어 추가 요청을 처리하지 못했습니다.');
      return res.status(400).json({ message: 'Weekly Best 기능이 비활성화되었습니다. 테이블 생성 후 다시 시도해주세요.' });
    }
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
    if (isMissingWeeklyBestTable(error)) {
      console.warn('weekly_best_products 테이블이 없어 제거 요청을 처리하지 못했습니다.');
      return res.status(400).json({ message: 'Weekly Best 기능이 비활성화되었습니다. 테이블 생성 후 다시 시도해주세요.' });
    }
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
    if (isMissingWeeklyBestTable(error)) {
      console.warn('weekly_best_products 테이블이 없어 순서 변경을 처리하지 못했습니다.');
      return res.status(400).json({ message: 'Weekly Best 기능이 비활성화되었습니다. 테이블 생성 후 다시 시도해주세요.' });
    }
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
