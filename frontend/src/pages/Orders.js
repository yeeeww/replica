import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../services/api';
import { formatPrice, formatDate, getOrderStatusText, getOrderStatusColor } from '../utils/format';
import './Orders.css';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const statusSteps = [
    { key: 'pending', label: '주문 접수' },
    { key: 'processing', label: '처리중' },
    { key: 'shipped', label: '배송중' },
    { key: 'delivered', label: '배송 완료' },
  ];

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await getOrders();
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container loading">주문 내역을 불러오는 중...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="orders-empty">
        <div className="container">
          <h2>주문 내역이 없습니다</h2>
          <p>첫 주문을 시작해보세요!</p>
          <Link to="/products" className="btn btn-primary">
            쇼핑하러 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="container">
        <h1>주문 내역</h1>

        <div className="orders-list">
          {orders.map((order) => (
            <Link 
              key={order.id} 
              to={`/orders/${order.id}`}
              className="order-card"
            >
              <div className="order-header">
                <div>
                  <p className="order-id">주문번호: {order.id}</p>
                  <p className="order-date">{formatDate(order.created_at)}</p>
                </div>
                <span 
                  className="order-status"
                  style={{ color: getOrderStatusColor(order.status) }}
                >
                  {getOrderStatusText(order.status)}
                </span>
              </div>

                <div className="order-progress">
                  {statusSteps.map((step, idx) => {
                    const currentIndex = statusSteps.findIndex(s => s.key === order.status);
                    const isActive = currentIndex >= idx && currentIndex !== -1;
                    const isCompleted = currentIndex > idx;
                    const isCancelled = order.status === 'cancelled';
                    return (
                      <div key={step.key} className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isCancelled ? 'cancelled' : ''}`}>
                        <div className="progress-circle" />
                        <span className="progress-label">{step.label}</span>
                        {idx < statusSteps.length - 1 && <div className="progress-bar" />}
                      </div>
                    );
                  })}
                  {order.status === 'cancelled' && (
                    <div className="cancel-text">취소됨</div>
                  )}
                </div>

              <div className="order-info">
                <div className="order-info-item">
                  <span className="order-info-label">수령인</span>
                  <span>{order.shipping_name}</span>
                </div>
                <div className="order-info-item">
                  <span className="order-info-label">배송지</span>
                  <span>{order.shipping_address}</span>
                </div>
                <div className="order-info-item">
                  <span className="order-info-label">결제 금액</span>
                  <span className="order-total">{formatPrice(order.total_amount)}</span>
                </div>
                  <div className="order-info-item">
                    <span className="order-info-label">결제 수단</span>
                    <span>무통장 입금 (계좌이체)</span>
                  </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Orders;

