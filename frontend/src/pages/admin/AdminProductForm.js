import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProduct, createProduct, updateProduct, getCategories } from '../../services/api';

const AdminProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    image_url: '',
    stock: '',
    department_price: '',
    is_active: true
  });
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCategories = async () => {
    try {
      const response = await getCategories();
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProduct = useCallback(async () => {
    try {
      const response = await getProduct(id);
      const product = response.data.product;
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        category_id: product.category_id || '',
        image_url: product.image_url || '',
        stock: product.stock,
        department_price: product.department_price || '',
        is_active: product.is_active
      });
      
      // 옵션 데이터 변환
      if (product.options) {
        const optionList = [];
        Object.entries(product.options).forEach(([name, values]) => {
          values.forEach(opt => {
            optionList.push({
              id: opt.id,
              option_name: name,
              option_value: opt.value,
              price_adjustment: opt.price_adjustment || 0,
              stock: opt.stock || 0
            });
          });
        });
        setOptions(optionList);
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
      setError('상품을 불러올 수 없습니다.');
    }
  }, [id]);

  useEffect(() => {
    fetchCategories();
    if (isEdit) {
      fetchProduct();
    }
  }, [id, isEdit, fetchProduct]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  // 옵션 관련 핸들러
  const handleOptionChange = (index, field, value) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, {
      id: null,
      option_name: '',
      option_value: '',
      price_adjustment: 0,
      stock: 10
    }]);
  };

  const removeOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        department_price: formData.department_price ? parseFloat(formData.department_price) : null,
        options: options.filter(opt => opt.option_name && opt.option_value).map(opt => ({
          id: opt.id,
          option_name: opt.option_name,
          option_value: opt.option_value,
          price_adjustment: parseFloat(opt.price_adjustment) || 0,
          stock: parseInt(opt.stock) || 0
        }))
      };

      if (isEdit) {
        await updateProduct(id, data);
        alert('상품이 수정되었습니다.');
      } else {
        await createProduct(data);
        alert('상품이 등록되었습니다.');
      }
      
      navigate('/admin/products');
    } catch (error) {
      setError(error.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>{isEdit ? '상품 수정' : '상품 추가'}</h1>
      </div>

      {error && <div className="error">{error}</div>}

      <div style={{ backgroundColor: 'white', padding: '32px', border: '1px solid var(--border-color)' }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
          <div className="form-group">
            <label htmlFor="name">상품명 *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">상품 설명</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
            />
          </div>

          <div className="form-group">
            <label htmlFor="price">가격 *</label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="department_price">백화점가 (선택)</label>
            <input
              type="number"
              id="department_price"
              name="department_price"
              value={formData.department_price}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="입력 시 쇼핑몰에 노출됩니다."
            />
          </div>

          <div className="form-group">
            <label htmlFor="category_id">카테고리</label>
            <select
              id="category_id"
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
            >
              <option value="">선택 안함</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="image_url">이미지 URL</label>
            <input
              type="url"
              id="image_url"
              name="image_url"
              value={formData.image_url}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="form-group">
            <label htmlFor="stock">재고 *</label>
            <input
              type="number"
              id="stock"
              name="stock"
              value={formData.stock}
              onChange={handleChange}
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
              />
              활성 상태
            </label>
          </div>

          {/* 옵션 관리 섹션 */}
          <div className="form-group" style={{ marginTop: '32px', borderTop: '1px solid #e0e0e0', paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label style={{ fontSize: '16px', fontWeight: '600' }}>상품 옵션</label>
              <button
                type="button"
                onClick={addOption}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                + 옵션 추가
              </button>
            </div>

            {options.length === 0 ? (
              <p style={{ color: '#888', fontSize: '14px' }}>등록된 옵션이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {options.map((opt, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.5fr 100px 80px 40px',
                      gap: '8px',
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: '#f9f9f9',
                      borderRadius: '4px'
                    }}
                  >
                    <input
                      type="text"
                      placeholder="옵션명 (예: 컬러)"
                      value={opt.option_name}
                      onChange={(e) => handleOptionChange(index, 'option_name', e.target.value)}
                      style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <input
                      type="text"
                      placeholder="옵션값 (예: 블랙)"
                      value={opt.option_value}
                      onChange={(e) => handleOptionChange(index, 'option_value', e.target.value)}
                      style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <input
                      type="number"
                      placeholder="추가금액"
                      value={opt.price_adjustment}
                      onChange={(e) => handleOptionChange(index, 'price_adjustment', e.target.value)}
                      style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <input
                      type="number"
                      placeholder="재고"
                      value={opt.stock}
                      onChange={(e) => handleOptionChange(index, 'stock', e.target.value)}
                      style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      style={{
                        padding: '8px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? '저장 중...' : '저장'}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('/admin/products')}
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminProductForm;

