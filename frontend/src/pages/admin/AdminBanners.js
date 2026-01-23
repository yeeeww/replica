import React, { useEffect, useState, useRef } from 'react';
import { getImageUrl, uploadImage } from '../../services/api';
import axios from 'axios';

const AdminBanners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('main'); // 'main' | 'category'
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const mobileFileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    type: 'main',
    title: '',
    subtitle: '',
    image_url: '',
    mobile_image_url: '',
    link_url: '',
    category_slug: '',
    sort_order: 0,
    is_active: true
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/banners/admin');
      setBanners(response.data.banners || []);
    } catch (error) {
      console.error('Failed to fetch banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const mainBanners = banners.filter(b => b.type === 'main').sort((a, b) => a.sort_order - b.sort_order);
  const categoryBanners = banners.filter(b => b.type === 'category').sort((a, b) => a.sort_order - b.sort_order);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const response = await uploadImage(file);
      setFormData(prev => ({
        ...prev,
        [field]: response.data.url
      }));
    } catch (error) {
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.image_url) {
      alert('이미지를 업로드해주세요.');
      return;
    }

    try {
      if (editing) {
        await axios.put(`/banners/${editing}`, formData);
        alert('배너가 수정되었습니다.');
      } else {
        await axios.post('/banners', { ...formData, type: activeTab });
        alert('배너가 추가되었습니다.');
      }
      resetForm();
      fetchBanners();
    } catch (error) {
      alert(error.response?.data?.message || '저장에 실패했습니다.');
    }
  };

  const handleEdit = (banner) => {
    setEditing(banner.id);
    setActiveTab(banner.type);
    setFormData({
      type: banner.type,
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      image_url: banner.image_url || '',
      mobile_image_url: banner.mobile_image_url || '',
      link_url: banner.link_url || '',
      category_slug: banner.category_slug || '',
      sort_order: banner.sort_order || 0,
      is_active: banner.is_active
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await axios.delete(`/banners/${id}`);
      alert('배너가 삭제되었습니다.');
      fetchBanners();
    } catch (error) {
      alert('삭제에 실패했습니다.');
    }
  };

  const handleToggleActive = async (banner) => {
    try {
      await axios.put(`/banners/${banner.id}`, {
        ...banner,
        is_active: !banner.is_active
      });
      fetchBanners();
    } catch (error) {
      alert('상태 변경에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({
      type: activeTab,
      title: '',
      subtitle: '',
      image_url: '',
      mobile_image_url: '',
      link_url: '',
      category_slug: '',
      sort_order: 0,
      is_active: true
    });
  };

  const sectionStyle = {
    backgroundColor: 'white',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px'
  };

  const tabStyle = (isActive) => ({
    padding: '12px 24px',
    border: 'none',
    borderBottom: isActive ? '3px solid #000' : '3px solid transparent',
    background: 'none',
    fontWeight: isActive ? '600' : '400',
    color: isActive ? '#000' : '#666',
    cursor: 'pointer',
    fontSize: '15px'
  });

  if (loading) {
    return <div className="loading">배너를 불러오는 중...</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>배너 관리</h1>
        <p style={{ color: '#666', marginTop: '8px' }}>
          메인 슬라이드 배너와 카테고리 섹션 배너를 관리합니다.
        </p>
      </div>

      {/* 탭 */}
      <div style={{ borderBottom: '1px solid #ddd', marginBottom: '24px' }}>
        <button 
          style={tabStyle(activeTab === 'main')} 
          onClick={() => { setActiveTab('main'); resetForm(); }}
        >
          메인 슬라이드 배너 ({mainBanners.length})
        </button>
        <button 
          style={tabStyle(activeTab === 'category')} 
          onClick={() => { setActiveTab('category'); resetForm(); }}
        >
          카테고리 섹션 배너 ({categoryBanners.length})
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px' }}>
        {/* 배너 목록 */}
        <div style={sectionStyle}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            {activeTab === 'main' ? '메인 슬라이드 배너' : '카테고리 섹션 배너'} 목록
          </h3>
          
          {(activeTab === 'main' ? mainBanners : categoryBanners).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              등록된 배너가 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(activeTab === 'main' ? mainBanners : categoryBanners).map((banner, index) => (
                <div 
                  key={banner.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px',
                    border: '1px solid #eee',
                    borderRadius: '8px',
                    backgroundColor: banner.is_active ? '#fff' : '#f9f9f9',
                    opacity: banner.is_active ? 1 : 0.6
                  }}
                >
                  {/* 순서 */}
                  <div style={{ 
                    width: '30px', 
                    height: '30px', 
                    backgroundColor: '#333', 
                    color: '#fff', 
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    flexShrink: 0
                  }}>
                    {index + 1}
                  </div>

                  {/* 썸네일 */}
                  <div style={{ 
                    width: '120px', 
                    height: '60px', 
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    <img 
                      src={getImageUrl(banner.image_url)} 
                      alt={banner.title || 'Banner'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                      {banner.title || '(제목 없음)'}
                    </div>
                    {activeTab === 'category' && banner.category_slug && (
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        카테고리: {banner.category_slug}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {banner.is_active ? '활성' : '비활성'}
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleToggleActive(banner)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: banner.is_active ? '#fee' : '#efe',
                        color: banner.is_active ? '#c00' : '#0a0',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      {banner.is_active ? '비활성화' : '활성화'}
                    </button>
                    <button
                      onClick={() => handleEdit(banner)}
                      className="admin-btn admin-btn-edit"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id)}
                      className="admin-btn admin-btn-delete"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 배너 추가/수정 폼 */}
        <div style={{ ...sectionStyle, position: 'sticky', top: '20px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            {editing ? '배너 수정' : '배너 추가'}
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>제목</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="배너 제목 (선택)"
              />
            </div>

            {activeTab === 'category' && (
              <>
                <div className="form-group">
                  <label>부제목</label>
                  <input
                    type="text"
                    name="subtitle"
                    value={formData.subtitle}
                    onChange={handleChange}
                    placeholder="배너 부제목"
                  />
                </div>

                <div className="form-group">
                  <label>카테고리 슬러그 *</label>
                  <select
                    name="category_slug"
                    value={formData.category_slug}
                    onChange={handleChange}
                    required
                  >
                    <option value="">선택하세요</option>
                    <option value="bag">가방 (bag)</option>
                    <option value="clothing">의류 (clothing)</option>
                    <option value="shoes">신발 (shoes)</option>
                    <option value="watch">시계 (watch)</option>
                    <option value="accessory">악세서리 (accessory)</option>
                  </select>
                </div>
              </>
            )}

            <div className="form-group">
              <label>PC 이미지 *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {formData.image_url && (
                  <div style={{ 
                    width: '100%', 
                    height: '120px', 
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <img 
                      src={getImageUrl(formData.image_url)} 
                      alt="PC Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'image_url')}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    padding: '10px',
                    border: '1px dashed #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#f9f9f9',
                    cursor: 'pointer'
                  }}
                >
                  {uploading ? '업로드 중...' : 'PC 이미지 업로드'}
                </button>
                <input
                  type="text"
                  name="image_url"
                  value={formData.image_url}
                  onChange={handleChange}
                  placeholder="또는 이미지 URL 직접 입력"
                />
              </div>
            </div>

            <div className="form-group">
              <label>모바일 이미지</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {formData.mobile_image_url && (
                  <div style={{ 
                    width: '100%', 
                    height: '80px', 
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <img 
                      src={getImageUrl(formData.mobile_image_url)} 
                      alt="Mobile Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <input
                  type="file"
                  ref={mobileFileInputRef}
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'mobile_image_url')}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => mobileFileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    padding: '10px',
                    border: '1px dashed #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#f9f9f9',
                    cursor: 'pointer'
                  }}
                >
                  {uploading ? '업로드 중...' : '모바일 이미지 업로드'}
                </button>
                <input
                  type="text"
                  name="mobile_image_url"
                  value={formData.mobile_image_url}
                  onChange={handleChange}
                  placeholder="또는 이미지 URL 직접 입력"
                />
              </div>
            </div>

            <div className="form-group">
              <label>링크 URL</label>
              <input
                type="text"
                name="link_url"
                value={formData.link_url}
                onChange={handleChange}
                placeholder="클릭 시 이동할 URL (선택)"
              />
            </div>

            <div className="form-group">
              <label>정렬 순서</label>
              <input
                type="number"
                name="sort_order"
                value={formData.sort_order}
                onChange={handleChange}
                min="0"
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
                활성화
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary btn-full">
                {editing ? '수정' : '추가'}
              </button>
              {editing && (
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={resetForm}
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

export default AdminBanners;
