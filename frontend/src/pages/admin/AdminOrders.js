import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders, updateOrderStatus } from '../../services/api';
import { formatPrice, formatDate, getOrderStatusText, getOrderStatusColor } from '../../utils/format';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await getOrders({ limit: 1000 });
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      alert('주문 상태가 변경되었습니다.');
    } catch (error) {
      alert(error.response?.data?.message || '상태 변경에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="loading">주문을 불러오는 중...</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>주문 관리</h1>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>주문번호</th>
            <th>주문일시</th>
            <th>수령인</th>
            <th>금액</th>
            <th>상태</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <Link 
                  to={`/orders/${order.id}`}
                  style={{ color: 'var(--primary-color)', fontWeight: '500' }}
                >
                  #{order.id}
                </Link>
              </td>
              <td>{formatDate(order.created_at)}</td>
              <td>{order.shipping_name}</td>
              <td>{formatPrice(order.total_amount)}</td>
              <td>
                <span style={{ color: getOrderStatusColor(order.status) }}>
                  {getOrderStatusText(order.status)}
                </span>
              </td>
              <td>
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px'
                  }}
                >
                  <option value="pending">주문 접수</option>
                  <option value="processing">처리중</option>
                  <option value="shipped">배송중</option>
                  <option value="delivered">배송 완료</option>
                  <option value="cancelled">취소됨</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary-color)' }}>
          주문 내역이 없습니다.
        </div>
      )}
    </div>
  );
};

export default AdminOrders;

