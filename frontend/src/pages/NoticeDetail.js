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

  // 파일 크기 포맷
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 첨부파일 파싱
  const getAttachments = () => {
    if (!notice?.attachments) return [];
    try {
      return JSON.parse(notice.attachments);
    } catch {
      return [];
    }
  };

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

  const attachments = getAttachments();

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
            dangerouslySetInnerHTML={{ __html: notice.content }}
          />
        </div>

        {/* 첨부파일 */}
        {attachments.length > 0 && (
          <div className="notice-attachments">
            <h3>📎 첨부파일</h3>
            <ul>
              {attachments.map((file, index) => (
                <li key={index}>
                  <a 
                    href={file.url} 
                    download={file.name}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📄 {file.name}
                    {file.size && <span className="file-size">({formatFileSize(file.size)})</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="notice-detail-footer">
          <Link to="/notices" className="btn btn-secondary">목록으로</Link>
        </div>
      </div>
    </div>
  );
};

export default NoticeDetail;
