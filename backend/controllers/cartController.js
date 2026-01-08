const pool = require('../config/database');

// 장바구니 조회
exports.getCart = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;

    const result = await client.query(`
      SELECT ci.*, p.name, p.price, p.image_url, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = $1 AND p.is_active = true
      ORDER BY ci.created_at DESC
    `, [userId]);

    const total = result.rows.reduce((sum, item) => {
      return sum + (parseFloat(item.price) * item.quantity);
    }, 0);

    res.json({
      items: result.rows,
      total: total.toFixed(2)
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 장바구니에 상품 추가
exports.addToCart = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const { product_id, quantity = 1 } = req.body;

    // 상품 존재 및 재고 확인
    const productResult = await client.query(
      'SELECT * FROM products WHERE id = $1 AND is_active = true',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    const product = productResult.rows[0];

    if (product.stock < quantity) {
      return res.status(400).json({ message: '재고가 부족합니다.' });
    }

    // 이미 장바구니에 있는지 확인
    const existingItem = await client.query(
      'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2',
      [userId, product_id]
    );

    let result;
    if (existingItem.rows.length > 0) {
      // 수량 업데이트
      const newQuantity = existingItem.rows[0].quantity + quantity;
      
      if (product.stock < newQuantity) {
        return res.status(400).json({ message: '재고가 부족합니다.' });
      }

      result = await client.query(
        'UPDATE cart_items SET quantity = $1 WHERE user_id = $2 AND product_id = $3 RETURNING *',
        [newQuantity, userId, product_id]
      );
    } else {
      // 새로 추가
      result = await client.query(
        'INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING *',
        [userId, product_id, quantity]
      );
    }

    res.json({
      message: '장바구니에 추가되었습니다.',
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 장바구니 상품 수량 변경
exports.updateCartItem = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ message: '수량은 1 이상이어야 합니다.' });
    }

    // 재고 확인
    const cartItem = await client.query(
      'SELECT ci.*, p.stock FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.id = $1 AND ci.user_id = $2',
      [id, userId]
    );

    if (cartItem.rows.length === 0) {
      return res.status(404).json({ message: '장바구니 항목을 찾을 수 없습니다.' });
    }

    if (cartItem.rows[0].stock < quantity) {
      return res.status(400).json({ message: '재고가 부족합니다.' });
    }

    const result = await client.query(
      'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [quantity, id, userId]
    );

    res.json({
      message: '수량이 변경되었습니다.',
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 장바구니 상품 삭제
exports.removeFromCart = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await client.query(
      'DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '장바구니 항목을 찾을 수 없습니다.' });
    }

    res.json({ message: '장바구니에서 삭제되었습니다.' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 장바구니 비우기
exports.clearCart = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;

    await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    res.json({ message: '장바구니가 비워졌습니다.' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

