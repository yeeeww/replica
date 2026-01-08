const pool = require('../config/database');

// 카테고리 목록 조회
exports.getCategories = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
      GROUP BY c.id
      ORDER BY c.name
    `);

    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 카테고리 생성 (관리자)
exports.createCategory = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name, slug, description } = req.body;

    const result = await client.query(`
      INSERT INTO categories (name, slug, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, slug, description]);

    res.status(201).json({
      message: '카테고리가 생성되었습니다.',
      category: result.rows[0]
    });
  } catch (error) {
    console.error('Create category error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: '이미 존재하는 카테고리 슬러그입니다.' });
    }
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 카테고리 수정 (관리자)
exports.updateCategory = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { name, slug, description } = req.body;

    const result = await client.query(`
      UPDATE categories
      SET name = $1, slug = $2, description = $3
      WHERE id = $4
      RETURNING *
    `, [name, slug, description, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '카테고리를 찾을 수 없습니다.' });
    }

    res.json({
      message: '카테고리가 수정되었습니다.',
      category: result.rows[0]
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 카테고리 삭제 (관리자)
exports.deleteCategory = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    const result = await client.query(
      'DELETE FROM categories WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '카테고리를 찾을 수 없습니다.' });
    }

    res.json({ message: '카테고리가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

