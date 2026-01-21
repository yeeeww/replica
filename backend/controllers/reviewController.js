const pool = require('../config/database');

// 상품의 리뷰 목록 조회
exports.getProductReviews = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // 리뷰 목록 조회
    const result = await client.query(`
      SELECT r.*, u.name as author_name
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = $1 AND r.is_active = true
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [productId, limit, offset]);

    // 총 개수 조회
    const countResult = await client.query(`
      SELECT COUNT(*) FROM reviews WHERE product_id = $1 AND is_active = true
    `, [productId]);
    const total = parseInt(countResult.rows[0].count);

    // 평균 별점 조회
    const avgResult = await client.query(`
      SELECT AVG(rating)::NUMERIC(2,1) as avg_rating
      FROM reviews WHERE product_id = $1 AND is_active = true
    `, [productId]);
    const avgRating = avgResult.rows[0].avg_rating || 0;

    // 이미지 파싱
    const reviews = result.rows.map(review => ({
      ...review,
      images: review.images ? review.images.split(';').filter(img => img) : [],
      author: review.author_name || '익명'
    }));

    res.json({
      reviews,
      avgRating: parseFloat(avgRating),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 리뷰 작성
exports.createReview = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { productId } = req.params;
    const { rating, content, images } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: '별점은 1~5 사이여야 합니다.' });
    }

    if (!content || content.trim().length < 10) {
      return res.status(400).json({ message: '리뷰 내용은 10자 이상이어야 합니다.' });
    }

    // 이미지 배열을 세미콜론으로 구분된 문자열로 변환
    const imagesStr = Array.isArray(images) ? images.join(';') : (images || '');

    const result = await client.query(`
      INSERT INTO reviews (product_id, user_id, rating, content, images)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [productId, userId, rating, content.trim(), imagesStr]);

    // 작성자 정보 조회
    const userResult = await client.query('SELECT name FROM users WHERE id = $1', [userId]);
    const authorName = userResult.rows[0]?.name || '익명';

    const review = {
      ...result.rows[0],
      images: imagesStr ? imagesStr.split(';') : [],
      author: authorName
    };

    res.status(201).json({
      message: '리뷰가 등록되었습니다.',
      review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 리뷰 수정
exports.updateReview = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { rating, content, images } = req.body;
    const userId = req.user?.id;

    // 본인 리뷰인지 확인
    const checkResult = await client.query(
      'SELECT user_id FROM reviews WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '리뷰를 찾을 수 없습니다.' });
    }

    if (checkResult.rows[0].user_id !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: '수정 권한이 없습니다.' });
    }

    const imagesStr = Array.isArray(images) ? images.join(';') : (images || '');

    const result = await client.query(`
      UPDATE reviews
      SET rating = $1, content = $2, images = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [rating, content.trim(), imagesStr, id]);

    res.json({
      message: '리뷰가 수정되었습니다.',
      review: {
        ...result.rows[0],
        images: imagesStr ? imagesStr.split(';') : []
      }
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 리뷰 삭제
exports.deleteReview = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // 본인 리뷰인지 확인
    const checkResult = await client.query(
      'SELECT user_id FROM reviews WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '리뷰를 찾을 수 없습니다.' });
    }

    if (checkResult.rows[0].user_id !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: '삭제 권한이 없습니다.' });
    }

    await client.query('DELETE FROM reviews WHERE id = $1', [id]);

    res.json({ message: '리뷰가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};
