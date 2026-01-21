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

module.exports = router;
