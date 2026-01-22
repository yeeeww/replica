import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const MAIN_CATEGORIES = [
  { slug: 'men', name: '남성' },
  { slug: 'women', name: '여성' },
  { slug: 'domestic', name: '국내출고상품' },
];

const AdminWeeklyBest = () => {
  const [activeCategory, setActiveCategory] = useState('men');
  const [weeklyBestProducts, setWeeklyBestProducts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const fetchWeeklyBest = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/admin/weekly-best/${activeCategory}`);
      setWeeklyBestProducts(response.data.products || []);
    } catch (error) {
      console.error('Failed to fetch weekly best products:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchWeeklyBest();
    setSearchResults([]);
    setSearchQuery('');
  }, [fetchWeeklyBest]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await axios.get('/admin/featured-search', {
        params: { search: searchQuery, limit: 20 }
      });
      setSearchResults(response.data.products || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddProduct = async (productId) => {
    try {
      await axios.post(`/admin/weekly-best/${activeCategory}/${productId}`);
      fetchWeeklyBest();
      // 검색 결과에서 제거
      setSearchResults(prev => prev.filter(p => p.id !== productId));
    } catch (error) {
      alert(error.response?.data?.message || '상품 추가에 실패했습니다.');
    }
  };

  const handleRemoveProduct = async (productId) => {
    if (!window.confirm('이 상품을 Weekly Best에서 제거하시겠습니까?')) return;
    try {
      await axios.delete(`/admin/weekly-best/${activeCategory}/${productId}`);
      fetchWeeklyBest();
    } catch (error) {
      alert(error.response?.data?.message || '상품 제거에 실패했습니다.');
    }
  };

  const isAlreadyAdded = (productId) => {
    return weeklyBestProducts.some(p => p.product_id === productId);
  };

  const getCategoryName = () => {
    const cat = MAIN_CATEGORIES.find(c => c.slug === activeCategory);
    return cat ? cat.name : activeCategory;
  };

  return (
    <div className="admin-featured">
      <h2>Weekly Best 상품 관리</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        대분류별 Weekly Best 상품을 수동으로 선택합니다. 상품 목록 페이지에 표시됩니다.
      </p>

      {/* 대분류 탭 */}
      <div className="featured-tabs" style={{ marginBottom: '30px' }}>
        {MAIN_CATEGORIES.map(cat => (
          <button
            key={cat.slug}
            className={`tab-btn ${activeCategory === cat.slug ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.slug)}
            style={{
              padding: '10px 20px',
              marginRight: '10px',
              border: activeCategory === cat.slug ? '2px solid #333' : '1px solid #ddd',
              background: activeCategory === cat.slug ? '#333' : '#fff',
              color: activeCategory === cat.slug ? '#fff' : '#333',
              cursor: 'pointer',
              borderRadius: '4px',
              fontWeight: activeCategory === cat.slug ? 'bold' : 'normal'
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 상품 검색 */}
      <div className="search-section" style={{ 
        marginBottom: '30px', 
        padding: '20px', 
        background: '#f9f9f9', 
        borderRadius: '8px' 
      }}>
        <h3 style={{ marginBottom: '15px' }}>상품 검색하여 추가</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="상품명 또는 카테고리로 검색..."
            style={{ 
              flex: 1, 
              padding: '10px', 
              border: '1px solid #ddd', 
              borderRadius: '4px' 
            }}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            style={{
              padding: '10px 20px',
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {searching ? '검색중...' : '검색'}
          </button>
        </div>

        {/* 검색 결과 */}
        {searchResults.length > 0 && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#eee' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>이미지</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>상품명</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>카테고리</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>가격</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>추가</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map(product => (
                  <tr key={product.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>
                      <img 
                        src={product.image_url || 'https://via.placeholder.com/50'} 
                        alt={product.name}
                        style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                      />
                    </td>
                    <td style={{ padding: '10px' }}>{product.name}</td>
                    <td style={{ padding: '10px' }}>{product.category_name || '-'}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      {Number(product.price).toLocaleString()}원
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {isAlreadyAdded(product.id) ? (
                        <span style={{ color: '#999' }}>추가됨</span>
                      ) : (
                        <button
                          onClick={() => handleAddProduct(product.id)}
                          style={{
                            padding: '5px 15px',
                            background: '#4CAF50',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          추가
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 현재 Weekly Best 목록 */}
      <div className="current-list">
        <h3 style={{ marginBottom: '15px' }}>
          {getCategoryName()} Weekly Best 상품 ({weeklyBestProducts.length}개)
        </h3>
        
        {loading ? (
          <div>로딩 중...</div>
        ) : weeklyBestProducts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999', background: '#f9f9f9', borderRadius: '8px' }}>
            등록된 상품이 없습니다. 위에서 상품을 검색하여 추가해주세요.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#333', color: '#fff' }}>
                <th style={{ padding: '12px', textAlign: 'center', width: '60px' }}>순서</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>이미지</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>상품명</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>카테고리</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>가격</th>
                <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {weeklyBestProducts.map((item, index) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ padding: '12px' }}>
                    <img 
                      src={item.image_url || 'https://via.placeholder.com/60'} 
                      alt={item.name}
                      style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>{item.name}</td>
                  <td style={{ padding: '12px' }}>{item.category_name || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {Number(item.price).toLocaleString()}원
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleRemoveProduct(item.product_id)}
                      style={{
                        padding: '5px 15px',
                        background: '#f44336',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      제거
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminWeeklyBest;
