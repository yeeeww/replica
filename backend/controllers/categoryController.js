const pool = require('../config/database');

// 카테고리 전체 경로 조회 헬퍼
async function buildCategoryFullPath(categoryMap, catId) {
  const pathParts = [];
  let currentId = catId;
  
  while (currentId && categoryMap[currentId]) {
    pathParts.unshift(categoryMap[currentId].name);
    currentId = categoryMap[currentId].parent_id;
  }
  
  return pathParts.join(' > ');
}

// 카테고리 목록 조회 (계층 구조 지원)
exports.getCategories = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { tree } = req.query;  // ?tree=true 면 계층 구조로 반환

    const result = await client.query(`
      SELECT c.*, 
             COUNT(p.id) as product_count,
             pc.name as parent_name,
             pc.slug as parent_slug
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
      LEFT JOIN categories pc ON c.parent_id = pc.id
      GROUP BY c.id, pc.name, pc.slug
      ORDER BY c.depth, c.name
    `);

    // 먼저 카테고리 맵 생성
    const categoryMap = {};
    result.rows.forEach(cat => {
      categoryMap[cat.id] = cat;
    });

    // 각 카테고리에 전체 경로 추가
    const categoriesWithPath = result.rows.map(cat => ({
      ...cat,
      full_path: buildCategoryFullPathSync(categoryMap, cat.id)
    }));

    if (tree === 'true') {
      // 계층 구조로 변환
      const treeMap = {};
      const rootCategories = [];

      // 모든 카테고리를 맵에 저장
      categoriesWithPath.forEach(cat => {
        treeMap[cat.id] = { ...cat, children: [] };
      });

      // 부모-자식 관계 설정
      categoriesWithPath.forEach(cat => {
        if (cat.parent_id && treeMap[cat.parent_id]) {
          treeMap[cat.parent_id].children.push(treeMap[cat.id]);
        } else if (!cat.parent_id) {
          rootCategories.push(treeMap[cat.id]);
        }
      });

      res.json({ categories: rootCategories });
    } else {
      res.json({ categories: categoriesWithPath });
    }
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 동기 버전 전체 경로 생성
function buildCategoryFullPathSync(categoryMap, catId) {
  const pathParts = [];
  let currentId = catId;
  
  while (currentId && categoryMap[currentId]) {
    pathParts.unshift(categoryMap[currentId].name);
    currentId = categoryMap[currentId].parent_id;
  }
  
  return pathParts.join(' > ');
}

// 카테고리 생성 (관리자)
exports.createCategory = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name, slug, description, parent_id } = req.body;

    // depth 계산
    let depth = 1;
    if (parent_id) {
      const parentResult = await client.query('SELECT depth FROM categories WHERE id = $1', [parent_id]);
      if (parentResult.rows.length > 0) {
        depth = parentResult.rows[0].depth + 1;
      }
    }

    const result = await client.query(`
      INSERT INTO categories (name, slug, parent_id, depth, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, slug, parent_id || null, depth, description]);

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
    const { name, slug, description, parent_id } = req.body;

    // depth 계산
    let depth = 1;
    if (parent_id) {
      const parentResult = await client.query('SELECT depth FROM categories WHERE id = $1', [parent_id]);
      if (parentResult.rows.length > 0) {
        depth = parentResult.rows[0].depth + 1;
      }
    }

    const result = await client.query(`
      UPDATE categories
      SET name = $1, slug = $2, description = $3, parent_id = $4, depth = $5
      WHERE id = $6
      RETURNING *
    `, [name, slug, description, parent_id || null, depth, id]);

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

