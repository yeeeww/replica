import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder } from '../services/api';
import { formatPrice } from '../utils/format';
import './Checkout.css';

const Checkout = () => {
  const navigate = useNavigate();
  const { cart } = useCart();
  
  const [formData, setFormData] = useState({
    shipping_name: '',
    shipping_phone: '',
    shipping_address: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const orderData = {
        ...formData,
        items: cart.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity
        }))
      };

      const response = await createOrder(orderData);
      navigate(`/orders/${response.data.order.id}`, { 
        state: { message: '주문이 완료되었습니다!' }
      });
    } catch (error) {
      setError(error.response?.data?.message || '주문에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (cart.items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="checkout-page">
      <div className="container">
        <h1>주문하기</h1>

        {error && <div className="error">{error}</div>}

        <div className="checkout-content">
          <form onSubmit={handleSubmit} className="checkout-form">
            <div className="checkout-section">
              <h2>배송 정보</h2>
              
              <div className="form-group">
                <label htmlFor="shipping_name">수령인</label>
                <input
                  type="text"
                  id="shipping_name"
                  name="shipping_name"
                  value={formData.shipping_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="shipping_phone">연락처</label>
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

              <div className="form-group">
                <label htmlFor="shipping_address">배송 주소</label>
                <textarea
                  id="shipping_address"
                  name="shipping_address"
                  value={formData.shipping_address}
                  onChange={handleChange}
                  rows="3"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-full"
              disabled={loading}
            >
              {loading ? '주문 처리 중...' : `${formatPrice(cart.total)} 결제하기`}
            </button>
          </form>

          <div className="checkout-summary">
            <h2>주문 상품</h2>
            
            <div className="checkout-items">
              {cart.items.map((item) => (
                <div key={item.id} className="checkout-item">
                  <img src={item.image_url} alt={item.name} />
                  <div className="checkout-item-info">
                    <p className="checkout-item-name">{item.name}</p>
                    <p className="checkout-item-quantity">수량: {item.quantity}</p>
                  </div>
                  <p className="checkout-item-price">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            <div className="checkout-summary-total">
              <div className="checkout-summary-row">
                <span>상품 금액</span>
                <span>{formatPrice(cart.total)}</span>
              </div>
              <div className="checkout-summary-row">
                <span>배송비</span>
                <span>무료</span>
              </div>
              <div className="checkout-summary-final">
                <span>총 결제 금액</span>
                <span>{formatPrice(cart.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;

