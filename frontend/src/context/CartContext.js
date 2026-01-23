import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const CartContext = createContext();

const GUEST_CART_KEY = 'guest_cart';

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  // 로컬스토리지에서 비회원 장바구니 로드
  const loadGuestCart = useCallback(() => {
    try {
      const saved = localStorage.getItem(GUEST_CART_KEY);
      if (saved) {
        const guestCart = JSON.parse(saved);
        const total = guestCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        setCart({ items: guestCart, total });
      } else {
        setCart({ items: [], total: 0 });
      }
    } catch (error) {
      console.error('Failed to load guest cart:', error);
      setCart({ items: [], total: 0 });
    }
  }, []);

  // 로컬스토리지에 비회원 장바구니 저장
  const saveGuestCart = useCallback((items) => {
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      setCart({ items, total });
    } catch (error) {
      console.error('Failed to save guest cart:', error);
    }
  }, []);

  // 회원 장바구니 가져오기
  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      loadGuestCart();
      return;
    }
    
    try {
      setLoading(true);
      const response = await axios.get('/cart');
      setCart(response.data);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, loadGuestCart]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // 장바구니에 상품 추가
  const addToCart = async (productId, quantity = 1, options = '') => {
    if (isAuthenticated) {
      // 회원: API 호출
      try {
        await axios.post('/cart', { product_id: productId, quantity });
        await fetchCart();
      } catch (error) {
        throw error;
      }
    } else {
      // 비회원: 상품 정보를 가져와서 로컬스토리지에 저장
      try {
        const response = await axios.get(`/products/${productId}`);
        const product = response.data.product;
        
        const currentItems = [...cart.items];
        const existingIndex = currentItems.findIndex(
          item => item.product_id === productId && item.options === options
        );

        if (existingIndex >= 0) {
          // 이미 있으면 수량 증가
          currentItems[existingIndex].quantity += quantity;
        } else {
          // 없으면 새로 추가
          currentItems.push({
            id: Date.now(), // 임시 ID
            product_id: productId,
            name: product.name,
            price: parseFloat(product.price),
            image_url: product.image_url,
            quantity: quantity,
            options: options,
            stock: product.stock
          });
        }

        saveGuestCart(currentItems);
      } catch (error) {
        throw error;
      }
    }
  };

  // 장바구니 아이템 수량 변경
  const updateCartItem = async (itemId, quantity) => {
    if (isAuthenticated) {
      try {
        await axios.put(`/cart/${itemId}`, { quantity });
        await fetchCart();
      } catch (error) {
        throw error;
      }
    } else {
      // 비회원: 로컬스토리지 업데이트
      const currentItems = cart.items.map(item => 
        item.id === itemId ? { ...item, quantity } : item
      );
      saveGuestCart(currentItems);
    }
  };

  // 장바구니에서 아이템 제거
  const removeFromCart = async (itemId) => {
    if (isAuthenticated) {
      try {
        await axios.delete(`/cart/${itemId}`);
        await fetchCart();
      } catch (error) {
        throw error;
      }
    } else {
      // 비회원: 로컬스토리지에서 제거
      const currentItems = cart.items.filter(item => item.id !== itemId);
      saveGuestCart(currentItems);
    }
  };

  // 장바구니 비우기
  const clearCart = async () => {
    if (isAuthenticated) {
      try {
        await axios.delete('/cart');
        setCart({ items: [], total: 0 });
      } catch (error) {
        throw error;
      }
    } else {
      // 비회원: 로컬스토리지 비우기
      localStorage.removeItem(GUEST_CART_KEY);
      setCart({ items: [], total: 0 });
    }
  };

  // 로그인 시 비회원 장바구니를 회원 장바구니로 병합 (선택적)
  const mergeGuestCartToUser = async () => {
    const guestCartData = localStorage.getItem(GUEST_CART_KEY);
    if (!guestCartData || !isAuthenticated) return;

    try {
      const guestItems = JSON.parse(guestCartData);
      for (const item of guestItems) {
        await axios.post('/cart', { 
          product_id: item.product_id, 
          quantity: item.quantity 
        });
      }
      localStorage.removeItem(GUEST_CART_KEY);
      await fetchCart();
    } catch (error) {
      console.error('Failed to merge guest cart:', error);
    }
  };

  const value = {
    cart,
    loading,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    fetchCart,
    mergeGuestCartToUser,
    itemCount: cart.items.length
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
