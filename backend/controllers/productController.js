const pool = require('../config/database');

// 상품 목록 조회
exports.getProducts = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `;
    const params = [];
    let paramCount = 0;

    const skipCategoryFilter = ["recommend", "hot", "popular"].includes(
      (category || "").toLowerCase()
    );

    if (category && !skipCategoryFilter) {
      paramCount++;
      // 카테고리 일치 또는 하위카테고리(접두어)까지 포함
      query += ` AND (c.slug = $${paramCount} OR c.slug LIKE ($${paramCount} || '-%'))`;
      params.push(category);
    }

    if (search) {
      paramCount++;
      query += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // 총 개수 조회
    const countResult = await client.query(
      query.replace('SELECT p.*, c.name as category_name, c.slug as category_slug', 'SELECT COUNT(*)'),
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // 상품 조회
    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await client.query(query, params);

    res.json({
      products: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 상품 상세 조회
exports.getProduct = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    const result = await client.query(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1 AND p.is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 상품 생성 (관리자)
exports.createProduct = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name, description, price, category_id, image_url, stock, department_price } = req.body;

    const result = await client.query(`
      INSERT INTO products (name, description, price, category_id, image_url, stock, department_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, description, price, category_id, image_url, stock || 0, department_price]);

    res.status(201).json({
      message: '상품이 등록되었습니다.',
      product: result.rows[0]
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 상품 수정 (관리자)
exports.updateProduct = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { name, description, price, category_id, image_url, stock, is_active, department_price } = req.body;

    const result = await client.query(`
      UPDATE products
      SET name = $1, description = $2, price = $3, category_id = $4,
          image_url = $5, stock = $6, is_active = $7, department_price = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [name, description, price, category_id, image_url, stock, is_active, department_price, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    res.json({
      message: '상품이 수정되었습니다.',
      product: result.rows[0]
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 상품 삭제 (관리자)
exports.deleteProduct = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    const result = await client.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    res.json({ message: '상품이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

