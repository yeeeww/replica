import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getCategories, getPublicSettings } from '../services/api';
import './Header.css';

// 카테고리 영문 slug -> 한글 이름 매핑
const categoryNameMap = {
  // 대분류
  'men': '남성',
  'women': '여성',
  'domestic': '국내출고상품',
  'recommend': '추천상품',
  'hot': '히트상품',
  'popular': '인기상품',
  'notice': '공지사항',
  // 중분류
  'bag': '가방',
  'wallet': '지갑',
  'bag-wallet': '가방&지갑',
  'watch': '시계',
  'shoes': '신발',
  'belt': '벨트',
  'accessory': '악세사리',
  'hat': '모자',
  'clothing': '의류',
  'glasses': '선글라스&안경',
  'etc': '기타',
  'fashion': '패션잡화',
  'fashion-acc': '패션잡화',
  'home': '생활&주방용품',
  'home-kitchen': '생활&주방용품',
  'perfume': '향수',
  'lighter': '라이터',
};

// slug에서 한글 이름 추출
const getKoreanName = (slug, originalName) => {
  // 이미 한글이면 그대로 반환
  if (/[가-힣]/.test(originalName)) {
    return originalName;
  }
  
  // 대분류 매핑 체크
  if (categoryNameMap[slug]) {
    return categoryNameMap[slug];
  }
  
  // 중분류: men-bag -> bag 부분 추출
  const parts = slug.split('-');
  if (parts.length >= 2) {
    const subType = parts.slice(1).join('-');
    if (categoryNameMap[subType]) {
      return categoryNameMap[subType];
    }
  }
  
  return originalName;
};

const Header = () => {
  const { user, logout, isAdmin } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const [registerPoints, setRegisterPoints] = useState(5000);
  const [searchOpen, setSearchOpen] = useState(false);

  // DB에서 카테고리 불러오기
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await getCategories();
        setAllCategories(response.data.categories || []);
      } catch (error) {
        console.error('카테고리 로딩 실패:', error);
      }
    };
    fetchCategories();
  }, []);

  // 회원가입 적립금 설정 가져오기
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await getPublicSettings();
        const points = parseInt(response.data.settings?.register_points) || 5000;
        setRegisterPoints(points);
      } catch (error) {
        console.error('설정 로딩 실패:', error);
      }
    };
    fetchSettings();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      navigate(`/products?search=${encodeURIComponent(trimmed)}`);
      closeSearch();
    }
  };

  const toggleSearch = () => {
    if (searchOpen) {
      closeSearch();
      return;
    }
    setSearchOpen(true);
    setTimeout(() => {
      const input = document.querySelector('.search-input-overlay');
      if (input) input.focus();
    }, 100);
  };

  const closeSearch = () => {
    setSearchQuery('');
    setSearchOpen(false);
  };

  // DB 카테고리를 메뉴 구조로 변환
  const menuConfig = useMemo(() => {
    const depth1Cats = allCategories.filter(c => c.depth === 1);
    const depth2Cats = allCategories.filter(c => c.depth === 2);

    // 대분류 순서 정의
    const mainOrder = ['men', 'women', 'domestic', 'recommend', 'hot', 'popular'];

    // 중분류 순서 정의 (대분류별)
    const subOrderMap = {
      // 남성, 여성: 가방, 지갑, 시계, 신발, 벨트, 악세서리, 모자, 의류, 선글라스&안경, 기타
      men: ['bag', 'wallet', 'watch', 'shoes', 'belt', 'accessory', 'hat', 'clothing', 'glasses', 'etc'],
      women: ['bag', 'wallet', 'watch', 'shoes', 'belt', 'accessory', 'hat', 'clothing', 'glasses', 'etc'],
      // 국내출고상품: 가방&지갑, 의류, 신발, 모자, 악세서리, 시계, 패션잡화, 생활&주방용품, 벨트, 향수, 라이터
      domestic: ['bag-wallet', 'clothing', 'shoes', 'hat', 'accessory', 'watch', 'fashion', 'fashion-acc', 'home', 'home-kitchen', 'belt', 'perfume', 'lighter']
    };

    // 대분류 슬러그 표준화 (실서버에서 men-kor 등 변형 대비)
    const normalizeParentSlug = (slug) => {
      if (!slug) return slug;
      if (slug.startsWith('men')) return 'men';
      if (slug.startsWith('women')) return 'women';
      if (slug.startsWith('domestic')) return 'domestic';
      return slug;
    };

    // 슬러그 표준화 (동일 의미 다른 슬러그를 정렬 대상에 맞추기)
    const normalizeSubSlug = (slug) => {
      const base = (slug || '').toLowerCase().trim();
      const map = {
        'acc': 'accessory',
        'accessories': 'accessory',
        'accessory': 'accessory',
        'sunglass': 'glasses',
        'sunglasses': 'glasses',
        'sunglasses&glasses': 'glasses',
        'sunglasses-glasses': 'glasses',
        'sunglasses_glasses': 'glasses',
        'glasses': 'glasses',
        'shoe': 'shoes',
        'shoes': 'shoes',
      };
      return map[base] || base;
    };

    // 중분류 정렬 함수
    const sortSubCategories = (parentSlug, children) => {
      const parentKey = normalizeParentSlug(parentSlug);
      const order = subOrderMap[parentKey];
      if (!order) return children;

      return children.sort((a, b) => {
        // slug에서 대분류 제거 후 중분류 추출 (예: men-bag -> bag)
        const aParts = a.slug.split('-');
        const bParts = b.slug.split('-');
        const aSubSlug = normalizeSubSlug(aParts.slice(1).join('-'));
        const bSubSlug = normalizeSubSlug(bParts.slice(1).join('-'));
        
        const aIdx = order.indexOf(aSubSlug);
        const bIdx = order.indexOf(bSubSlug);
        
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    };

    const menu = depth1Cats
      .sort((a, b) => {
        const aIdx = mainOrder.indexOf(a.slug);
        const bIdx = mainOrder.indexOf(b.slug);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      })
      .map(d1 => {
        // 추천/히트/인기 상품은 중분류 없이 단독 메뉴
        if (['recommend', 'hot', 'popular'].includes(d1.slug)) {
          return {
            label: getKoreanName(d1.slug, d1.name),
            slug: d1.slug,
          };
        }

        // 이 대분류의 중분류들
        const children = depth2Cats
          .filter(d2 => d2.parent_slug === d1.slug)
          .map(d2 => ({
            label: getKoreanName(d2.slug, d2.name),
            slug: d2.slug,
          }));

        // 중분류 정렬
        const sortedChildren = sortSubCategories(d1.slug, children);

        return {
          label: getKoreanName(d1.slug, d1.name),
          slug: d1.slug,
          children: sortedChildren.length > 0 ? sortedChildren : undefined,
        };
      });

    // 공지사항 추가 (항상 맨 뒤)
    menu.push({ label: '공지사항', slug: 'notice', isNotice: true });

    return menu;
  }, [allCategories]);

  const toggleSubmenu = (slug) => {
    setOpenSubmenu(openSubmenu === slug ? null : slug);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setOpenSubmenu(null);
  };

  return (
    <header className="header">
      {/* 모바일 헤더 */}
      <div className="mobile-header">
        <div className="mobile-header-top">
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
          <Link to="/" className="mobile-logo">
            <span className="logo-text">WIZNOBLE</span>
            <span className="logo-text-mirror">ELBONZIW</span>
          </Link>
          <button className="mobile-search-btn" onClick={toggleSearch}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </button>
        </div>
        <div className="mobile-header-bottom">
          {user ? (
            <>
              <span className="mobile-user-name">{user.name || user.email}</span>
              <Link to="/mypage">마이페이지</Link>
              <Link to="/orders">주문내역</Link>
              <button className="mobile-logout-btn" onClick={handleLogout}>로그아웃</button>
            </>
          ) : (
            <>
              <Link to="/login">로그인</Link>
              <Link to="/terms" className="register-link-wrapper mobile-register">
                <span className="floating-points-badge">+{registerPoints.toLocaleString()} P</span>
                회원가입
              </Link>
            </>
          )}
          <Link to="/cart" className="mobile-cart-link">
            장바구니
            {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
          </Link>
        </div>
      </div>

      {/* 데스크탑 상단 유틸리티 바 */}
      <div className="header-top desktop-header">
        <div className="container">
          <div className="header-top-content">
            <div className="header-top-left">
              {/* 빈 공간 */}
            </div>
            <div className="header-top-right">
              <button className="icon-btn search-btn" onClick={toggleSearch}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </button>
              {user ? (
                <>
                  <Link to="/mypage">마이페이지</Link>
                  <Link to="/orders">주문내역</Link>
                  <button className="link-btn" onClick={handleLogout}>로그아웃</button>
                </>
              ) : (
                <>
                  <Link to="/login">로그인</Link>
                  <Link to="/terms" className="register-link-wrapper">
                    <span className="floating-points-badge">+{registerPoints.toLocaleString()} P</span>
                    회원가입
                  </Link>
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

      {/* 데스크탑 로고 영역 */}
      <div className="header-logo desktop-header">
        <div className="container">
          <Link to="/" className="logo">
            <span className="logo-text">WIZNOBLE</span>
            <span className="logo-text-mirror">ELBONZIW</span>
          </Link>
        </div>
      </div>

      {/* 데스크탑 메인 네비게이션 */}
      <div className="header-nav desktop-nav">
        <div className="container">
          <nav className="main-nav">
            {menuConfig.map((item) => (
              <div className="nav-item-wrapper" key={item.slug}>
                <Link 
                  to={item.isNotice ? '/notices' : `/products?category=${item.slug}`} 
                  className="nav-item"
                >
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
                관리자
              </Link>
            )}
          </nav>
        </div>
      </div>

      {/* 모바일 사이드 메뉴 */}
      <div className={`mobile-menu-overlay ${mobileMenuOpen ? 'open' : ''}`} onClick={closeMobileMenu}></div>
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <span className="mobile-menu-title">메뉴</span>
          <button className="mobile-menu-close" onClick={closeMobileMenu}>✕</button>
        </div>
        <nav className="mobile-nav">
          {menuConfig.map((item) => (
            <div className="mobile-nav-item" key={item.slug}>
              {item.children ? (
                <>
                  <button 
                    className={`mobile-nav-link has-children ${openSubmenu === item.slug ? 'open' : ''}`}
                    onClick={() => toggleSubmenu(item.slug)}
                  >
                    {item.label}
                    <span className="mobile-arrow">{openSubmenu === item.slug ? '−' : '+'}</span>
                  </button>
                  <div className={`mobile-submenu ${openSubmenu === item.slug ? 'open' : ''}`}>
                    <Link 
                      to={`/products?category=${item.slug}`} 
                      className="mobile-submenu-link"
                      onClick={closeMobileMenu}
                    >
                      전체보기
                    </Link>
                    {item.children.map((child) => (
                      <Link
                        key={child.slug}
                        to={`/products?category=${child.slug}`}
                        className="mobile-submenu-link"
                        onClick={closeMobileMenu}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <Link 
                  to={item.isNotice ? '/notices' : `/products?category=${item.slug}`}
                  className="mobile-nav-link"
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              )}
            </div>
          ))}
          {isAdmin && (
            <div className="mobile-nav-item">
              <Link to="/admin" className="mobile-nav-link" onClick={closeMobileMenu}>
                관리자
              </Link>
            </div>
          )}
        </nav>
      </div>

      {/* 검색 오버레이 */}
      {searchOpen && (
        <>
          <div className="search-overlay-backdrop" onClick={closeSearch}></div>
          <div className="search-overlay">
            <div className="container">
              <form className="search-form-overlay" onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder="상품명을 입력하세요"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input-overlay"
                  autoFocus
                />
                <button type="submit" className="search-btn-overlay">
                  검색
                </button>
                <button type="button" className="search-close-btn" onClick={closeSearch}>
                  ✕
                </button>
              </form>
              <div className="search-hint">
                Enter를 누르면 검색 결과 페이지로 이동합니다.
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
};

export default Header;

