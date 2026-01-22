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
      SELECT c.id, c.name, c.slug, c.parent_id, c.depth, c.description, c.created_at,
             c.parent_slug,
             COUNT(p.id) as product_count,
             pc.name as parent_name
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
      LEFT JOIN categories pc ON c.parent_id = pc.id
      GROUP BY c.id, c.name, c.slug, c.parent_id, c.depth, c.description, c.created_at, c.parent_slug, pc.name
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
      // 계층 구조로 변환 (parent_slug 기반)
      const slugMap = {};
      const rootCategories = [];

      // 모든 카테고리를 slug 기준으로 맵에 저장
      categoriesWithPath.forEach(cat => {
        slugMap[cat.slug] = { ...cat, children: [] };
      });

      // 부모-자식 관계 설정 (parent_slug 또는 parent_id 기반)
      categoriesWithPath.forEach(cat => {
        // depth 1은 루트
        if (cat.depth === 1 || (!cat.parent_slug && !cat.parent_id)) {
          rootCategories.push(slugMap[cat.slug]);
        } 
        // parent_slug가 있으면 해당 부모의 children에 추가
        else if (cat.parent_slug && slugMap[cat.parent_slug]) {
          slugMap[cat.parent_slug].children.push(slugMap[cat.slug]);
        }
        // parent_id가 있으면 해당 부모의 children에 추가
        else if (cat.parent_id) {
          const parentCat = categoriesWithPath.find(c => c.id === cat.parent_id);
          if (parentCat && slugMap[parentCat.slug]) {
            slugMap[parentCat.slug].children.push(slugMap[cat.slug]);
          }
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

// 카테고리 생성 (관리자) - 대분류/중분류/소분류 모두 지원
exports.createCategory = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name, slug, description, parent_id, parent_slug, depth: requestedDepth } = req.body;

    console.log('Create category request:', { name, slug, parent_slug, requestedDepth });

    // depth 결정: 요청에서 직접 지정된 경우 사용
    let depth = 1;
    let finalParentId = parent_id || null;

    // 요청에서 depth가 명시적으로 지정된 경우
    if (requestedDepth !== undefined && requestedDepth !== null) {
      depth = parseInt(requestedDepth);
    } else if (parent_slug) {
      // parent_slug가 있으면 depth 계산
      // parent_slug가 'men'이면 depth 2, 'men-bag'이면 depth 3
      const hyphenCount = (parent_slug.match(/-/g) || []).length;
      depth = hyphenCount + 2;
    } else if (parent_id) {
      const parentResult = await client.query('SELECT depth FROM categories WHERE id = $1', [parent_id]);
      if (parentResult.rows.length > 0) {
        depth = parentResult.rows[0].depth + 1;
      }
    }

    console.log('Final depth:', depth, 'parent_slug:', parent_slug);

    const result = await client.query(`
      INSERT INTO categories (name, slug, parent_id, parent_slug, depth, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, slug, finalParentId, parent_slug || null, depth, description]);

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
    const { name, slug, description, parent_id, parent_slug, depth: requestedDepth } = req.body;

    // depth 결정
    let depth = requestedDepth || 1;
    
    if (!requestedDepth) {
      if (parent_slug) {
        const hyphenCount = (parent_slug.match(/-/g) || []).length;
        depth = hyphenCount + 2;
      } else if (parent_id) {
        const parentResult = await client.query('SELECT depth FROM categories WHERE id = $1', [parent_id]);
        if (parentResult.rows.length > 0) {
          depth = parentResult.rows[0].depth + 1;
        }
      }
    }

    const result = await client.query(`
      UPDATE categories
      SET name = $1, slug = $2, description = $3, parent_id = $4, parent_slug = $5, depth = $6
      WHERE id = $7
      RETURNING *
    `, [name, slug, description, parent_id || null, parent_slug || null, depth, id]);

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

