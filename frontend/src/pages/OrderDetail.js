import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { getOrder, getImageUrl } from '../services/api';
import { formatPrice, formatDate, getOrderStatusText, getOrderStatusColor } from '../utils/format';
import './OrderDetail.css';

// 택배사 코드 -> 이름 변환
const CARRIER_MAP = {
  cj: 'CJ대한통운',
  hanjin: '한진택배',
  lotte: '롯데택배',
  logen: '로젠택배',
  post: '우체국택배',
  ems: 'EMS',
  fedex: 'FedEx',
  ups: 'UPS',
  dhl: 'DHL',
  sf: 'SF익스프레스',
  etc: '기타',
};

const getCarrierName = (code) => CARRIER_MAP[code] || code || '';

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

        <div className="order-detail-progress">
          {['pending','processing','shipped','delivered'].map((step, idx) => {
            const currentIndex = ['pending','processing','shipped','delivered'].indexOf(order.status);
            const isActive = currentIndex >= idx && currentIndex !== -1;
            const isCompleted = currentIndex > idx;
            const isCancelled = order.status === 'cancelled';
            const labels = {
              pending: '주문 접수',
              processing: '처리중',
              shipped: '배송중',
              delivered: '배송 완료',
            };
            return (
              <div key={step} className={`detail-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isCancelled ? 'cancelled' : ''}`}>
                <div className="detail-circle" />
                <span className="detail-label">{labels[step]}</span>
                {idx < 3 && <div className="detail-bar" />}
              </div>
            );
          })}
          {order.status === 'cancelled' && (
            <div className="detail-cancel">취소됨</div>
          )}
        </div>

        <div className="order-detail-content">
          <div className="order-detail-section">
            <h2>주문 상품</h2>
            <div className="order-items">
              {order.items.map((item) => (
                <div key={item.id} className="order-item">
                  <Link to={`/products/${item.product_id}`} className="order-item-image-link">
                    <img 
                      src={getImageUrl(item.image_url)} 
                      alt={item.product_name}
                      className="order-item-image"
                    />
                  </Link>
                  <div className="order-item-info">
                    <Link to={`/products/${item.product_id}`} className="order-item-name-link">
                      <p className="order-item-name">{item.product_name}</p>
                    </Link>
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
              {(order.tracking_number || order.shipping_carrier) && (
                <div className="order-shipping-row order-tracking-info">
                  <span>배송 조회</span>
                  <div className="order-tracking-detail">
                    {order.shipping_carrier && (
                      <span className="order-carrier">{getCarrierName(order.shipping_carrier)}</span>
                    )}
                    {order.tracking_number && (
                      <span className="order-tracking-number">{order.tracking_number}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="order-detail-section">
            <h2>결제 정보</h2>
            <div className="order-payment-info">
              <div className="order-payment-row">
                <span>상품 금액</span>
                <span>{formatPrice(order.total_amount)}</span>
              </div>
              <div className="order-payment-row order-payment-discount">
                <span>적립금 사용</span>
                <span className={order.used_points > 0 ? '' : 'no-discount'}>
                  {order.used_points > 0 ? `-${formatPrice(order.used_points)}` : '0원'}
                </span>
              </div>
              <div className="order-payment-row">
                <span>배송비</span>
                <span>무료</span>
              </div>
              <div className="order-payment-row">
                <span>결제 수단</span>
                <span>무통장 입금 (계좌이체)</span>
              </div>
              <div className="order-payment-total">
                <span>총 결제 금액</span>
                <span>{formatPrice(order.total_amount - (order.used_points || 0))}</span>
              </div>
              <div className="order-payment-row order-payment-points">
                <span>적립 예정</span>
                <span className={order.earned_points > 0 ? '' : 'no-points'}>
                  {order.earned_points > 0 
                    ? `+${order.earned_points.toLocaleString()}P ${order.status === 'delivered' ? '(지급완료)' : '(배송완료 시 지급)'}`
                    : '0P'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;

