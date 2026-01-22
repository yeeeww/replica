import React, { useState, useEffect } from 'react';
import { getFeaturedProducts, searchProductsForFeatured, addFeaturedProduct, removeFeaturedProduct, updateFeaturedOrder } from '../../services/api';
import { formatPrice } from '../../utils/format';

const FEATURED_TYPES = [
  { key: 'recommended', label: '추천상품', color: '#007bff' },
  { key: 'hot', label: '히트상품', color: '#dc3545' },
  { key: 'popular', label: '인기상품', color: '#28a745' }
];

const AdminFeatured = () => {
  const [activeTab, setActiveTab] = useState('recommended');
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchFeaturedProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchFeaturedProducts = async () => {
    setLoading(true);
    try {
      const response = await getFeaturedProducts(activeTab);
      setFeaturedProducts(response.data.products || []);
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await searchProductsForFeatured({ search: searchText, limit: 30 });
      setSearchResults(response.data.products || []);
    } catch (error) {
      console.error('Failed to search products:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (productId) => {
    try {
      await addFeaturedProduct(activeTab, productId);
      fetchFeaturedProducts();
      // 검색 결과 업데이트
      setSearchResults(prev => prev.map(p => 
        p.id === productId ? { ...p, [`is_${activeTab}`]: true } : p
      ));
    } catch (error) {
      alert(error.response?.data?.message || '추가에 실패했습니다.');
    }
  };

  const handleRemove = async (productId) => {
    if (!window.confirm('이 상품을 목록에서 제거하시겠습니까?')) return;
    
    try {
      await removeFeaturedProduct(activeTab, productId);
      setFeaturedProducts(prev => prev.filter(p => p.id !== productId));
      // 검색 결과 업데이트
      setSearchResults(prev => prev.map(p => 
        p.id === productId ? { ...p, [`is_${activeTab}`]: false } : p
      ));
    } catch (error) {
      alert(error.response?.data?.message || '제거에 실패했습니다.');
    }
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const newProducts = [...featuredProducts];
    [newProducts[index - 1], newProducts[index]] = [newProducts[index], newProducts[index - 1]];
    setFeaturedProducts(newProducts);
    
    try {
      await updateFeaturedOrder(activeTab, newProducts.map(p => p.id));
    } catch (error) {
      console.error('Failed to update order:', error);
      fetchFeaturedProducts();
    }
  };

  const handleMoveDown = async (index) => {
    if (index === featuredProducts.length - 1) return;
    const newProducts = [...featuredProducts];
    [newProducts[index], newProducts[index + 1]] = [newProducts[index + 1], newProducts[index]];
    setFeaturedProducts(newProducts);
    
    try {
      await updateFeaturedOrder(activeTab, newProducts.map(p => p.id));
    } catch (error) {
      console.error('Failed to update order:', error);
      fetchFeaturedProducts();
    }
  };

  const currentType = FEATURED_TYPES.find(t => t.key === activeTab);
  const isProductFeatured = (product) => product[`is_${activeTab}`];

  return (
    <div>
      <div className="admin-page-header">
        <h1>추천/히트/인기 상품 관리</h1>
      </div>

      {/* 탭 메뉴 */}
      <div style={{ 
        display: 'flex', 
        gap: '0', 
        marginBottom: '24px',
        borderBottom: '2px solid #e9ecef'
      }}>
        {FEATURED_TYPES.map(type => (
          <button
            key={type.key}
            onClick={() => setActiveTab(type.key)}
            style={{
              padding: '12px 24px',
              border: 'none',
              backgroundColor: activeTab === type.key ? type.color : 'transparent',
              color: activeTab === type.key ? 'white' : '#666',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: activeTab === type.key ? '600' : '400',
              borderRadius: '8px 8px 0 0',
              transition: 'all 0.2s'
            }}
          >
            {type.label}
            {activeTab === type.key && ` (${featuredProducts.length})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* 왼쪽: 현재 등록된 상품 */}
        <div style={{ 
          backgroundColor: 'white', 
          border: '1px solid #e9ecef', 
          borderRadius: '8px',
          padding: '20px'
        }}>
          <h3 style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            marginBottom: '16px',
            color: currentType.color,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              backgroundColor: currentType.color, 
              borderRadius: '50%' 
            }} />
            {currentType.label} 목록
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              로딩 중...
            </div>
          ) : featuredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              등록된 상품이 없습니다.<br />
              오른쪽에서 상품을 검색하여 추가해주세요.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {featuredProducts.map((product, index) => (
                <div 
                  key={product.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e9ecef'
                  }}
                >
                  {/* 순서 */}
                  <span style={{ 
                    width: '24px', 
                    height: '24px', 
                    backgroundColor: currentType.color,
                    color: 'white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '600',
                    flexShrink: 0
                  }}>
                    {index + 1}
                  </span>

                  {/* 이미지 */}
                  <img
                    src={product.image_url || 'https://via.placeholder.com/50'}
                    alt={product.name}
                    style={{ 
                      width: '50px', 
                      height: '50px', 
                      objectFit: 'cover', 
                      borderRadius: '4px',
                      flexShrink: 0
                    }}
                  />

                  {/* 상품 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: '500', 
                      fontSize: '14px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {product.name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {formatPrice(product.price)}
                    </div>
                  </div>

                  {/* 순서 변경 버튼 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid #ddd',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        opacity: index === 0 ? 0.5 : 1,
                        fontSize: '10px'
                      }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === featuredProducts.length - 1}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid #ddd',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        cursor: index === featuredProducts.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === featuredProducts.length - 1 ? 0.5 : 1,
                        fontSize: '10px'
                      }}
                    >
                      ▼
                    </button>
                  </div>

                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => handleRemove(product.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      flexShrink: 0
                    }}
                  >
                    제거
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 오른쪽: 상품 검색 */}
        <div style={{ 
          backgroundColor: 'white', 
          border: '1px solid #e9ecef', 
          borderRadius: '8px',
          padding: '20px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            상품 검색
          </h3>

          <form onSubmit={handleSearch} style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="상품명 또는 카테고리 검색"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <button
                type="submit"
                disabled={searching}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {searching ? '검색중...' : '검색'}
              </button>
            </div>
          </form>

          {/* 검색 결과 */}
          <div style={{ 
            maxHeight: '500px', 
            overflowY: 'auto',
            border: '1px solid #e9ecef',
            borderRadius: '4px'
          }}>
            {searchResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                {searchText ? '검색 결과가 없습니다.' : '상품명을 검색해주세요.'}
              </div>
            ) : (
              searchResults.map(product => {
                const isFeatured = isProductFeatured(product);
                return (
                  <div 
                    key={product.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderBottom: '1px solid #e9ecef',
                      backgroundColor: isFeatured ? '#e8f5e9' : 'white'
                    }}
                  >
                    <img
                      src={product.image_url || 'https://via.placeholder.com/40'}
                      alt={product.name}
                      style={{ 
                        width: '40px', 
                        height: '40px', 
                        objectFit: 'cover', 
                        borderRadius: '4px',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontWeight: '500', 
                        fontSize: '13px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {product.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {formatPrice(product.price)}
                        {product.category_name && ` · ${product.category_name}`}
                      </div>
                    </div>
                    {isFeatured ? (
                      <span style={{
                        padding: '4px 12px',
                        backgroundColor: currentType.color,
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '12px',
                        flexShrink: 0
                      }}>
                        등록됨
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(product.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: currentType.color,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          flexShrink: 0
                        }}
                      >
                        추가
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 안내 문구 */}
      <div style={{ 
        marginTop: '24px', 
        padding: '16px', 
        backgroundColor: '#fff3cd', 
        borderRadius: '8px',
        fontSize: '14px',
        color: '#856404'
      }}>
        <strong>💡 사용 안내</strong>
        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
          <li>오른쪽에서 상품을 검색하여 추가 버튼을 클릭하면 해당 카테고리에 등록됩니다.</li>
          <li>왼쪽 목록에서 ▲▼ 버튼으로 노출 순서를 조정할 수 있습니다.</li>
          <li>등록된 상품은 사용자 화면의 해당 카테고리 페이지에 우선 노출됩니다.</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminFeatured;
