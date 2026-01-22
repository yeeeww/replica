import React from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/format';
import { getImageUrl } from '../services/api';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  // 최근 7일 이내 등록된 상품인지 확인
  const isNew = () => {
    if (!product.created_at) return false;
    const createdDate = new Date(product.created_at);
    const now = new Date();
    const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  };

  return (
    <Link to={`/products/${product.id}`} className="product-card">
      <div className="product-image">
        <img src={getImageUrl(product.image_url)} alt={product.name} />
      </div>
      <div className="product-info">
        {product.category_full_path && (
          <p className="product-category-path">{product.category_full_path}</p>
        )}
        <h3 className="product-name">{product.name}</h3>
        {product.department_price && (
          <p className="product-dept-price">
            <span className="dept-label">백화점가</span>
            <span className="dept-value">{formatPrice(product.department_price)}</span>
          </p>
        )}
        <p className="product-price">
          <span className="price-label">판매가</span>
          <span className="price-value">{formatPrice(product.price)}</span>
        </p>
        {isNew() && <span className="product-badge-new">NEW</span>}
        <div className="product-meta">
          <span className="product-reviews">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            {product.review_count || 0}
          </span>
          <span className="product-cart-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
