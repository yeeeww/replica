import React, { useState, useEffect } from 'react';
import { getCategories } from '../services/api';
import './CategoryFilter.css';

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
  // 중분류 (영문 부분만)
  'bag': '가방',
  'wallet': '지갑',
  'bag-wallet': '가방&지갑',
  'watch': '시계',
  'shoes': '신발',
  'belt': '벨트',
  'accessory': '악세사리',
  'hat': '모자',
  'clothing': '의류',
  'glasses': '안경',
  'etc': '기타',
  'fashion': '패션잡화',
  'home': '생활&주방용품',
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

const CategoryFilter = ({ selectedCategory, onCategoryChange }) => {
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [openSubSubmenu, setOpenSubSubmenu] = useState(null); // 3단계 서브메뉴용
  const [allCategories, setAllCategories] = useState([]); // DB에서 불러온 모든 카테고리
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllCategories();
  }, []);

  // DB에서 모든 카테고리 불러오기
  const fetchAllCategories = async () => {
    try {
      const response = await getCategories();
      const cats = response.data.categories || [];
      setAllCategories(cats);
    } catch (error) {
      console.error('카테고리 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 전체 카테고리 구조 생성 (DB 기반)
  const getCategoryList = () => {
    // 대분류 (depth 1)
    const depth1Cats = allCategories.filter(c => c.depth === 1);
    // 중분류 (depth 2)
    const depth2Cats = allCategories.filter(c => c.depth === 2);
    // 소분류/브랜드 (depth 3)
    const depth3Cats = allCategories.filter(c => c.depth === 3);

    // 대분류 순서 정의
    const mainOrder = ['men', 'women', 'domestic', 'recommend', 'hot', 'popular'];
    
    // 대분류별로 구조 생성
    const categoryList = depth1Cats
      .sort((a, b) => {
        const aIdx = mainOrder.indexOf(a.slug);
        const bIdx = mainOrder.indexOf(b.slug);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      })
      .map(d1 => {
        // 이 대분류의 중분류들
        const submenus = depth2Cats
          .filter(d2 => d2.parent_slug === d1.slug)
          .map(d2 => {
            // 이 중분류의 소분류(브랜드)들
            const brands = depth3Cats
              .filter(d3 => d3.parent_slug === d2.slug)
              .map(d3 => ({
                id: d3.slug,
                name: getKoreanName(d3.slug, d3.name),
                slug: d3.slug
              }));

            return {
              id: d2.slug,
              name: getKoreanName(d2.slug, d2.name),
              slug: d2.slug,
              hasSubmenu: brands.length > 0,
              submenu: brands
            };
          });

        return {
          id: d1.slug,
          name: getKoreanName(d1.slug, d1.name),
          slug: d1.slug,
          hasSubmenu: submenus.length > 0,
          submenu: submenus
        };
      });

    // 공지사항은 고정 (DB에 없어도 표시)
    const hasNotice = categoryList.some(c => c.slug === 'notice');
    if (!hasNotice) {
      categoryList.push({ id: 'notice', name: '공지사항', slug: 'notice' });
    }

    return categoryList;
  };

  const categories = getCategoryList();

  const handleCategoryClick = (category) => {
    if (category.hasSubmenu) {
      setOpenSubmenu(openSubmenu === category.id ? null : category.id);
      setOpenSubSubmenu(null);
    } else {
      onCategoryChange(category.slug);
      setOpenSubmenu(null);
      setOpenSubSubmenu(null);
    }
  };

  const handleSubmenuClick = (item, e) => {
    e.stopPropagation();
    if (item.hasSubmenu && item.submenu && item.submenu.length > 0) {
      // 소분류가 있으면 서브서브메뉴 토글
      setOpenSubSubmenu(openSubSubmenu === item.id ? null : item.id);
    } else {
      // 소분류가 없으면 바로 선택
      onCategoryChange(item.slug);
      setOpenSubmenu(null);
      setOpenSubSubmenu(null);
    }
  };

  const handleSubSubmenuClick = (slug, e) => {
    e.stopPropagation();
    onCategoryChange(slug);
    setOpenSubmenu(null);
    setOpenSubSubmenu(null);
  };

  if (loading) {
    return <div className="category-filter">로딩중...</div>;
  }

  return (
    <div className="category-filter">
      {categories.map((category) => (
        <div key={category.id} className="category-item">
          <button
            className={`category-btn ${selectedCategory === category.slug ? 'active' : ''} ${category.hasSubmenu ? 'has-submenu' : ''}`}
            onClick={() => handleCategoryClick(category)}
          >
            {category.name}
            {category.hasSubmenu && <span className="submenu-arrow">▼</span>}
          </button>
          
          {category.hasSubmenu && openSubmenu === category.id && (
            <div className="submenu">
              {category.submenu.map((item) => (
                <div key={item.id} className="submenu-item-wrapper">
                  <button
                    className={`submenu-item ${selectedCategory === item.slug ? 'active' : ''} ${item.hasSubmenu ? 'has-children' : ''}`}
                    onClick={(e) => handleSubmenuClick(item, e)}
                  >
                    {item.name}
                    {item.hasSubmenu && item.submenu && item.submenu.length > 0 && (
                      <span className="submenu-arrow-right">▶</span>
                    )}
                  </button>
                  
                  {/* 3단계 소분류 서브메뉴 */}
                  {item.hasSubmenu && item.submenu && item.submenu.length > 0 && openSubSubmenu === item.id && (
                    <div className="sub-submenu">
                      {item.submenu.map((subItem) => (
                        <button
                          key={subItem.id}
                          className={`sub-submenu-item ${selectedCategory === subItem.slug ? 'active' : ''}`}
                          onClick={(e) => handleSubSubmenuClick(subItem.slug, e)}
                        >
                          {subItem.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CategoryFilter;

