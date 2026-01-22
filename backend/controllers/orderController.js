const pool = require('../config/database');

// 주문 생성
exports.createOrder = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const userId = req.user.id;
    const { 
      shipping_name, shipping_phone, shipping_address, items,
      orderer_name, orderer_phone, orderer_email, customs_id, 
      shipping_memo, depositor_name 
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: '주문할 상품이 없습니다.' });
    }

    // 상품 재고 및 가격 확인
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const productResult = await client.query(
        'SELECT * FROM products WHERE id = $1 AND is_active = true',
        [item.product_id]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `상품 ID ${item.product_id}를 찾을 수 없습니다.` });
      }

      const product = productResult.rows[0];

      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `${product.name}의 재고가 부족합니다.` });
      }

      totalAmount += parseFloat(product.price) * item.quantity;
      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        quantity: item.quantity
      });

      // 재고 감소
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, product.id]
      );
    }

    // 주문 생성
    const orderResult = await client.query(`
      INSERT INTO orders (
        user_id, total_amount, shipping_name, shipping_phone, shipping_address,
        orderer_name, orderer_phone, orderer_email, customs_id, shipping_memo, depositor_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      userId, totalAmount, shipping_name, shipping_phone, shipping_address,
      orderer_name || null, orderer_phone || null, orderer_email || null,
      customs_id || null, shipping_memo || null, depositor_name || null
    ]);

    const order = orderResult.rows[0];

    // 주문 상품 추가
    for (const item of orderItems) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity)
        VALUES ($1, $2, $3, $4, $5)
      `, [order.id, item.product_id, item.product_name, item.product_price, item.quantity]);
    }

    // 장바구니 비우기
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    await client.query('COMMIT');

    res.status(201).json({
      message: '주문이 완료되었습니다.',
      order: {
        ...order,
        items: orderItems
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create order error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 주문 목록 조회
exports.getOrders = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.role === 'admin' ? null : req.user.id;
    const { page = 1, limit = 10, search, status, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    // 기본 쿼리 - 주문자 정보와 주문 상품 정보 포함
    let baseQuery = `
      SELECT DISTINCT o.*, 
        u.email as user_email, 
        u.name as user_name,
        (SELECT string_agg(oi.product_name, ', ') FROM order_items oi WHERE oi.order_id = o.id) as product_names
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
    `;
    
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // 일반 사용자는 본인 주문만
    if (userId) {
      conditions.push(`o.user_id = $${paramIndex++}`);
      params.push(userId);
    }

    // 검색어 (주문번호, 수령인, 연락처, 주문자 이메일/이름, 상품명)
    if (search) {
      conditions.push(`(
        CAST(o.id AS TEXT) LIKE $${paramIndex} OR
        o.shipping_name ILIKE $${paramIndex} OR
        o.shipping_phone ILIKE $${paramIndex} OR
        o.tracking_number ILIKE $${paramIndex} OR
        u.email ILIKE $${paramIndex} OR
        u.name ILIKE $${paramIndex} OR
        oi.product_name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // 상태 필터
    if (status) {
      conditions.push(`o.status = $${paramIndex++}`);
      params.push(status);
    }

    // 기간 필터
    if (startDate) {
      conditions.push(`o.created_at >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`o.created_at <= $${paramIndex++}`);
      params.push(endDate + ' 23:59:59');
    }

    // WHERE 절 조합
    let whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    // 총 개수 조회
    const countQuery = `SELECT COUNT(DISTINCT o.id) FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      LEFT JOIN order_items oi ON o.id = oi.order_id ${whereClause}`;
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // 주문 조회
    const query = baseQuery + whereClause + ` ORDER BY o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), offset);

    const result = await client.query(query, params);

    res.json({
      orders: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 주문 상세 조회
exports.getOrder = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const userId = req.user.role === 'admin' ? null : req.user.id;

    let query = `
      SELECT o.*, u.email as user_email, u.name as user_name 
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      WHERE o.id = $1
    `;
    const params = [id];

    if (userId) {
      query += ' AND o.user_id = $2';
      params.push(userId);
    }

    const orderResult = await client.query(query, params);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' });
    }

    const order = orderResult.rows[0];

    // 주문 상품 조회
    const itemsResult = await client.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id]
    );

    res.json({
      order: {
        ...order,
        items: itemsResult.rows
      }
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 주문 상태 변경 (관리자)
exports.updateOrderStatus = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { status, tracking_number, shipping_carrier, admin_memo } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: '유효하지 않은 상태입니다.' });
    }

    const result = await client.query(
      `UPDATE orders SET 
        status = $1, 
        tracking_number = $2, 
        shipping_carrier = $3, 
        admin_memo = COALESCE($4, admin_memo),
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = $5 RETURNING *`,
      [status, tracking_number || null, shipping_carrier || null, admin_memo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' });
    }

    res.json({
      message: '주문 상태가 변경되었습니다.',
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

