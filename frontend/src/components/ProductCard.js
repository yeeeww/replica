import React from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/format';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  return (
    <Link to={`/products/${product.id}`} className="product-card">
      <div className="product-image">
        <img src={product.image_url} alt={product.name} />
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        {product.category_name && (
          <p className="product-category">{product.category_name}</p>
        )}
        <p className="product-price">{formatPrice(product.price)}</p>
      </div>
    </Link>
  );
};

export default ProductCard;

