import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, deleteProduct } from '../../services/api';
import { formatPrice } from '../../utils/format';

const ITEMS_PER_PAGE = 20;

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProducts();
  }, [page]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await getProducts({ 
        limit: ITEMS_PER_PAGE, 
        page,
        search: searchQuery || undefined
      });
      setProducts(response.data.products);
      setPagination(response.data.pagination || {});
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPage(newPage);
    window.scrollTo(0, 0);
  };

  // 페이지네이션 렌더링
  const renderPagination = () => {
    if (!pagination.totalPages || pagination.totalPages <= 1) return null;
    
    const totalPages = pagination.totalPages;
    const current = page;
    const delta = 2;
    const pages = [];
    
    let start = Math.max(2, current - delta);
    let end = Math.min(totalPages - 1, current + delta);
    
    pages.push(1);
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) {
      if (i !== 1 && i !== totalPages) pages.push(i);
    }
    if (end < totalPages - 1) pages.push('...');
    if (totalPages > 1) pages.push(totalPages);
    
    return (
      <div className="admin-pagination">
        <button 
          onClick={() => handlePageChange(page - 1)} 
          disabled={page === 1}
          className="admin-pagination-btn"
        >
          이전
        </button>
        <div className="admin-pagination-numbers">
          {pages.map((num, idx) => 
            num === '...' ? (
              <span key={`dots-${idx}`} className="admin-pagination-dots">...</span>
            ) : (
              <button
                key={num}
                className={`admin-pagination-number ${num === current ? 'active' : ''}`}
                onClick={() => handlePageChange(num)}
              >
                {num}
              </button>
            )
          )}
        </div>
        <button 
          onClick={() => handlePageChange(page + 1)} 
          disabled={page === pagination.totalPages}
          className="admin-pagination-btn"
        >
          다음
        </button>
      </div>
    );
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await deleteProduct(id);
      // 삭제 후 현재 페이지 다시 로드
      fetchProducts();
      alert('상품이 삭제되었습니다.');
    } catch (error) {
      alert(error.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>상품 관리</h1>
        <Link to="/admin/products/new" className="btn btn-primary">
          상품 추가
        </Link>
      </div>

      {/* 검색 & 정보 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="상품명 검색..."
            style={{ 
              padding: '8px 12px', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              width: '250px'
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
            검색
          </button>
          {searchQuery && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ padding: '8px 16px' }}
              onClick={() => {
                setSearchQuery('');
                setPage(1);
                setTimeout(fetchProducts, 0);
              }}
            >
              초기화
            </button>
          )}
        </form>
        <div style={{ color: '#666', fontSize: '14px' }}>
          총 <strong>{pagination.total || 0}</strong>개 상품
          {pagination.totalPages > 1 && ` (${page}/${pagination.totalPages} 페이지)`}
        </div>
      </div>

      {loading ? (
        <div className="loading">상품을 불러오는 중...</div>
      ) : (
        <>
      <table className="admin-table">
        <thead>
          <tr>
            <th>이미지</th>
            <th>상품명</th>
            <th>카테고리</th>
            <th>가격</th>
            <th>재고</th>
            <th>상태</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                <img src={product.image_url} alt={product.name} />
              </td>
              <td>{product.name}</td>
              <td>{product.category_name || '-'}</td>
              <td>{formatPrice(product.price)}</td>
              <td>{product.stock}</td>
              <td>{product.is_active ? '활성' : '비활성'}</td>
              <td>
                <div className="admin-actions">
                  <Link 
                    to={`/admin/products/${product.id}/edit`}
                    className="admin-btn admin-btn-edit"
                  >
                    수정
                  </Link>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="admin-btn admin-btn-delete"
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {products.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary-color)' }}>
          {searchQuery ? '검색 결과가 없습니다.' : '등록된 상품이 없습니다.'}
        </div>
      )}

      {renderPagination()}
        </>
      )}
    </div>
  );
};

export default AdminProducts;

