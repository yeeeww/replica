import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, deleteProduct } from '../../services/api';
import { formatPrice } from '../../utils/format';

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await getProducts({ limit: 1000 });
      setProducts(response.data.products);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
      alert('상품이 삭제되었습니다.');
    } catch (error) {
      alert(error.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="loading">상품을 불러오는 중...</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>상품 관리</h1>
        <Link to="/admin/products/new" className="btn btn-primary">
          상품 추가
        </Link>
      </div>

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
          등록된 상품이 없습니다.
        </div>
      )}
    </div>
  );
};

export default AdminProducts;

