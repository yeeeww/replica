import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getNotice } from '../services/api';
import { formatDate } from '../utils/format';
import './NoticeDetail.css';

const NoticeDetail = () => {
  const { id } = useParams();
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchNotice = useCallback(async () => {
    try {
      const response = await getNotice(id);
      setNotice(response.data.notice);
    } catch (error) {
      console.error('Failed to fetch notice:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchNotice();
  }, [fetchNotice]);

  if (loading) {
    return <div className="container loading">공지사항을 불러오는 중...</div>;
  }

  if (!notice) {
    return (
      <div className="notice-detail-page">
        <div className="container">
          <div className="notice-not-found">
            <h2>공지사항을 찾을 수 없습니다.</h2>
            <Link to="/notices" className="btn btn-primary">목록으로</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="notice-detail-page">
      <div className="container">
        <div className="notice-detail-header">
          <h1>{notice.title}</h1>
          <div className="notice-detail-meta">
            <span>작성자: {notice.author_name || '관리자'}</span>
            <span>작성일: {formatDate(notice.created_at)}</span>
            <span>조회수: {notice.view_count || 0}</span>
          </div>
        </div>

        <div className="notice-detail-content">
          <div 
            className="notice-content-body"
            dangerouslySetInnerHTML={{ __html: notice.content.replace(/\n/g, '<br/>') }}
          />
        </div>

        <div className="notice-detail-footer">
          <Link to="/notices" className="btn btn-secondary">목록으로</Link>
        </div>
      </div>
    </div>
  );
};

export default NoticeDetail;
