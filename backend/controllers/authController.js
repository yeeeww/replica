const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// 회원가입
exports.register = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { 
      email, 
      password, 
      name, 
      phone,
      gender,
      address,
      birthDate,
      referralSource,
      customsNumber,
      referrer
    } = req.body;

    // 이메일 중복 체크
    const existingUser = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '이미 존재하는 이메일입니다.' });
    }

    // 회원가입 적립금 설정 조회
    const settingResult = await client.query(
      "SELECT setting_value FROM site_settings WHERE setting_key = 'register_points'"
    );
    let registerPoints = settingResult.rows.length > 0 
      ? parseInt(settingResult.rows[0].setting_value) || 0 
      : 5000; // 기본값 5000

    // 가입 경로 선택시 추가 적립금
    if (referralSource) {
      registerPoints += settingResult.rows.length > 0 
        ? parseInt(settingResult.rows[0].setting_value) || 0 
        : 5000;
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성 (확장된 필드 포함)
    const result = await client.query(
      `INSERT INTO users (
        email, password, name, phone, points, 
        gender, address, birth_date, referral_source, customs_number, referrer
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
      RETURNING id, email, name, role, points`,
      [
        email, 
        hashedPassword, 
        name, 
        phone || null, 
        registerPoints,
        gender || null,
        address || null,
        birthDate || null,
        referralSource || null,
        customsNumber || null,
        referrer || null
      ]
    );

    const user = result.rows[0];

    // 적립금 지급 내역 기록 (적립금이 있는 경우에만)
    if (registerPoints > 0) {
      let description = '회원가입 적립금';
      if (referralSource) {
        description += ' + 가입경로 입력 적립금';
      }
      await client.query(`
        INSERT INTO points_history (user_id, amount, type, description)
        VALUES ($1, $2, 'register', $3)
      `, [user.id, registerPoints, description]);
    }

    await client.query('COMMIT');

    // JWT 토큰 생성
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        points: user.points
      },
      welcomePoints: registerPoints
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Register error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 로그인
exports.login = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, password } = req.body;

    // 사용자 조회
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = result.rows[0];

    // 비밀번호 확인
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: '로그인 성공',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 현재 사용자 정보 조회
exports.getCurrentUser = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT id, email, name, role, points, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 회원 프로필 조회
exports.getProfile = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT id, email, name, phone, points, gender, address, birth_date, 
              referral_source, customs_number, profile_image, created_at 
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 회원 프로필 수정
exports.updateProfile = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name, phone, gender, address, birthDate, customsNumber, profileImage } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: '이름을 입력해주세요.' });
    }

    await client.query(
      `UPDATE users SET 
        name = $1, 
        phone = $2, 
        gender = $3, 
        address = $4, 
        birth_date = $5, 
        customs_number = $6,
        profile_image = $7,
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = $8`,
      [name, phone || null, gender || null, address || null, birthDate || null, customsNumber || null, profileImage || null, req.user.id]
    );

    res.json({ message: '회원 정보가 수정되었습니다.' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 비밀번호 변경
exports.changePassword = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: '비밀번호는 최소 8자 이상이어야 합니다.' });
    }

    // 현재 비밀번호 확인
    const userResult = await client.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!isValidPassword) {
      return res.status(400).json({ message: '현재 비밀번호가 올바르지 않습니다.' });
    }

    // 새 비밀번호 해싱 및 저장
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await client.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({ message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 아이디(이메일) 찾기
exports.findEmail = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name, phone } = req.body;

    const result = await client.query(
      'SELECT email FROM users WHERE name = $1 AND phone = $2',
      [name, phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '일치하는 회원 정보를 찾을 수 없습니다.' });
    }

    // 이메일 일부 마스킹 (예: te**@example.com)
    const email = result.rows[0].email;
    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.length > 2 
      ? localPart.substring(0, 2) + '*'.repeat(Math.min(localPart.length - 2, 4))
      : localPart;
    const maskedEmail = `${maskedLocal}@${domain}`;

    res.json({ 
      message: '이메일을 찾았습니다.',
      email: maskedEmail 
    });
  } catch (error) {
    console.error('Find email error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 비밀번호 찾기 (임시 비밀번호 발급)
exports.findPassword = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, name } = req.body;

    // 사용자 확인
    const result = await client.query(
      'SELECT id FROM users WHERE email = $1 AND name = $2',
      [email, name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '일치하는 회원 정보를 찾을 수 없습니다.' });
    }

    // 임시 비밀번호 생성 (8자리 랜덤)
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase();
    
    // 비밀번호 해싱 후 저장
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    await client.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, result.rows[0].id]
    );

    res.json({ 
      message: '임시 비밀번호가 발급되었습니다.',
      tempPassword: tempPassword
    });
  } catch (error) {
    console.error('Find password error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

