import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import './Header.css';

const Header = () => {
  const { user, logout, isAdmin } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${searchQuery}`);
    }
  };

  const menuConfig = [
    {
      label: '남성',
      slug: 'men',
      children: [
        { label: '가방', slug: 'men-bag' },
        { label: '지갑', slug: 'men-wallet' },
        { label: '시계', slug: 'men-watch' },
        { label: '신발', slug: 'men-shoes' },
        { label: '벨트', slug: 'men-belt' },
        { label: '악세서리', slug: 'men-accessory' },
        { label: '모자', slug: 'men-hat' },
        { label: '의류', slug: 'men-clothing' },
        { label: '선글라스&안경', slug: 'men-glasses' },
        { label: '기타', slug: 'men-etc' },
      ],
    },
    {
      label: '여성',
      slug: 'women',
      children: [
        { label: '가방', slug: 'women-bag' },
        { label: '지갑', slug: 'women-wallet' },
        { label: '시계', slug: 'women-watch' },
        { label: '신발', slug: 'women-shoes' },
        { label: '벨트', slug: 'women-belt' },
        { label: '악세서리', slug: 'women-accessory' },
        { label: '모자', slug: 'women-hat' },
        { label: '의류', slug: 'women-clothing' },
        { label: '선글라스&안경', slug: 'women-glasses' },
        { label: '기타', slug: 'women-etc' },
      ],
    },
    {
      label: '국내출고상품',
      slug: 'domestic',
      children: [
        { label: '가방&지갑', slug: 'domestic-bag-wallet' },
        { label: '의류', slug: 'domestic-clothing' },
        { label: '신발', slug: 'domestic-shoes' },
        { label: '모자', slug: 'domestic-hat' },
        { label: '악세사리', slug: 'domestic-accessory' },
        { label: '시계', slug: 'domestic-watch' },
        { label: '패션잡화', slug: 'domestic-fashion-acc' },
        { label: '생활&주방용품', slug: 'domestic-home-kitchen' },
        { label: '벨트', slug: 'domestic-belt' },
        { label: '향수', slug: 'domestic-perfume' },
        { label: '라이터', slug: 'domestic-lighter' },
      ],
    },
    { label: '추천상품', slug: 'recommend' },
    { label: '히트상품', slug: 'hot' },
    { label: '인기상품', slug: 'popular' },
    { label: '공지사항', slug: 'notice' },
  ];

  return (
    <header className="header">
      {/* 상단 유틸리티 바 */}
      <div className="header-top">
        <div className="container">
          <div className="header-top-content">
            <div className="points-info">+5,000 P</div>
            <div className="header-top-right">
              <button className="icon-btn">🔍</button>
              {user ? (
                <>
                  <span className="welcome-text">{user.name || user.email}</span>
                  <button className="link-btn" onClick={handleLogout}>로그아웃</button>
                </>
              ) : (
                <>
                  <Link to="/login">로그인</Link>
                  <Link to="/register">회원가입</Link>
                </>
              )}
              <Link to="/cart" className="cart-link">
                장바구니
                {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 로고 영역 */}
      <div className="header-logo">
        <div className="container">
          <Link to="/" className="logo">
            <span className="logo-text">WIZNOBLE</span>
            <span className="logo-text-mirror">ELBONZIW</span>
          </Link>
        </div>
      </div>

      {/* 메인 네비게이션 */}
      <div className="header-nav">
        <div className="container">
          <nav className="main-nav">
            {menuConfig.map((item) => (
              <div className="nav-item-wrapper" key={item.slug}>
                <Link to={`/products?category=${item.slug}`} className="nav-item">
                  {item.label}
                </Link>
                {item.children && (
                  <div className="nav-dropdown">
                    {item.children.map((child) => (
                      <Link
                        key={child.slug}
                        to={`/products?category=${child.slug}`}
                        className="dropdown-item"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isAdmin && (
              <Link to="/admin" className="nav-item">
                출고 검수 사진
              </Link>
            )}
          </nav>
        </div>
      </div>

      {/* 검색 오버레이 (숨김 상태) */}
      <div className="search-overlay" style={{ display: 'none' }}>
        <div className="container">
          <form className="search-form-overlay" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="상품 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-overlay"
            />
            <button type="submit" className="search-btn-overlay">
              검색
            </button>
          </form>
        </div>
      </div>
    </header>
  );
};

export default Header;

