import React, { useEffect, useState } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../services/api';

const AdminCategories = () => {
  const [allCategories, setAllCategories] = useState([]); // DB에서 불러온 모든 카테고리
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: ''
  });

  // 추가할 카테고리 뎁스 선택
  const [addingDepth, setAddingDepth] = useState('1'); // '1' = 대분류, '2' = 중분류, '3' = 소분류(브랜드)
  
  // 계층 선택용 상태 (중분류/소분류 추가 시 사용)
  const [selectedDepth1, setSelectedDepth1] = useState('');
  const [selectedDepth2, setSelectedDepth2] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await getCategories();
      setAllCategories(response.data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  // 대분류 목록 (depth === 1)
  const getDepth1Categories = () => {
    return allCategories.filter(c => c.depth === 1);
  };

  // 중분류 목록 (선택된 대분류의 자식들)
  const getDepth2Categories = () => {
    if (!selectedDepth1) return [];
    return allCategories.filter(c => c.depth === 2 && c.parent_slug === selectedDepth1);
  };

  // 현재 선택된 중분류의 전체 slug 생성
  const getFullParentSlug = () => {
    if (addingDepth === '2' && selectedDepth1) {
      return selectedDepth1;
    }
    if (addingDepth === '3' && selectedDepth1 && selectedDepth2) {
      return `${selectedDepth1}-${selectedDepth2}`;
    }
    return '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // 이름 입력 시 자동으로 slug 생성 (신규 추가 시에만)
    if (name === 'name' && !editing) {
      const baseSlug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '');
      let fullSlug = baseSlug;
      
      if (addingDepth === '2' && selectedDepth1) {
        fullSlug = `${selectedDepth1}-${baseSlug}`;
      } else if (addingDepth === '3' && selectedDepth1 && selectedDepth2) {
        fullSlug = `${selectedDepth1}-${selectedDepth2}-${baseSlug}`;
      }
      
      setFormData(prev => ({
        ...prev,
        name: value,
        slug: fullSlug
      }));
    }
  };

  // 뎁스 변경 시
  const handleDepthChange = (e) => {
    const value = e.target.value;
    setAddingDepth(value);
    setSelectedDepth1('');
    setSelectedDepth2('');
    setFormData({ name: '', slug: '', description: '' });
  };

  // 대분류 선택 시
  const handleDepth1Change = (e) => {
    const value = e.target.value;
    setSelectedDepth1(value);
    setSelectedDepth2('');
    // slug 초기화
    if (formData.name) {
      const baseSlug = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '');
      if (addingDepth === '2') {
        setFormData(prev => ({ ...prev, slug: value ? `${value}-${baseSlug}` : baseSlug }));
      } else {
        setFormData(prev => ({ ...prev, slug: baseSlug }));
      }
    }
  };

  // 중분류 선택 시
  const handleDepth2Change = (e) => {
    const value = e.target.value;
    setSelectedDepth2(value);
    // slug 업데이트
    if (formData.name && selectedDepth1) {
      const baseSlug = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '');
      setFormData(prev => ({ 
        ...prev, 
        slug: value ? `${selectedDepth1}-${value}-${baseSlug}` : `${selectedDepth1}-${baseSlug}`
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 유효성 검사
    if (addingDepth === '2' && !selectedDepth1) {
      alert('대분류를 선택해주세요.');
      return;
    }
    if (addingDepth === '3' && (!selectedDepth1 || !selectedDepth2)) {
      alert('대분류와 중분류를 선택해주세요.');
      return;
    }

    try {
      const parentSlug = getFullParentSlug();
      const submitData = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        depth: parseInt(addingDepth),
        parent_slug: parentSlug || null
      };

      console.log('Submit data:', submitData);
      console.log('addingDepth:', addingDepth, 'selectedDepth1:', selectedDepth1, 'selectedDepth2:', selectedDepth2);

      if (editing) {
        await updateCategory(editing, submitData);
        alert('카테고리가 수정되었습니다.');
      } else {
        await createCategory(submitData);
        alert('카테고리가 추가되었습니다.');
      }
      
      setFormData({ name: '', slug: '', description: '' });
      setSelectedDepth1('');
      setSelectedDepth2('');
      setEditing(null);
      fetchCategories();
    } catch (error) {
      alert(error.response?.data?.message || '저장에 실패했습니다.');
    }
  };

  const handleEdit = (category) => {
    setEditing(category.id);
    setAddingDepth(category.depth?.toString() || '1');
    
    // parent_slug에서 대분류, 중분류 추출
    const parentSlug = category.parent_slug || '';
    if (category.depth === 2) {
      setSelectedDepth1(parentSlug);
      setSelectedDepth2('');
    } else if (category.depth === 3) {
      const parts = parentSlug.split('-');
      setSelectedDepth1(parts[0] || '');
      setSelectedDepth2(parts.slice(1).join('-') || '');
    } else {
      setSelectedDepth1('');
      setSelectedDepth2('');
    }
    
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || ''
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까? 하위 카테고리도 영향을 받을 수 있습니다.')) return;

    try {
      await deleteCategory(id);
      setAllCategories(allCategories.filter(c => c.id !== id));
      alert('카테고리가 삭제되었습니다.');
    } catch (error) {
      alert(error.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setFormData({ name: '', slug: '', description: '' });
    setAddingDepth('1');
    setSelectedDepth1('');
    setSelectedDepth2('');
  };

  // 카테고리를 계층 구조로 그룹화
  const getGroupedCategories = () => {
    const depth1Cats = allCategories.filter(c => c.depth === 1);
    const depth2Cats = allCategories.filter(c => c.depth === 2);
    const depth3Cats = allCategories.filter(c => c.depth === 3);
    
    return { depth1Cats, depth2Cats, depth3Cats };
  };

  // 뎁스별 색상
  const getDepthStyle = (depth) => {
    switch(depth) {
      case 1: return { backgroundColor: '#e3f2fd', color: '#1976d2' };
      case 2: return { backgroundColor: '#fff3e0', color: '#f57c00' };
      case 3: return { backgroundColor: '#e8f5e9', color: '#388e3c' };
      default: return { backgroundColor: '#f5f5f5', color: '#666' };
    }
  };

  if (loading) {
    return <div className="loading">카테고리를 불러오는 중...</div>;
  }

  const { depth1Cats, depth2Cats, depth3Cats } = getGroupedCategories();

  return (
    <div>
      <div className="admin-page-header">
        <h1>카테고리 관리</h1>
        <p style={{ color: 'var(--secondary-color)', marginTop: '8px' }}>
          대분류, 중분류, 소분류(브랜드) 모두 추가/관리할 수 있습니다.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px' }}>
        <div>
          {/* 대분류 목록 */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ ...getDepthStyle(1), padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>대분류</span>
              ({depth1Cats.length}개)
            </h3>
            {depth1Cats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                등록된 대분류가 없습니다.
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>슬러그</th>
                    <th>상품 수</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {depth1Cats.map((cat) => (
                    <tr key={cat.id}>
                      <td><strong>{cat.name}</strong></td>
                      <td style={{ fontSize: '12px', color: '#666' }}>{cat.slug}</td>
                      <td>{cat.product_count || 0}</td>
                      <td>
                        <div className="admin-actions">
                          <button onClick={() => handleEdit(cat)} className="admin-btn admin-btn-edit">수정</button>
                          <button onClick={() => handleDelete(cat.id)} className="admin-btn admin-btn-delete">삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 중분류 목록 */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ ...getDepthStyle(2), padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>중분류</span>
              ({depth2Cats.length}개)
            </h3>
            {depth2Cats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                등록된 중분류가 없습니다.
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>상위 카테고리</th>
                    <th>이름</th>
                    <th>슬러그</th>
                    <th>상품 수</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {depth2Cats.map((cat) => {
                    const parent = depth1Cats.find(d => d.slug === cat.parent_slug);
                    return (
                      <tr key={cat.id}>
                        <td style={{ color: '#1976d2' }}>{parent?.name || cat.parent_slug}</td>
                        <td>{cat.name}</td>
                        <td style={{ fontSize: '12px', color: '#666' }}>{cat.slug}</td>
                        <td>{cat.product_count || 0}</td>
                        <td>
                          <div className="admin-actions">
                            <button onClick={() => handleEdit(cat)} className="admin-btn admin-btn-edit">수정</button>
                            <button onClick={() => handleDelete(cat.id)} className="admin-btn admin-btn-delete">삭제</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 소분류(브랜드) 목록 */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ ...getDepthStyle(3), padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>소분류(브랜드)</span>
              ({depth3Cats.length}개)
            </h3>
            {depth3Cats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                등록된 소분류(브랜드)가 없습니다.
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>상위 카테고리</th>
                    <th>브랜드명</th>
                    <th>슬러그</th>
                    <th>상품 수</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {depth3Cats.map((cat) => {
                    // parent_slug에서 대분류, 중분류 찾기
                    const parentSlug = cat.parent_slug || '';
                    const parts = parentSlug.split('-');
                    const d1Slug = parts[0];
                    const d2Slug = parts.slice(1).join('-');
                    const d1 = depth1Cats.find(d => d.slug === d1Slug);
                    const d2 = depth2Cats.find(d => d.slug === parentSlug);
                    return (
                      <tr key={cat.id}>
                        <td style={{ fontSize: '13px' }}>
                          <span style={{ color: '#1976d2' }}>{d1?.name || d1Slug}</span>
                          {' > '}
                          <span style={{ color: '#f57c00' }}>{d2?.name || d2Slug}</span>
                        </td>
                        <td>{cat.name}</td>
                        <td style={{ fontSize: '12px', color: '#666' }}>{cat.slug}</td>
                        <td>{cat.product_count || 0}</td>
                        <td>
                          <div className="admin-actions">
                            <button onClick={() => handleEdit(cat)} className="admin-btn admin-btn-edit">수정</button>
                            <button onClick={() => handleDelete(cat.id)} className="admin-btn admin-btn-delete">삭제</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '24px', border: '1px solid var(--border-color)', height: 'fit-content', position: 'sticky', top: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>
            {editing ? '카테고리 수정' : '카테고리 추가'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            {/* 뎁스 선택 */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>추가할 카테고리 단계 *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: '1', label: '대분류', style: getDepthStyle(1) },
                  { value: '2', label: '중분류', style: getDepthStyle(2) },
                  { value: '3', label: '소분류(브랜드)', style: getDepthStyle(3) }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleDepthChange({ target: { value: opt.value } })}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      border: addingDepth === opt.value ? '2px solid #333' : '1px solid #ddd',
                      borderRadius: '6px',
                      backgroundColor: addingDepth === opt.value ? opt.style.backgroundColor : 'white',
                      color: addingDepth === opt.value ? opt.style.color : '#666',
                      fontWeight: addingDepth === opt.value ? '600' : '400',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 상위 카테고리 선택 (중분류/소분류 추가 시) */}
            {(addingDepth === '2' || addingDepth === '3') && (
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '16px', 
                borderRadius: '8px', 
                marginBottom: '16px' 
              }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', fontSize: '14px' }}>
                  상위 카테고리 선택 *
                </label>
                
                {/* 대분류 선택 */}
                <div className="form-group" style={{ marginBottom: addingDepth === '3' ? '12px' : '0' }}>
                  <label htmlFor="depth1" style={{ fontSize: '13px', color: '#666' }}>대분류</label>
                  <select
                    id="depth1"
                    value={selectedDepth1}
                    onChange={handleDepth1Change}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    required
                  >
                    <option value="">-- 대분류 선택 --</option>
                    {getDepth1Categories().map(cat => (
                      <option key={cat.id} value={cat.slug}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* 중분류 선택 (소분류 추가 시만) */}
                {addingDepth === '3' && selectedDepth1 && (
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label htmlFor="depth2" style={{ fontSize: '13px', color: '#666' }}>중분류</label>
                    <select
                      id="depth2"
                      value={selectedDepth2}
                      onChange={handleDepth2Change}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      required
                    >
                      <option value="">-- 중분류 선택 --</option>
                      {getDepth2Categories().map(cat => (
                        <option key={cat.id} value={cat.slug.replace(`${selectedDepth1}-`, '')}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="name">이름 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder={addingDepth === '1' ? '예: 남성, 여성' : addingDepth === '2' ? '예: 가방, 지갑' : '예: 샤넬, 루이비통'}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="slug">슬러그 (자동생성)</label>
              <input
                type="text"
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="자동으로 생성됩니다"
                required
                style={{ backgroundColor: '#f5f5f5' }}
              />
              <small style={{ color: '#666', fontSize: '12px' }}>
                URL에 사용됩니다. 영문, 숫자, 하이픈 권장.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="description">설명 (선택)</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="2"
                placeholder="카테고리에 대한 간단한 설명"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="submit" 
                className="btn btn-primary btn-full"
                disabled={
                  (addingDepth === '2' && !selectedDepth1) ||
                  (addingDepth === '3' && (!selectedDepth1 || !selectedDepth2))
                }
              >
                {editing ? '수정' : '추가'}
              </button>
              {editing && (
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleCancel}
                >
                  취소
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminCategories;

