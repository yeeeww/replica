import React, { useEffect, useState } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../services/api';

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: ''
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await getCategories();
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editing) {
        await updateCategory(editing, formData);
        alert('카테고리가 수정되었습니다.');
      } else {
        await createCategory(formData);
        alert('카테고리가 생성되었습니다.');
      }
      
      setFormData({ name: '', slug: '', description: '' });
      setEditing(null);
      fetchCategories();
    } catch (error) {
      alert(error.response?.data?.message || '저장에 실패했습니다.');
    }
  };

  const handleEdit = (category) => {
    setEditing(category.id);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || ''
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await deleteCategory(id);
      setCategories(categories.filter(c => c.id !== id));
      alert('카테고리가 삭제되었습니다.');
    } catch (error) {
      alert(error.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setFormData({ name: '', slug: '', description: '' });
  };

  if (loading) {
    return <div className="loading">카테고리를 불러오는 중...</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>카테고리 관리</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px' }}>
        <div>
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
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{category.slug}</td>
                  <td>{category.product_count}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        onClick={() => handleEdit(category)}
                        className="admin-btn admin-btn-edit"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
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

          {categories.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary-color)' }}>
              등록된 카테고리가 없습니다.
            </div>
          )}
        </div>

        <div style={{ backgroundColor: 'white', padding: '24px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>
            {editing ? '카테고리 수정' : '카테고리 추가'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">이름 *</label>
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
              <label htmlFor="slug">슬러그 *</label>
              <input
                type="text"
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="예: clothing"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">설명</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary btn-full">
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

