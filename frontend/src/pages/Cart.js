import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';
import './Cart.css';

const Cart = () => {
  const navigate = useNavigate();
  const { cart, updateCartItem, removeFromCart, loading } = useCart();
  const [updating, setUpdating] = useState({});

  const handleQuantityChange = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    
    setUpdating({ ...updating, [itemId]: true });
    try {
      await updateCartItem(itemId, newQuantity);
    } catch (error) {
      alert(error.response?.data?.message || '수량 변경에 실패했습니다.');
    } finally {
      setUpdating({ ...updating, [itemId]: false });
    }
  };

  const handleRemove = async (itemId) => {
    if (!window.confirm('장바구니에서 삭제하시겠습니까?')) return;
    
    try {
      await removeFromCart(itemId);
    } catch (error) {
      alert(error.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  const handleCheckout = () => {
    navigate('/checkout');
  };

  if (loading) {
    return <div className="container loading">장바구니를 불러오는 중...</div>;
  }

  if (cart.items.length === 0) {
    return (
      <div className="cart-empty">
        <div className="container">
          <h2>장바구니가 비어있습니다</h2>
          <p>상품을 담아보세요!</p>
          <Link to="/products" className="btn btn-primary">
            쇼핑 계속하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="container">
        <h1>장바구니</h1>

        <div className="cart-content">
          <div className="cart-items">
            {cart.items.map((item) => (
              <div key={item.id} className="cart-item">
                <Link to={`/products/${item.product_id}`} className="cart-item-image">
                  <img src={item.image_url} alt={item.name} />
                </Link>

                <div className="cart-item-info">
                  <Link to={`/products/${item.product_id}`} className="cart-item-name">
                    {item.name}
                  </Link>
                  <p className="cart-item-price">{formatPrice(item.price)}</p>
                </div>

                <div className="cart-item-quantity">
                  <button
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    disabled={updating[item.id]}
                  >
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                    disabled={updating[item.id] || item.quantity >= item.stock}
                  >
                    +
                  </button>
                </div>

                <div className="cart-item-total">
                  {formatPrice(item.price * item.quantity)}
                </div>

                <button
                  className="cart-item-remove"
                  onClick={() => handleRemove(item.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h2>주문 요약</h2>
            
            <div className="cart-summary-row">
              <span>상품 금액</span>
              <span>{formatPrice(cart.total)}</span>
            </div>
            
            <div className="cart-summary-row">
              <span>배송비</span>
              <span>무료</span>
            </div>
            
            <div className="cart-summary-total">
              <span>총 결제 금액</span>
              <span>{formatPrice(cart.total)}</span>
            </div>

            <button 
              className="btn btn-primary btn-full"
              onClick={handleCheckout}
            >
              주문하기
            </button>

            <Link to="/products" className="btn btn-secondary btn-full">
              쇼핑 계속하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;

