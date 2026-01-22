import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProduct, createProduct, updateProduct, getCategories, uploadImage, uploadImages } from '../../services/api';

const AdminProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [allCategories, setAllCategories] = useState([]);  // 전체 카테고리 (flat)
  const [selectedDepth1, setSelectedDepth1] = useState('');  // 대분류 slug
  const [selectedDepth2, setSelectedDepth2] = useState('');  // 중분류 slug
  const [selectedDepth3, setSelectedDepth3] = useState('');  // 소분류 slug
  
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
  const [uploading, setUploading] = useState(false);
  const [descriptionImages, setDescriptionImages] = useState([]);  // 상품 설명 이미지들
  const mainImageRef = useRef(null);
  const descImageRef = useRef(null);

  // 대분류 목록 (depth = 1)
  const depth1Categories = useMemo(() => {
    return allCategories.filter(c => c.depth === 1);
  }, [allCategories]);

  // 중분류 목록 (depth = 2, 선택된 대분류의 하위)
  const depth2Categories = useMemo(() => {
    if (!selectedDepth1) return [];
    return allCategories.filter(c => c.depth === 2 && c.parent_slug === selectedDepth1);
  }, [allCategories, selectedDepth1]);

  // 소분류 목록 (depth = 3, 선택된 중분류의 하위)
  const depth3Categories = useMemo(() => {
    if (!selectedDepth2) return [];
    return allCategories.filter(c => c.depth === 3 && c.parent_slug === selectedDepth2);
  }, [allCategories, selectedDepth2]);

  const fetchCategories = async () => {
    try {
      const response = await getCategories();
      setAllCategories(response.data.categories || []);
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

      // 카테고리 계층 복원
      if (product.category_slug) {
        const parts = product.category_slug.split('-');
        if (parts.length >= 1) {
          setSelectedDepth1(parts[0]);
        }
        if (parts.length >= 2) {
          setSelectedDepth2(`${parts[0]}-${parts[1]}`);
        }
        if (parts.length >= 3) {
          setSelectedDepth3(product.category_slug);
        }
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

  // 대분류 선택 핸들러
  const handleDepth1Change = (e) => {
    const slug = e.target.value;
    setSelectedDepth1(slug);
    setSelectedDepth2('');
    setSelectedDepth3('');
    
    // 대분류만 선택된 경우 해당 카테고리 ID 설정
    if (slug) {
      const cat = allCategories.find(c => c.slug === slug);
      setFormData(prev => ({ ...prev, category_id: cat?.id || '' }));
    } else {
      setFormData(prev => ({ ...prev, category_id: '' }));
    }
  };

  // 중분류 선택 핸들러
  const handleDepth2Change = (e) => {
    const slug = e.target.value;
    setSelectedDepth2(slug);
    setSelectedDepth3('');
    
    // 중분류 선택된 경우 해당 카테고리 ID 설정
    if (slug) {
      const cat = allCategories.find(c => c.slug === slug);
      setFormData(prev => ({ ...prev, category_id: cat?.id || '' }));
    } else if (selectedDepth1) {
      const cat = allCategories.find(c => c.slug === selectedDepth1);
      setFormData(prev => ({ ...prev, category_id: cat?.id || '' }));
    }
  };

  // 소분류 선택 핸들러
  const handleDepth3Change = (e) => {
    const slug = e.target.value;
    setSelectedDepth3(slug);
    
    // 소분류 선택된 경우 해당 카테고리 ID 설정
    if (slug) {
      const cat = allCategories.find(c => c.slug === slug);
      setFormData(prev => ({ ...prev, category_id: cat?.id || '' }));
    } else if (selectedDepth2) {
      const cat = allCategories.find(c => c.slug === selectedDepth2);
      setFormData(prev => ({ ...prev, category_id: cat?.id || '' }));
    }
  };

  // 카테고리 이름 매핑 (영문 -> 한글)
  const categoryNameMap = {
    men: '남성', women: '여성', domestic: '국내출고상품',
    recommend: '추천상품', hot: '히트상품', popular: '인기상품',
    bag: '가방', wallet: '지갑', watch: '시계', shoes: '신발',
    belt: '벨트', accessory: '악세서리', hat: '모자',
    clothing: '의류', glasses: '선글라스/안경', etc: '기타'
  };

  const getCategoryDisplayName = (cat) => {
    return categoryNameMap[cat.name] || cat.name;
  };

  // 대표 이미지 업로드 핸들러
  const handleMainImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const response = await uploadImage(file);
      const imageUrl = response.data.url;
      setFormData(prev => ({ ...prev, image_url: imageUrl }));
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // 상품 설명 이미지 업로드 핸들러
  const handleDescriptionImagesUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const response = await uploadImages(files);
      const newImages = response.data.files.map(f => f.url);
      setDescriptionImages(prev => [...prev, ...newImages]);
      
      // description에 이미지 URL 추가
      const imageUrls = newImages.join('\n');
      setFormData(prev => ({
        ...prev,
        description: prev.description ? `${prev.description}\n${imageUrls}` : imageUrls
      }));
    } catch (error) {
      console.error('Images upload failed:', error);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // 설명 이미지 삭제
  const removeDescriptionImage = (index) => {
    const imageToRemove = descriptionImages[index];
    setDescriptionImages(prev => prev.filter((_, i) => i !== index));
    
    // description에서도 해당 URL 제거
    setFormData(prev => ({
      ...prev,
      description: prev.description.replace(imageToRemove, '').replace(/\n\n+/g, '\n').trim()
    }));
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

          {/* 카테고리 3단계 선택 */}
          <div className="form-group">
            <label>카테고리 선택</label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {/* 대분류 */}
              <div style={{ flex: '1', minWidth: '150px' }}>
                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                  대분류
                </label>
                <select
                  value={selectedDepth1}
                  onChange={handleDepth1Change}
                  style={{ width: '100%' }}
                >
                  <option value="">선택</option>
                  {depth1Categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {getCategoryDisplayName(cat)}
                    </option>
                  ))}
                </select>
              </div>

              {/* 중분류 */}
              <div style={{ flex: '1', minWidth: '150px' }}>
                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                  중분류
                </label>
                <select
                  value={selectedDepth2}
                  onChange={handleDepth2Change}
                  disabled={!selectedDepth1}
                  style={{ width: '100%' }}
                >
                  <option value="">선택</option>
                  {depth2Categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {getCategoryDisplayName(cat)}
                    </option>
                  ))}
                </select>
              </div>

              {/* 소분류 (브랜드) */}
              <div style={{ flex: '1', minWidth: '150px' }}>
                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                  소분류 (브랜드)
                </label>
                <select
                  value={selectedDepth3}
                  onChange={handleDepth3Change}
                  disabled={!selectedDepth2}
                  style={{ width: '100%' }}
                >
                  <option value="">선택</option>
                  {depth3Categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {formData.category_id && (
              <p style={{ fontSize: '12px', color: '#28a745', marginTop: '8px' }}>
                선택된 카테고리 ID: {formData.category_id}
              </p>
            )}
          </div>

          {/* 대표 이미지 */}
          <div className="form-group">
            <label>대표 이미지</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* 이미지 미리보기 */}
              {formData.image_url && (
                <div style={{ 
                  width: '120px', 
                  height: '120px', 
                  border: '1px solid #ddd', 
                  borderRadius: '8px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <img 
                    src={formData.image_url.startsWith('/') ? `${process.env.REACT_APP_API_BASE_URL?.replace('/api', '') || ''}${formData.image_url}` : formData.image_url}
                    alt="대표 이미지" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(220, 53, 69, 0.9)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
              
              <div style={{ flex: 1, minWidth: '200px' }}>
                {/* 파일 업로드 버튼 */}
                <input
                  type="file"
                  ref={mainImageRef}
                  accept="image/*"
                  onChange={handleMainImageUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => mainImageRef.current?.click()}
                  disabled={uploading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    marginBottom: '8px'
                  }}
                >
                  {uploading ? '업로드 중...' : '📁 파일 선택'}
                </button>
                
                {/* URL 직접 입력 */}
                <input
                  type="text"
                  name="image_url"
                  value={formData.image_url}
                  onChange={handleChange}
                  placeholder="또는 이미지 URL 직접 입력"
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
            </div>
          </div>

          {/* 상품 설명 이미지 (다중) */}
          <div className="form-group">
            <label>상품 설명 이미지</label>
            <input
              type="file"
              ref={descImageRef}
              accept="image/*"
              multiple
              onChange={handleDescriptionImagesUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => descImageRef.current?.click()}
              disabled={uploading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                marginBottom: '12px'
              }}
            >
              {uploading ? '업로드 중...' : '📁 설명 이미지 추가 (다중 선택 가능)'}
            </button>

            {/* 설명 이미지 미리보기 */}
            {descriptionImages.length > 0 && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                gap: '8px',
                marginBottom: '12px'
              }}>
                {descriptionImages.map((img, index) => (
                  <div 
                    key={index}
                    style={{ 
                      position: 'relative',
                      aspectRatio: '1',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}
                  >
                    <img 
                      src={img.startsWith('/') ? `${process.env.REACT_APP_API_BASE_URL?.replace('/api', '') || ''}${img}` : img}
                      alt={`설명 이미지 ${index + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeDescriptionImage(index)}
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(220, 53, 69, 0.9)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        lineHeight: '1'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              업로드된 이미지 URL이 상품 설명에 자동으로 추가됩니다.
            </p>
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

