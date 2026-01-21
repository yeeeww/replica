import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { getOrder } from '../services/api';
import { formatPrice, formatDate, getOrderStatusText, getOrderStatusColor } from '../utils/format';
import './OrderDetail.css';

const OrderDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(location.state?.message || '');

  const fetchOrder = useCallback(async () => {
    try {
      const response = await getOrder(id);
      setOrder(response.data.order);
    } catch (error) {
      console.error('Failed to fetch order:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (loading) {
    return <div className="container loading">주문 정보를 불러오는 중...</div>;
  }

  if (!order) {
    return <div className="container error">주문을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="order-detail-page">
      <div className="container">
        {message && <div className="success">{message}</div>}

        <div className="order-detail-header">
          <div>
            <h1>주문 상세</h1>
            <p className="order-detail-id">주문번호: {order.id}</p>
            <p className="order-detail-date">{formatDate(order.created_at)}</p>
          </div>
          <span 
            className="order-detail-status"
            style={{ color: getOrderStatusColor(order.status) }}
          >
            {getOrderStatusText(order.status)}
          </span>
        </div>

        <div className="order-detail-content">
          <div className="order-detail-section">
            <h2>주문 상품</h2>
            <div className="order-items">
              {order.items.map((item) => (
                <div key={item.id} className="order-item">
                  <div className="order-item-info">
                    <p className="order-item-name">{item.product_name}</p>
                    <p className="order-item-quantity">수량: {item.quantity}</p>
                  </div>
                  <p className="order-item-price">
                    {formatPrice(item.product_price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="order-detail-section">
            <h2>배송 정보</h2>
            <div className="order-shipping-info">
              <div className="order-shipping-row">
                <span>수령인</span>
                <span>{order.shipping_name}</span>
              </div>
              <div className="order-shipping-row">
                <span>연락처</span>
                <span>{order.shipping_phone}</span>
              </div>
              <div className="order-shipping-row">
                <span>배송 주소</span>
                <span>{order.shipping_address}</span>
              </div>
            </div>
          </div>

          <div className="order-detail-section">
            <h2>결제 정보</h2>
            <div className="order-payment-info">
              <div className="order-payment-row">
                <span>상품 금액</span>
                <span>{formatPrice(order.total_amount)}</span>
              </div>
              <div className="order-payment-row">
                <span>배송비</span>
                <span>무료</span>
              </div>
              <div className="order-payment-total">
                <span>총 결제 금액</span>
                <span>{formatPrice(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;

