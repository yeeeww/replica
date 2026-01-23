import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getNotices, deleteNotice } from '../../services/api';
import { formatDate } from '../../utils/format';

const AdminNotices = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      const response = await getNotices({ limit: 100 });
      setNotices(response.data.notices);
    } catch (error) {
      console.error('Failed to fetch notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await deleteNotice(id);
      setNotices(notices.filter(notice => notice.id !== id));
      alert('공지사항이 삭제되었습니다.');
    } catch (error) {
      alert(error.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="loading">공지사항을 불러오는 중...</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>공지사항 관리</h1>
        <Link to="/admin/notices/new" className="btn btn-primary">
          새 공지사항
        </Link>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>제목</th>
            <th>고정</th>
            <th>작성일</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {notices.map((notice) => (
            <tr key={notice.id}>
              <td>{notice.id}</td>
              <td>
                <Link 
                  to={`/notices/${notice.id}`}
                  style={{ color: 'var(--primary-color)', fontWeight: '500' }}
                >
                  {notice.title}
                </Link>
              </td>
              <td>{notice.is_pinned ? '📌 고정' : '-'}</td>
              <td>{formatDate(notice.created_at)}</td>
              <td>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link 
                    to={`/admin/notices/${notice.id}/edit`}
                    className="btn btn-secondary btn-sm"
                  >
                    수정
                  </Link>
                  <button 
                    onClick={() => handleDelete(notice.id)}
                    className="btn btn-danger btn-sm"
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {notices.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary-color)' }}>
          등록된 공지사항이 없습니다.
        </div>
      )}
    </div>
  );
};

export default AdminNotices;
