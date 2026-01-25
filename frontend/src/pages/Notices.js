import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getNotices } from '../services/api';
import { formatDateShort } from '../utils/format';
import './Notices.css';

const Notices = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

  useEffect(() => {
    fetchNotices(1);
  }, []);

  const fetchNotices = async (page) => {
    try {
      setLoading(true);
      const response = await getNotices({ page, limit: 15 });
      setNotices(response.data.notices);
      setPagination({
        page: response.data.pagination.page,
        totalPages: response.data.pagination.totalPages
      });
    } catch (error) {
      console.error('Failed to fetch notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchNotices(newPage);
    }
  };

  if (loading) {
    return <div className="container loading">공지사항을 불러오는 중...</div>;
  }

  return (
    <div className="notices-page">
      <div className="container">
        <h1>공지사항</h1>

        <div className="notices-list">
          <div className="notices-header">
            <span className="notices-col-num">번호</span>
            <span className="notices-col-title">제목</span>
            <span className="notices-col-date">작성일</span>
          </div>

          {notices.length === 0 ? (
            <div className="notices-empty">등록된 공지사항이 없습니다.</div>
          ) : (
            notices.map((notice, index) => (
              <Link 
                key={notice.id} 
                to={`/notices/${notice.id}`}
                className={`notices-item ${notice.is_pinned ? 'pinned' : ''}`}
              >
                <span className="notices-col-num">
                  {notice.is_pinned ? '📌' : (pagination.page - 1) * 15 + index + 1}
                </span>
                <span className="notices-col-title">
                  {notice.is_pinned && <span className="notice-badge">공지</span>}
                  {notice.title}
                </span>
                <span className="notices-col-date">{formatDateShort(notice.created_at)}</span>
              </Link>
            ))
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="notices-pagination">
            <button 
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              이전
            </button>
            <span>{pagination.page} / {pagination.totalPages}</span>
            <button 
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notices;
