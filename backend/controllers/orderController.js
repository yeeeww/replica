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
      shipping_memo, depositor_name, use_points = 0
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: '주문할 상품이 없습니다.' });
    }

    // 사용자 적립금 확인
    const userResult = await client.query('SELECT points FROM users WHERE id = $1', [userId]);
    const userPoints = userResult.rows[0]?.points || 0;
    const pointsToUse = Math.min(parseInt(use_points) || 0, userPoints);

    if (pointsToUse < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '적립금 사용량이 올바르지 않습니다.' });
    }

    if (pointsToUse > userPoints) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '적립금이 부족합니다.' });
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

    // 적립금으로 할인 적용
    const finalAmount = Math.max(0, totalAmount - pointsToUse);

    // 구매 적립률 조회
    const settingResult = await client.query(
      "SELECT setting_value FROM site_settings WHERE setting_key = 'purchase_points_rate'"
    );
    const pointsRate = settingResult.rows.length > 0 
      ? parseFloat(settingResult.rows[0].setting_value) || 0 
      : 1; // 기본값 1%

    // 적립 예정 포인트 계산 (실제 결제 금액 기준)
    const earnedPoints = Math.floor(finalAmount * (pointsRate / 100));

    // 주문 생성 (적립금 사용/적립 정보 포함)
    const orderResult = await client.query(`
      INSERT INTO orders (
        user_id, total_amount, shipping_name, shipping_phone, shipping_address,
        orderer_name, orderer_phone, orderer_email, customs_id, shipping_memo, depositor_name,
        used_points, earned_points
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      userId, totalAmount, shipping_name, shipping_phone, shipping_address,
      orderer_name || null, orderer_phone || null, orderer_email || null,
      customs_id || null, shipping_memo || null, depositor_name || null,
      pointsToUse, earnedPoints
    ]);

    const order = orderResult.rows[0];

    // 주문 상품 추가
    for (const item of orderItems) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity)
        VALUES ($1, $2, $3, $4, $5)
      `, [order.id, item.product_id, item.product_name, item.product_price, item.quantity]);
    }

    // 적립금 사용 처리
    if (pointsToUse > 0) {
      // 사용자 적립금 차감
      await client.query(
        'UPDATE users SET points = points - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [pointsToUse, userId]
      );

      // 적립금 사용 내역 기록
      await client.query(`
        INSERT INTO points_history (user_id, amount, type, description, order_id)
        VALUES ($1, $2, 'use', '주문 시 적립금 사용', $3)
      `, [userId, -pointsToUse, order.id]);
    }

    // 적립금 적립은 배송완료 시 처리하도록 변경 (여기서는 예정만 기록)
    // earned_points는 order에 저장되어 배송완료 시 지급됨

    // 장바구니 비우기
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    await client.query('COMMIT');

    // 사용자의 남은 적립금 조회
    const updatedUserResult = await client.query('SELECT points FROM users WHERE id = $1', [userId]);
    const remainingPoints = updatedUserResult.rows[0]?.points || 0;

    res.status(201).json({
      message: '주문이 완료되었습니다.',
      order: {
        ...order,
        items: orderItems,
        final_amount: finalAmount
      },
      pointsUsed: pointsToUse,
      pointsToEarn: earnedPoints,
      remainingPoints: remainingPoints
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

    // 주문 상품 조회 (상품 이미지 포함)
    const itemsResult = await client.query(
      `SELECT oi.*, p.image_url 
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
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

// 비회원 주문 생성
exports.createGuestOrder = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { 
      shipping_name, shipping_phone, shipping_address, items,
      orderer_name, orderer_phone, orderer_email, customs_id, 
      shipping_memo, depositor_name
    } = req.body;

    if (!items || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '주문할 상품이 없습니다.' });
    }

    if (!shipping_name || !shipping_phone || !shipping_address) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '배송 정보를 모두 입력해주세요.' });
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

    // 비회원 주문 생성 (user_id = null)
    const orderResult = await client.query(`
      INSERT INTO orders (
        user_id, total_amount, shipping_name, shipping_phone, shipping_address,
        orderer_name, orderer_phone, orderer_email, customs_id, shipping_memo, depositor_name,
        used_points, earned_points
      )
      VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0)
      RETURNING *
    `, [
      totalAmount, shipping_name, shipping_phone, shipping_address,
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
    console.error('Create guest order error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 비회원 주문 조회
exports.getGuestOrder = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { order_id, shipping_phone } = req.body;

    if (!order_id || !shipping_phone) {
      return res.status(400).json({ message: '주문번호와 연락처를 입력해주세요.' });
    }

    // 주문 조회 (주문번호 + 수령인 연락처로 확인)
    const orderResult = await client.query(`
      SELECT o.* FROM orders o 
      WHERE o.id = $1 AND o.shipping_phone = $2
    `, [order_id, shipping_phone]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: '주문 정보를 찾을 수 없습니다. 주문번호와 연락처를 확인해주세요.' });
    }

    const order = orderResult.rows[0];

    // 주문 상품 조회
    const itemsResult = await client.query(`
      SELECT oi.*, p.image_url 
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `, [order.id]);

    res.json({
      order: {
        id: order.id,
        status: order.status,
        total_amount: order.total_amount,
        shipping_name: order.shipping_name,
        shipping_phone: order.shipping_phone,
        shipping_address: order.shipping_address,
        tracking_number: order.tracking_number,
        shipping_carrier: order.shipping_carrier,
        created_at: order.created_at,
        items: itemsResult.rows
      }
    });
  } catch (error) {
    console.error('Get guest order error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

// 주문 상태 변경 (관리자)
exports.updateOrderStatus = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { status, tracking_number, shipping_carrier, admin_memo } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '유효하지 않은 상태입니다.' });
    }

    // 기존 주문 정보 조회
    const existingOrder = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    if (existingOrder.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' });
    }

    const order = existingOrder.rows[0];
    const previousStatus = order.status;

    // 주문 상태 업데이트
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

    // 배송완료 시 적립금 지급 (이전 상태가 delivered가 아니었던 경우에만)
    if (status === 'delivered' && previousStatus !== 'delivered' && order.user_id && order.earned_points > 0) {
      // 사용자 적립금 증가
      await client.query(
        'UPDATE users SET points = points + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [order.earned_points, order.user_id]
      );

      // 적립금 지급 내역 기록
      await client.query(`
        INSERT INTO points_history (user_id, amount, type, description, order_id)
        VALUES ($1, $2, 'purchase', '구매 적립금', $3)
      `, [order.user_id, order.earned_points, order.id]);
    }

    // 주문 취소 시 사용했던 적립금 환불
    if (status === 'cancelled' && previousStatus !== 'cancelled' && order.user_id && order.used_points > 0) {
      // 사용자 적립금 환불
      await client.query(
        'UPDATE users SET points = points + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [order.used_points, order.user_id]
      );

      // 적립금 환불 내역 기록
      await client.query(`
        INSERT INTO points_history (user_id, amount, type, description, order_id)
        VALUES ($1, $2, 'refund', '주문 취소로 인한 적립금 환불', $3)
      `, [order.user_id, order.used_points, order.id]);
    }

    await client.query('COMMIT');

    res.json({
      message: '주문 상태가 변경되었습니다.',
      order: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update order status error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
};

