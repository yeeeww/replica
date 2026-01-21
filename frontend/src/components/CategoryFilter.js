import React, { useState } from 'react';
import './CategoryFilter.css';

const CategoryFilter = ({ selectedCategory, onCategoryChange }) => {
  const [openSubmenu, setOpenSubmenu] = useState(null);

  const defaultCategories = [
    { 
      id: 'men', 
      name: '남성', 
      slug: 'men', 
      hasSubmenu: true,
      submenu: [
        { id: 'men-bag', name: '가방', slug: 'men-bag' },
        { id: 'men-wallet', name: '지갑', slug: 'men-wallet' },
        { id: 'men-watch', name: '시계', slug: 'men-watch' },
        { id: 'men-shoes', name: '신발', slug: 'men-shoes' },
        { id: 'men-belt', name: '벨트', slug: 'men-belt' },
        { id: 'men-accessory', name: '악세서리', slug: 'men-accessory' },
        { id: 'men-hat', name: '모자', slug: 'men-hat' },
        { id: 'men-clothing', name: '의류', slug: 'men-clothing' },
        { id: 'men-glasses', name: '선글라스&안경', slug: 'men-glasses' },
        { id: 'men-etc', name: '기타', slug: 'men-etc' }
      ]
    },
    { 
      id: 'women', 
      name: '여성', 
      slug: 'women', 
      hasSubmenu: true,
      submenu: [
        { id: 'women-bag', name: '가방', slug: 'women-bag' },
        { id: 'women-wallet', name: '지갑', slug: 'women-wallet' },
        { id: 'women-watch', name: '시계', slug: 'women-watch' },
        { id: 'women-shoes', name: '신발', slug: 'women-shoes' },
        { id: 'women-belt', name: '벨트', slug: 'women-belt' },
        { id: 'women-accessory', name: '악세서리', slug: 'women-accessory' },
        { id: 'women-hat', name: '모자', slug: 'women-hat' },
        { id: 'women-clothing', name: '의류', slug: 'women-clothing' },
        { id: 'women-glasses', name: '선글라스&안경', slug: 'women-glasses' },
        { id: 'women-etc', name: '기타', slug: 'women-etc' }
      ]
    },
    { 
      id: 'domestic', 
      name: '국내출고상품', 
      slug: 'domestic', 
      hasSubmenu: true,
      submenu: [
        { id: 'domestic-bag-wallet', name: '가방&지갑', slug: 'domestic-bag-wallet' },
        { id: 'domestic-clothing', name: '의류', slug: 'domestic-clothing' },
        { id: 'domestic-shoes', name: '신발', slug: 'domestic-shoes' },
        { id: 'domestic-hat', name: '모자', slug: 'domestic-hat' },
        { id: 'domestic-accessory', name: '악세사리', slug: 'domestic-accessory' },
        { id: 'domestic-watch', name: '시계', slug: 'domestic-watch' },
        { id: 'domestic-fashion-acc', name: '패션잡화', slug: 'domestic-fashion-acc' },
        { id: 'domestic-home-kitchen', name: '생활&주방용품', slug: 'domestic-home-kitchen' },
        { id: 'domestic-belt', name: '벨트', slug: 'domestic-belt' },
        { id: 'domestic-perfume', name: '향수', slug: 'domestic-perfume' },
        { id: 'domestic-lighter', name: '라이터', slug: 'domestic-lighter' }
      ]
    },
    { id: 'recommend', name: '추천상품', slug: 'recommend' },
    { id: 'hot', name: '히트상품', slug: 'hot' },
    { id: 'popular', name: '인기상품', slug: 'popular' },
    { id: 'notice', name: '공지사항', slug: 'notice' }
  ];

  const handleCategoryClick = (category) => {
    if (category.hasSubmenu) {
      setOpenSubmenu(openSubmenu === category.id ? null : category.id);
    } else {
      onCategoryChange(category.slug);
      setOpenSubmenu(null);
    }
  };

  const handleSubmenuClick = (slug) => {
    onCategoryChange(slug);
    setOpenSubmenu(null);
  };

  return (
    <div className="category-filter">
      {defaultCategories.map((category) => (
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
                <button
                  key={item.id}
                  className={`submenu-item ${selectedCategory === item.slug ? 'active' : ''}`}
                  onClick={() => handleSubmenuClick(item.slug)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CategoryFilter;

