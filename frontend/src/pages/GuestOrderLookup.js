import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getGuestOrder } from '../services/api';
import './GuestOrderLookup.css';

const GuestOrderLookup = () => {
  const location = useLocation();
  const orderCompleteData = location.state;
  
  const [formData, setFormData] = useState({
    order_id: '',
    shipping_phone: ''
  });
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 비회원 주문 완료 후 리다이렉트된 경우
  useEffect(() => {
    if (orderCompleteData?.orderComplete) {
      setSuccessMessage(orderCompleteData.message || '주문이 완료되었습니다!');
      setFormData(prev => ({
        ...prev,
        order_id: String(orderCompleteData.orderId || '')
      }));
    }
  }, [orderCompleteData]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    setLoading(true);

    try {
      const response = await getGuestOrder(formData);
      setOrder(response.data.order);
    } catch (err) {
      setError(err.response?.data?.message || '주문 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending: '주문확인중',
      processing: '상품준비중',
      shipped: '배송중',
      delivered: '배송완료',
      cancelled: '주문취소'
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status) => {
    const classMap = {
      pending: 'status-pending',
      processing: 'status-processing',
      shipped: 'status-shipped',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled'
    };
    return classMap[status] || '';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="guest-order-page">
      <div className="guest-order-container">
        <h1>비회원 주문조회</h1>
        <p className="guest-order-desc">
          주문번호와 주문 시 입력한 수령인 연락처를 입력해주세요.
        </p>

        {successMessage && (
          <div className="success-message">
            <p>{successMessage}</p>
            <p className="sub">아래에 연락처를 입력하여 주문 상세 정보를 확인하세요.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="guest-order-form">
          <div className="form-group">
            <label htmlFor="order_id">주문번호</label>
            <input
              type="text"
              id="order_id"
              name="order_id"
              value={formData.order_id}
              onChange={handleChange}
              placeholder="주문번호를 입력하세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="shipping_phone">수령인 연락처</label>
            <input
              type="tel"
              id="shipping_phone"
              name="shipping_phone"
              value={formData.shipping_phone}
              onChange={handleChange}
              placeholder="010-0000-0000"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? '조회 중...' : '주문 조회'}
          </button>
        </form>

        {/* 주문 결과 */}
        {order && (
          <div className="guest-order-result">
            <div className="order-header">
              <div className="order-number">
                <span className="label">주문번호</span>
                <span className="value">{order.id}</span>
              </div>
              <span className={`order-status ${getStatusClass(order.status)}`}>
                {getStatusText(order.status)}
              </span>
            </div>

            <div className="order-date">
              주문일시: {formatDate(order.created_at)}
            </div>

            {/* 배송 정보 */}
            {order.tracking_number && (
              <div className="tracking-info">
                <h3>배송 정보</h3>
                <p>
                  <span className="label">택배사:</span> 
                  <span className="value">{order.shipping_carrier || '-'}</span>
                </p>
                <p>
                  <span className="label">운송장번호:</span> 
                  <span className="value">{order.tracking_number}</span>
                </p>
              </div>
            )}

            {/* 배송지 정보 */}
            <div className="shipping-info">
              <h3>배송지 정보</h3>
              <p>
                <span className="label">수령인:</span> 
                <span className="value">{order.shipping_name}</span>
              </p>
              <p>
                <span className="label">연락처:</span> 
                <span className="value">{order.shipping_phone}</span>
              </p>
              <p>
                <span className="label">주소:</span> 
                <span className="value">{order.shipping_address}</span>
              </p>
            </div>

            {/* 주문 상품 */}
            <div className="order-items">
              <h3>주문 상품</h3>
              {order.items.map((item, index) => (
                <div key={index} className="order-item">
                  <div className="item-image">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.product_name} />
                    ) : (
                      <div className="no-image">No Image</div>
                    )}
                  </div>
                  <div className="item-info">
                    <p className="item-name">{item.product_name}</p>
                    <p className="item-detail">
                      {parseInt(item.product_price).toLocaleString()}원 × {item.quantity}개
                    </p>
                  </div>
                  <div className="item-total">
                    {(parseInt(item.product_price) * item.quantity).toLocaleString()}원
                  </div>
                </div>
              ))}
            </div>

            {/* 결제 정보 */}
            <div className="order-total">
              <span>총 결제금액</span>
              <span className="total-price">{parseInt(order.total_amount).toLocaleString()}원</span>
            </div>
          </div>
        )}

        <div className="guest-order-footer">
          <p>회원이신가요? <Link to="/login">로그인</Link>하시면 더 편리하게 주문을 관리할 수 있습니다.</p>
        </div>
      </div>
    </div>
  );
};

export default GuestOrderLookup;
