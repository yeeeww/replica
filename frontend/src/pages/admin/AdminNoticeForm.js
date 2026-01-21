import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNotice, createNotice, updateNotice } from '../../services/api';

const AdminNoticeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_pinned: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchNotice = useCallback(async () => {
    try {
      const response = await getNotice(id);
      const notice = response.data.notice;
      setFormData({
        title: notice.title,
        content: notice.content,
        is_pinned: notice.is_pinned || false
      });
    } catch (error) {
      console.error('Failed to fetch notice:', error);
      setError('공지사항을 불러오는데 실패했습니다.');
    }
  }, [id]);

  useEffect(() => {
    if (isEdit) {
      fetchNotice();
    }
  }, [isEdit, fetchNotice]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isEdit) {
        await updateNotice(id, formData);
        alert('공지사항이 수정되었습니다.');
      } else {
        await createNotice(formData);
        alert('공지사항이 등록되었습니다.');
      }
      navigate('/admin/notices');
    } catch (error) {
      setError(error.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>{isEdit ? '공지사항 수정' : '새 공지사항'}</h1>
      </div>

      {error && <div className="error" style={{ marginBottom: '20px' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label htmlFor="title">제목 *</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="공지사항 제목을 입력하세요"
          />
        </div>

        <div className="form-group">
          <label htmlFor="content">내용 *</label>
          <textarea
            id="content"
            name="content"
            value={formData.content}
            onChange={handleChange}
            required
            rows="15"
            placeholder="공지사항 내용을 입력하세요"
            style={{ minHeight: '300px' }}
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="is_pinned"
              checked={formData.is_pinned}
              onChange={handleChange}
              style={{ width: '18px', height: '18px' }}
            />
            <span>상단 고정</span>
          </label>
        </div>

        <div className="form-actions" style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '저장 중...' : (isEdit ? '수정하기' : '등록하기')}
          </button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => navigate('/admin/notices')}
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminNoticeForm;
