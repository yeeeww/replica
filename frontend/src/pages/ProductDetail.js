import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProduct } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { formatPrice } from "../utils/format";
import "./ProductDetail.css";

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState({ type: "", text: "" });

  const fetchProduct = useCallback(async () => {
    try {
      const response = await getProduct(id);
      setProduct(response.data.product);
    } catch (error) {
      console.error("Failed to fetch product:", error);
      setMessage({ type: "error", text: "상품을 불러올 수 없습니다." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      await addToCart(product.id, quantity);
      setMessage({ type: "success", text: "장바구니에 추가되었습니다." });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      setMessage({ 
        type: "error", 
        text: error.response?.data?.message || "장바구니 추가에 실패했습니다." 
      });
    }
  };

  const handleQuantityChange = (delta) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= product.stock) {
      setQuantity(newQuantity);
    }
  };

  const detailImages = useMemo(() => {
    const desc = product?.description || "";
    const imgs = desc
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && s.startsWith("http"));
    return imgs;
  }, [product]);

  if (loading) {
    return <div className="container loading">상품을 불러오는 중...</div>;
  }

  if (!product) {
    return <div className="container error">상품을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="product-detail">
      <div className="container">
        {message.text && (
          <div className={`alert ${message.type}`}>{message.text}</div>
        )}

        <div className="product-detail-content">
          <div className="product-gallery">
            <div className="product-main-image">
              <img src={product.image_url} alt={product.name} />
            </div>
          </div>

          <div className="product-detail-info">
            {product.category_name && (
              <p className="product-detail-category">{product.category_name}</p>
            )}
            
            <h1 className="product-detail-name">{product.name}</h1>
            
            <p className="product-detail-price">{formatPrice(product.price)}</p>
            {product.department_price && (
              <p className="product-detail-dept-price">
                백화점가: {formatPrice(product.department_price)}
              </p>
            )}

            <div className="product-meta">
              <div className="meta-row">
                <span>적립</span>
                <span>2,550 적립금 지급(예시)</span>
              </div>
              <div className="meta-row">
                <span>배송비</span>
                <span>무료 (5만원 이상 무료배송)</span>
              </div>
            </div>

            <div className="product-detail-stock">
              재고: {product.stock > 0 ? `${product.stock}개` : "품절"}
            </div>

            {product.stock > 0 && (
              <>
                <div className="quantity-selector">
                  <label>수량</label>
                  <div className="quantity-controls">
                    <button onClick={() => handleQuantityChange(-1)}>-</button>
                    <span>{quantity}</span>
                    <button onClick={() => handleQuantityChange(1)}>+</button>
                  </div>
                </div>

                <div className="detail-actions">
                  <button 
                    className="btn btn-primary btn-full"
                    onClick={handleAddToCart}
                  >
                    장바구니에 담기
                  </button>
                  <button 
                    className="btn btn-outline"
                    onClick={() => navigate("/products")}
                  >
                    계속 쇼핑하기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {detailImages.length > 0 && (
          <section className="detail-images-section">
            <h3>상세정보</h3>
            <div className="detail-images-grid">
              {detailImages.map((img, idx) => (
                <img key={idx} src={img} alt={`detail-${idx}`} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;

