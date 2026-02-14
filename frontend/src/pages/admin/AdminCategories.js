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
  const [addingDepth, setAddingDepth] = useState('1'); // '1' ~ '4'
  
  // 계층 선택용 상태
  const [selectedDepth1, setSelectedDepth1] = useState('');
  const [selectedDepth2, setSelectedDepth2] = useState('');
  const [selectedDepth3, setSelectedDepth3] = useState('');

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

  // 소분류(브랜드) 목록 (선택된 중분류의 자식들)
  const getDepth3Categories = () => {
    if (!selectedDepth1 || !selectedDepth2) return [];
    const depth2FullSlug = `${selectedDepth1}-${selectedDepth2}`;
    return allCategories.filter(c => c.depth === 3 && c.parent_slug === depth2FullSlug);
  };

  // 현재 선택된 상위 카테고리의 전체 slug 생성
  const getFullParentSlug = () => {
    if (addingDepth === '2' && selectedDepth1) {
      return selectedDepth1;
    }
    if (addingDepth === '3' && selectedDepth1 && selectedDepth2) {
      return `${selectedDepth1}-${selectedDepth2}`;
    }
    if (addingDepth === '4' && selectedDepth1 && selectedDepth2 && selectedDepth3) {
      return `${selectedDepth1}-${selectedDepth2}-${selectedDepth3}`;
    }
    return '';
  };

  // 이름에서 slug 기본값 생성
  const makeBaseSlug = (name) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣&-]/g, '');
  };

  // slug 자동 생성 (계층 포함)
  const buildFullSlug = (baseName, depth, d1, d2, d3) => {
    const base = makeBaseSlug(baseName);
    if (depth === '2' && d1) return `${d1}-${base}`;
    if (depth === '3' && d1 && d2) return `${d1}-${d2}-${base}`;
    if (depth === '4' && d1 && d2 && d3) return `${d1}-${d2}-${d3}-${base}`;
    return base;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // 이름 입력 시 자동으로 slug 생성 (신규 추가 시에만)
    if (name === 'name' && !editing) {
      const fullSlug = buildFullSlug(value, addingDepth, selectedDepth1, selectedDepth2, selectedDepth3);
      setFormData(prev => ({ ...prev, name: value, slug: fullSlug }));
    }
  };

  // 뎁스 변경 시
  const handleDepthChange = (value) => {
    setAddingDepth(value);
    setSelectedDepth1('');
    setSelectedDepth2('');
    setSelectedDepth3('');
    setFormData({ name: '', slug: '', description: '' });
  };

  // 대분류 선택 시
  const handleDepth1Change = (e) => {
    const value = e.target.value;
    setSelectedDepth1(value);
    setSelectedDepth2('');
    setSelectedDepth3('');
    if (formData.name) {
      setFormData(prev => ({ ...prev, slug: buildFullSlug(formData.name, addingDepth, value, '', '') }));
    }
  };

  // 중분류 선택 시
  const handleDepth2Change = (e) => {
    const value = e.target.value;
    setSelectedDepth2(value);
    setSelectedDepth3('');
    if (formData.name && selectedDepth1) {
      setFormData(prev => ({ ...prev, slug: buildFullSlug(formData.name, addingDepth, selectedDepth1, value, '') }));
    }
  };

  // 소분류(브랜드) 선택 시
  const handleDepth3Change = (e) => {
    const value = e.target.value;
    setSelectedDepth3(value);
    if (formData.name && selectedDepth1 && selectedDepth2) {
      setFormData(prev => ({ ...prev, slug: buildFullSlug(formData.name, addingDepth, selectedDepth1, selectedDepth2, value) }));
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
    if (addingDepth === '4' && (!selectedDepth1 || !selectedDepth2 || !selectedDepth3)) {
      alert('대분류, 중분류, 소분류(브랜드)를 모두 선택해주세요.');
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
      setSelectedDepth3('');
      setEditing(null);
      fetchCategories();
    } catch (error) {
      alert(error.response?.data?.message || '저장에 실패했습니다.');
    }
  };

  const handleEdit = (category) => {
    setEditing(category.id);
    setAddingDepth(category.depth?.toString() || '1');
    
    // parent_slug에서 상위 카테고리 추출
    const parentSlug = category.parent_slug || '';
    if (category.depth === 2) {
      setSelectedDepth1(parentSlug);
      setSelectedDepth2('');
      setSelectedDepth3('');
    } else if (category.depth === 3) {
      // parent_slug = "men-bag" → d1="men", d2="bag"
      const parts = parentSlug.split('-');
      setSelectedDepth1(parts[0] || '');
      setSelectedDepth2(parts.slice(1).join('-') || '');
      setSelectedDepth3('');
    } else if (category.depth === 4) {
      // parent_slug = "men-bag-고야드" → d1="men", 나머지에서 d2, d3 추출
      // depth2 slug는 "men-xxx" 형태, depth3 slug는 "men-xxx-브랜드" 형태
      // parent_slug는 depth3의 slug이므로 depth2의 parent_slug에서 역추적
      const parentCat = allCategories.find(c => c.slug === parentSlug);
      if (parentCat && parentCat.parent_slug) {
        // parentCat = depth3 카테고리, parentCat.parent_slug = depth2 slug
        const d2Slug = parentCat.parent_slug; // "men-bag"
        const d2Parts = d2Slug.split('-');
        const d1 = d2Parts[0]; // "men"
        const d2Sub = d2Parts.slice(1).join('-'); // "bag"
        // depth3의 slug에서 depth2 slug를 빼면 브랜드 부분
        const d3Sub = parentSlug.replace(`${d2Slug}-`, ''); // "고야드"
        setSelectedDepth1(d1);
        setSelectedDepth2(d2Sub);
        setSelectedDepth3(d3Sub);
      } else {
        setSelectedDepth1('');
        setSelectedDepth2('');
        setSelectedDepth3('');
      }
    } else {
      setSelectedDepth1('');
      setSelectedDepth2('');
      setSelectedDepth3('');
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
    setSelectedDepth3('');
  };

  // 카테고리를 계층 구조로 그룹화
  const getGroupedCategories = () => {
    const depth1Cats = allCategories.filter(c => c.depth === 1);
    const depth2Cats = allCategories.filter(c => c.depth === 2);
    const depth3Cats = allCategories.filter(c => c.depth === 3);
    const depth4Cats = allCategories.filter(c => c.depth === 4);
    
    // 중분류를 대분류별로 정렬
    const sortedDepth2Cats = [...depth2Cats].sort((a, b) => {
      if (a.parent_slug !== b.parent_slug) {
        const aParentIndex = depth1Cats.findIndex(d => d.slug === a.parent_slug);
        const bParentIndex = depth1Cats.findIndex(d => d.slug === b.parent_slug);
        return aParentIndex - bParentIndex;
      }
      return a.name.localeCompare(b.name, 'ko');
    });

    // 소분류를 대분류 > 중분류별로 정렬
    const sortedDepth3Cats = [...depth3Cats].sort((a, b) => {
      const aParentSlug = a.parent_slug || '';
      const bParentSlug = b.parent_slug || '';
      if (aParentSlug !== bParentSlug) {
        return aParentSlug.localeCompare(bParentSlug, 'ko');
      }
      return a.name.localeCompare(b.name, 'ko');
    });

    // 세부 카테고리를 상위별로 정렬
    const sortedDepth4Cats = [...depth4Cats].sort((a, b) => {
      const aParentSlug = a.parent_slug || '';
      const bParentSlug = b.parent_slug || '';
      if (aParentSlug !== bParentSlug) {
        return aParentSlug.localeCompare(bParentSlug, 'ko');
      }
      return a.name.localeCompare(b.name, 'ko');
    });
    
    return { depth1Cats, depth2Cats: sortedDepth2Cats, depth3Cats: sortedDepth3Cats, depth4Cats: sortedDepth4Cats };
  };

  // 뎁스별 색상
  const getDepthStyle = (depth) => {
    switch(depth) {
      case 1: return { backgroundColor: '#e3f2fd', color: '#1976d2' };
      case 2: return { backgroundColor: '#fff3e0', color: '#f57c00' };
      case 3: return { backgroundColor: '#e8f5e9', color: '#388e3c' };
      case 4: return { backgroundColor: '#fce4ec', color: '#c62828' };
      default: return { backgroundColor: '#f5f5f5', color: '#666' };
    }
  };

  // 상위 경로 텍스트 생성 헬퍼
  const getParentPathText = (cat, depth1Cats, depth2Cats, depth3Cats) => {
    const parentSlug = cat.parent_slug || '';
    
    if (cat.depth === 2) {
      const d1 = depth1Cats.find(d => d.slug === parentSlug);
      return <span style={{ color: '#1976d2' }}>{d1?.name || parentSlug}</span>;
    }
    
    if (cat.depth === 3) {
      const parts = parentSlug.split('-');
      const d1Slug = parts[0];
      const d1 = depth1Cats.find(d => d.slug === d1Slug);
      const d2 = depth2Cats.find(d => d.slug === parentSlug);
      return (
        <>
          <span style={{ color: '#1976d2' }}>{d1?.name || d1Slug}</span>
          {' > '}
          <span style={{ color: '#f57c00' }}>{d2?.name || parts.slice(1).join('-')}</span>
        </>
      );
    }
    
    if (cat.depth === 4) {
      const d3 = depth3Cats.find(d => d.slug === parentSlug);
      const d2 = d3 ? depth2Cats.find(d => d.slug === d3.parent_slug) : null;
      const d2ParentSlug = d2?.parent_slug || '';
      const d1 = depth1Cats.find(d => d.slug === d2ParentSlug);
      return (
        <>
          <span style={{ color: '#1976d2' }}>{d1?.name || '?'}</span>
          {' > '}
          <span style={{ color: '#f57c00' }}>{d2?.name || '?'}</span>
          {' > '}
          <span style={{ color: '#388e3c' }}>{d3?.name || parentSlug}</span>
        </>
      );
    }
    
    return parentSlug;
  };

  if (loading) {
    return <div className="loading">카테고리를 불러오는 중...</div>;
  }

  const { depth1Cats, depth2Cats, depth3Cats, depth4Cats } = getGroupedCategories();

  const depthOptions = [
    { value: '1', label: '대분류', style: getDepthStyle(1) },
    { value: '2', label: '중분류', style: getDepthStyle(2) },
    { value: '3', label: '소분류(브랜드)', style: getDepthStyle(3) },
    { value: '4', label: '세부카테고리', style: getDepthStyle(4) }
  ];

  // 이름 placeholder
  const namePlaceholders = {
    '1': '예: 남성, 여성',
    '2': '예: 가방, 지갑',
    '3': '예: 샤넬, 루이비통',
    '4': '예: 크로스&숄더백, 토트백'
  };

  // 폼 비활성화 조건
  const isFormDisabled = 
    (addingDepth === '2' && !selectedDepth1) ||
    (addingDepth === '3' && (!selectedDepth1 || !selectedDepth2)) ||
    (addingDepth === '4' && (!selectedDepth1 || !selectedDepth2 || !selectedDepth3));

  // 카테고리 테이블 렌더러
  const renderCategoryTable = (cats, depthNum, label) => (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ ...getDepthStyle(depthNum), padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>{label}</span>
        ({cats.length}개)
      </h3>
      {cats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
          등록된 {label}가 없습니다.
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              {depthNum > 1 && <th>상위 카테고리</th>}
              <th>이름</th>
              <th>슬러그</th>
              <th>상품 수</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((cat) => (
              <tr key={cat.id}>
                {depthNum > 1 && (
                  <td style={{ fontSize: '13px' }}>
                    {getParentPathText(cat, depth1Cats, depth2Cats, depth3Cats)}
                  </td>
                )}
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
  );

  return (
    <div>
      <div className="admin-page-header">
        <h1>카테고리 관리</h1>
        <p style={{ color: 'var(--secondary-color)', marginTop: '8px' }}>
          대분류, 중분류, 소분류(브랜드), 세부카테고리 모두 추가/관리할 수 있습니다.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px' }}>
        <div>
          {renderCategoryTable(depth1Cats, 1, '대분류')}
          {renderCategoryTable(depth2Cats, 2, '중분류')}
          {renderCategoryTable(depth3Cats, 3, '소분류(브랜드)')}
          {renderCategoryTable(depth4Cats, 4, '세부카테고리')}
        </div>

        <div style={{ backgroundColor: 'white', padding: '24px', border: '1px solid var(--border-color)', height: 'fit-content', position: 'sticky', top: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>
            {editing ? '카테고리 수정' : '카테고리 추가'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            {/* 뎁스 선택 */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>추가할 카테고리 단계 *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {depthOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleDepthChange(opt.value)}
                    style={{
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

            {/* 상위 카테고리 선택 (depth 2 이상일 때) */}
            {parseInt(addingDepth) >= 2 && (
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
                <div className="form-group" style={{ marginBottom: parseInt(addingDepth) >= 3 ? '12px' : '0' }}>
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

                {/* 중분류 선택 (depth 3, 4일 때) */}
                {parseInt(addingDepth) >= 3 && selectedDepth1 && (
                  <div className="form-group" style={{ marginBottom: parseInt(addingDepth) >= 4 ? '12px' : '0' }}>
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

                {/* 소분류(브랜드) 선택 (depth 4일 때) */}
                {addingDepth === '4' && selectedDepth1 && selectedDepth2 && (
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label htmlFor="depth3" style={{ fontSize: '13px', color: '#666' }}>소분류(브랜드)</label>
                    <select
                      id="depth3"
                      value={selectedDepth3}
                      onChange={handleDepth3Change}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      required
                    >
                      <option value="">-- 소분류(브랜드) 선택 --</option>
                      {getDepth3Categories().map(cat => {
                        const d2FullSlug = `${selectedDepth1}-${selectedDepth2}`;
                        return (
                          <option key={cat.id} value={cat.slug.replace(`${d2FullSlug}-`, '')}>{cat.name}</option>
                        );
                      })}
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
                placeholder={namePlaceholders[addingDepth] || '카테고리 이름'}
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
                disabled={isFormDisabled}
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
