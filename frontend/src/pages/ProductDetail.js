import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProduct, getProductReviews, createReview, getImageUrl } from "../services/api";
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
  const [selectedOptions, setSelectedOptions] = useState({});
  const [activeTab, setActiveTab] = useState("detail");  // "detail" | "reviews"
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);  // 상세정보 펼침 상태
  
  // 리뷰 관련 상태
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ total: 0, avgRating: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

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

  // 리뷰 목록 로드
  const fetchReviews = useCallback(async () => {
    try {
      setReviewsLoading(true);
      const response = await getProductReviews(id);
      setReviews(response.data.reviews || []);
      setReviewStats({
        total: response.data.pagination?.total || 0,
        avgRating: response.data.avgRating || 0
      });
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setReviewsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    window.scrollTo(0, 0);  // 페이지 맨 위로 스크롤
    fetchProduct();
    fetchReviews();  // 초기 로드 시 리뷰 개수도 함께 로드
  }, [fetchProduct, fetchReviews]);

  // 리뷰 작성 핸들러
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (reviewForm.content.trim().length < 10) {
      setMessage({ type: "error", text: "리뷰 내용은 10자 이상이어야 합니다." });
      return;
    }

    try {
      setReviewSubmitting(true);
      await createReview(id, {
        rating: reviewForm.rating,
        content: reviewForm.content
      });
      
      setMessage({ type: "success", text: "리뷰가 등록되었습니다." });
      setReviewForm({ rating: 5, content: "" });
      setShowReviewForm(false);
      fetchReviews();  // 리뷰 목록 새로고침
      
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      setMessage({ 
        type: "error", 
        text: error.response?.data?.message || "리뷰 등록에 실패했습니다." 
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  // 옵션 유효성 검사
  const validateOptions = () => {
    const optionNames = Object.keys(product.options || {});
    if (optionNames.length > 0) {
      const unselected = optionNames.filter(name => !selectedOptions[name]);
      if (unselected.length > 0) {
        setMessage({ type: "error", text: `${unselected.join(', ')} 옵션을 선택해주세요.` });
        return false;
      }
    }
    return true;
  };

  const handleAddToCart = async () => {
    if (!validateOptions()) return;

    try {
      const optionsString = Object.entries(selectedOptions)
        .map(([name, value]) => `${name}: ${value}`)
        .join(', ');
      await addToCart(product.id, quantity, optionsString);
      setMessage({ type: "success", text: "장바구니에 추가되었습니다." });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      setMessage({ 
        type: "error", 
        text: error.response?.data?.message || "장바구니 추가에 실패했습니다." 
      });
    }
  };

  // 바로 구매하기 (비회원도 가능)
  const handleBuyNow = () => {
    if (!validateOptions()) return;

    const optionsString = Object.entries(selectedOptions)
      .map(([name, value]) => `${name}: ${value}`)
      .join(', ');

    // 구매할 상품 정보를 state로 전달
    const buyItem = {
      product_id: product.id,
      product_name: product.name,
      product_price: calculateTotalPrice(),
      image_url: product.image_url,
      quantity: quantity,
      options: optionsString
    };

    navigate('/checkout', { 
      state: { 
        buyNow: true,
        item: buyItem,
        isGuest: !isAuthenticated
      } 
    });
  };

  const handleOptionChange = (optionName, value) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionName]: value
    }));
  };

  // 선택한 옵션의 추가 금액 계산
  const calculateTotalPrice = () => {
    let total = parseFloat(product?.price || 0);
    if (product?.options) {
      Object.entries(selectedOptions).forEach(([optionName, selectedValue]) => {
        const optionList = product.options[optionName];
        const selected = optionList?.find(opt => opt.value === selectedValue);
        if (selected?.price_adjustment) {
          total += selected.price_adjustment;
        }
      });
    }
    return total;
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
    // 첫 번째 이미지 제외 (대표 이미지와 동일할 수 있음)
    return imgs.slice(1);
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
              <img src={getImageUrl(product.image_url)} alt={product.name} />
            </div>
          </div>

          <div className="product-detail-info">
            {product.category_full_path && (
              <p className="product-detail-category">{product.category_full_path}</p>
            )}
            
            <h1 className="product-detail-name">{product.name}</h1>
            
            <div className="product-detail-prices">
              {product.department_price && (
                <p className="product-detail-dept-price">
                  <span className="price-label">백화점가</span>
                  <span className="price-value">{formatPrice(product.department_price)}</span>
                </p>
              )}
              <p className="product-detail-price">
                <span className="price-label">판매가</span>
                <span className="price-value">{formatPrice(calculateTotalPrice())}</span>
              </p>
            </div>

            {/* 옵션 선택 */}
            {product.options && Object.keys(product.options).length > 0 && (
              <div className="product-options">
                {Object.entries(product.options).map(([optionName, optionValues]) => (
                  <div className="option-group" key={optionName}>
                    <label className="option-label">{optionName}</label>
                    <select
                      className="option-select"
                      value={selectedOptions[optionName] || ''}
                      onChange={(e) => handleOptionChange(optionName, e.target.value)}
                    >
                      <option value="">-- 선택하세요 --</option>
                      {optionValues.map((opt) => (
                        <option key={opt.id} value={opt.value}>
                          {opt.value}
                          {opt.price_adjustment > 0 && ` (+${formatPrice(opt.price_adjustment)})`}
                          {opt.price_adjustment < 0 && ` (${formatPrice(opt.price_adjustment)})`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {product.stock > 0 ? (
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
                  <div className="detail-actions-row">
                    <button 
                      className="btn btn-outline btn-half"
                      onClick={handleAddToCart}
                    >
                      장바구니
                    </button>
                    <button 
                      className="btn btn-primary btn-half"
                      onClick={handleBuyNow}
                    >
                      구매하기
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="product-detail-soldout">
                <p>현재 품절된 상품입니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="product-tabs">
          <button 
            className={`product-tab ${activeTab === "detail" ? "active" : ""}`}
            onClick={() => setActiveTab("detail")}
          >
            상세정보
          </button>
          <button 
            className={`product-tab ${activeTab === "reviews" ? "active" : ""}`}
            onClick={() => setActiveTab("reviews")}
          >
            구매평 ({reviewStats.total})
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="product-tab-content">
          {activeTab === "detail" && (
            <section className="detail-images-section">
              {detailImages.length > 0 ? (
                <>
                  <div className={`detail-images-wrapper ${isDetailExpanded ? "expanded" : "collapsed"}`}>
                    <div className="detail-images-grid">
                      {detailImages.map((img, idx) => (
                        <img key={idx} src={img} alt={`detail-${idx}`} />
                      ))}
                    </div>
                    {!isDetailExpanded && <div className="detail-fade-overlay" />}
                  </div>
                  <button 
                    className="detail-expand-btn"
                    onClick={() => setIsDetailExpanded(!isDetailExpanded)}
                  >
                    {isDetailExpanded ? "상세정보 접기" : "상세정보 펼쳐보기"}
                  </button>
                </>
              ) : (
                <div className="no-detail-images">
                  <p>상세 이미지가 없습니다.</p>
                </div>
              )}
            </section>
          )}

          {activeTab === "reviews" && (
            <section className="reviews-section">
              <div className="reviews-header">
                <div className="reviews-header-left">
                  <h3>구매평</h3>
                  <p className="reviews-count">총 {reviewStats.total}개의 구매평</p>
                  {reviewStats.avgRating > 0 && (
                    <div className="reviews-avg-rating">
                      <span className="avg-stars">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={`star ${star <= Math.round(reviewStats.avgRating) ? "filled" : ""}`}>★</span>
                        ))}
                      </span>
                      <span className="avg-value">{reviewStats.avgRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <button 
                  className="write-review-btn"
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate('/login');
                      return;
                    }
                    setShowReviewForm(!showReviewForm);
                  }}
                >
                  {showReviewForm ? "취소" : "구매평 작성"}
                </button>
              </div>

              {/* 리뷰 작성 폼 */}
              {showReviewForm && (
                <form className="review-form" onSubmit={handleReviewSubmit}>
                  <div className="form-group">
                    <label>별점</label>
                    <div className="rating-selector">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`rating-star ${star <= reviewForm.rating ? "selected" : ""}`}
                          onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                        >
                          ★
                        </button>
                      ))}
                      <span className="rating-text">{reviewForm.rating}점</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>리뷰 내용</label>
                    <textarea
                      className="review-textarea"
                      placeholder="상품에 대한 솔직한 리뷰를 작성해주세요. (최소 10자)"
                      value={reviewForm.content}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
                      rows={5}
                    />
                    <span className="char-count">{reviewForm.content.length}자</span>
                  </div>
                  <button 
                    type="submit" 
                    className="submit-review-btn"
                    disabled={reviewSubmitting || reviewForm.content.length < 10}
                  >
                    {reviewSubmitting ? "등록 중..." : "리뷰 등록"}
                  </button>
                </form>
              )}
              
              {/* 구매평 목록 */}
              <div className="reviews-list">
                {reviewsLoading ? (
                  <div className="reviews-loading">리뷰를 불러오는 중...</div>
                ) : reviews.length === 0 ? (
                  <div className="no-reviews">
                    <p>아직 작성된 구매평이 없습니다.</p>
                    <p className="sub-text">이 상품의 첫 번째 구매평을 작성해주세요!</p>
                  </div>
                ) : (
                  reviews.map((review, idx) => (
                    <div className="review-item" key={review.id || idx}>
                      <div className="review-header">
                        <div className="review-rating">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span 
                              key={star} 
                              className={`star ${star <= (review.rating || 5) ? "filled" : ""}`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="review-author">{review.author || "익명"}</span>
                        <span className="review-date">
                          {review.created_at ? new Date(review.created_at).toLocaleDateString('ko-KR') : ""}
                        </span>
                      </div>
                      <p className="review-content">{review.content}</p>
                      {review.images && review.images.length > 0 && (
                        <div className="review-images">
                          {review.images.map((img, imgIdx) => (
                            <img key={imgIdx} src={img} alt={`review-${imgIdx}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;

