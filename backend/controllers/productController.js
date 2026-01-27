const pool = require('../config/database');

// 카테고리 전체 경로 조회 헬퍼 함수
async function getCategoryFullPath(client, categoryId) {
  if (!categoryId) return { path: '', pathArray: [] };
  
  const result = await client.query(`
    WITH RECURSIVE category_path AS (
      SELECT id, name, slug, parent_id, depth, name as path_name
      FROM categories
      WHERE id = $1
      
      UNION ALL
      
      SELECT c.id, c.name, c.slug, c.parent_id, c.depth, 
             cp.path_name
      FROM categories c
      JOIN category_path cp ON c.id = cp.parent_id
    )
    SELECT * FROM category_path ORDER BY depth ASC
  `, [categoryId]);
  
  const pathArray = result.rows.map(r => ({ name: r.name, slug: r.slug }));
  const path = pathArray.map(p => p.name).join(' > ');
  
  return { path, pathArray };
}

// 상품 목록 조회
exports.getProducts = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { category, search, page = 1, limit = 12, popular_category, subcategory } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, 
             c.name as category_name, 
             c.slug as category_slug,
             c.depth as category_depth,
             c.parent_id as category_parent_id,
             COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.is_active = true), 0) as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `;
    const params = [];
    let paramCount = 0;
    const featuredType = (category || "").toLowerCase();

    // 인기상품 중 특정 카테고리 필터 (메인 페이지 BEST 섹션용)
    if (popular_category) {
      query += ` AND p.is_popular = true`;
      paramCount++;
      // 카테고리 슬러그에 해당 키워드가 포함된 상품
      query += ` AND (c.slug LIKE $${paramCount} OR c.slug LIKE $${paramCount + 1})`;
      params.push(`%-${popular_category}%`, `%${popular_category}-%`);
      paramCount++;
    }
    // 추천/히트/인기 상품 필터링
    else if (featuredType === "recommend") {
      query += ` AND p.is_recommended = true`;
      // subcategory 필터 추가
      if (subcategory) {
        paramCount++;
        query += ` AND (c.slug LIKE $${paramCount} OR c.slug LIKE $${paramCount + 1})`;
        params.push(`%-${subcategory}`, `%-${subcategory}-%`);
        paramCount++;
      }
    } else if (featuredType === "hot") {
      query += ` AND p.is_hot = true`;
      // subcategory 필터 추가
      if (subcategory) {
        paramCount++;
        query += ` AND (c.slug LIKE $${paramCount} OR c.slug LIKE $${paramCount + 1})`;
        params.push(`%-${subcategory}`, `%-${subcategory}-%`);
        paramCount++;
      }
    } else if (featuredType === "popular") {
      query += ` AND p.is_popular = true`;
      // subcategory 필터 추가
      if (subcategory) {
        paramCount++;
        query += ` AND (c.slug LIKE $${paramCount} OR c.slug LIKE $${paramCount + 1})`;
        params.push(`%-${subcategory}`, `%-${subcategory}-%`);
        paramCount++;
      }
    } else if (category) {
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
      query.replace(/SELECT p\.\*.*?FROM products p/s, 'SELECT COUNT(*) FROM products p'),
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // 상품 조회 - 추천/히트/인기상품은 featured_order로 정렬
    if (["recommend", "hot", "popular"].includes(featuredType)) {
      query += ` ORDER BY p.featured_order ASC, p.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    } else {
      query += ` ORDER BY p.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    }
    params.push(limit, offset);

    const result = await client.query(query, params);

    // 각 상품의 카테고리 전체 경로 조회
    const productsWithPath = await Promise.all(
      result.rows.map(async (product) => {
        const { path, pathArray } = await getCategoryFullPath(client, product.category_id);
        return {
          ...product,
          category_full_path: path,  // "남성 > 지갑 > 프라다"
          category_path_array: pathArray
        };
      })
    );

    res.json({
      products: productsWithPath,
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
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.is_active = true), 0) as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1 AND p.is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    // 카테고리 전체 경로 조회
    const { path: categoryFullPath, pathArray: categoryPathArray } = 
      await getCategoryFullPath(client, result.rows[0].category_id);

    // 상품 옵션 조회
    const optionsResult = await client.query(`
      SELECT id, option_name, option_value, price_adjustment, stock, is_active
      FROM product_options
      WHERE product_id = $1 AND is_active = true
      ORDER BY option_name, option_value
    `, [id]);

    // 옵션을 이름별로 그룹화
    const optionsGrouped = {};
    optionsResult.rows.forEach(opt => {
      if (!optionsGrouped[opt.option_name]) {
        optionsGrouped[opt.option_name] = [];
      }
      optionsGrouped[opt.option_name].push({
        id: opt.id,
        value: opt.option_value,
        price_adjustment: parseFloat(opt.price_adjustment),
        stock: opt.stock
      });
    });

    const product = result.rows[0];
    product.options = optionsGrouped;
    product.category_full_path = categoryFullPath;  // "남성 > 지갑 > 프라다"
    product.category_path_array = categoryPathArray;

    res.json({ product });
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
    const { name, description, price, category_id, image_url, stock, department_price, options } = req.body;

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO products (name, description, price, category_id, image_url, stock, department_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, description, price, category_id, image_url, stock || 0, department_price]);

    const productId = result.rows[0].id;

    // 옵션 추가
    if (options && Array.isArray(options)) {
      for (const opt of options) {
        if (opt.option_name && opt.option_value) {
          await client.query(`
            INSERT INTO product_options (product_id, option_name, option_value, price_adjustment, stock)
            VALUES ($1, $2, $3, $4, $5)
          `, [productId, opt.option_name, opt.option_value, opt.price_adjustment || 0, opt.stock || 0]);
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: '상품이 등록되었습니다.',
      product: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
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
    const { name, description, price, category_id, image_url, stock, is_active, department_price, options } = req.body;

    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE products
      SET name = $1, description = $2, price = $3, category_id = $4,
          image_url = $5, stock = $6, is_active = $7, department_price = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [name, description, price, category_id, image_url, stock, is_active, department_price, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    // 옵션 처리
    if (options && Array.isArray(options)) {
      // 기존 옵션 중 전송되지 않은 것 삭제
      const optionIds = options.filter(opt => opt.id).map(opt => opt.id);
      if (optionIds.length > 0) {
        await client.query(
          'DELETE FROM product_options WHERE product_id = $1 AND id != ALL($2)',
          [id, optionIds]
        );
      } else {
        await client.query('DELETE FROM product_options WHERE product_id = $1', [id]);
      }

      // 옵션 추가/수정
      for (const opt of options) {
        if (opt.id) {
          // 기존 옵션 수정
          await client.query(`
            UPDATE product_options
            SET option_name = $1, option_value = $2, price_adjustment = $3, stock = $4
            WHERE id = $5 AND product_id = $6
          `, [opt.option_name, opt.option_value, opt.price_adjustment || 0, opt.stock || 0, opt.id, id]);
        } else {
          // 새 옵션 추가
          await client.query(`
            INSERT INTO product_options (product_id, option_name, option_value, price_adjustment, stock)
            VALUES ($1, $2, $3, $4, $5)
          `, [id, opt.option_name, opt.option_value, opt.price_adjustment || 0, opt.stock || 0]);
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      message: '상품이 수정되었습니다.',
      product: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
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

