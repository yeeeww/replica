const pool = require('../config/database');

// 공지사항 목록 조회
exports.getNotices = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // 총 개수 조회
    const countResult = await client.query('SELECT COUNT(*) FROM notices WHERE is_active = true');
    const total = parseInt(countResult.rows[0].count);

    // 공지사항 조회
    const result = await client.query(`
      SELECT n.*, u.name as author_name
      FROM notices n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.is_active = true
      ORDER BY n.is_pinned DESC, n.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      notices: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get notices error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 공지사항 상세 조회
exports.getNotice = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    // 조회수 증가
    await client.query('UPDATE notices SET view_count = view_count + 1 WHERE id = $1', [id]);

    const result = await client.query(`
      SELECT n.*, u.name as author_name
      FROM notices n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.id = $1 AND n.is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '공지사항을 찾을 수 없습니다.' });
    }

    res.json({ notice: result.rows[0] });
  } catch (error) {
    console.error('Get notice error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 공지사항 생성 (관리자)
exports.createNotice = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { title, content, is_pinned } = req.body;
    const authorId = req.user.id;

    if (!title || !content) {
      return res.status(400).json({ message: '제목과 내용을 입력해주세요.' });
    }

    const result = await client.query(`
      INSERT INTO notices (title, content, author_id, is_pinned)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [title, content, authorId, is_pinned || false]);

    res.status(201).json({
      message: '공지사항이 등록되었습니다.',
      notice: result.rows[0]
    });
  } catch (error) {
    console.error('Create notice error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 공지사항 수정 (관리자)
exports.updateNotice = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { title, content, is_pinned, is_active } = req.body;

    const result = await client.query(`
      UPDATE notices
      SET title = $1, content = $2, is_pinned = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [title, content, is_pinned || false, is_active !== false, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '공지사항을 찾을 수 없습니다.' });
    }

    res.json({
      message: '공지사항이 수정되었습니다.',
      notice: result.rows[0]
    });
  } catch (error) {
    console.error('Update notice error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 공지사항 삭제 (관리자)
exports.deleteNotice = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    const result = await client.query(
      'DELETE FROM notices WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '공지사항을 찾을 수 없습니다.' });
    }

    res.json({ message: '공지사항이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete notice error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};
