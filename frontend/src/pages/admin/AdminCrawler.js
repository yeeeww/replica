import React, { useState, useEffect, useRef, useCallback } from 'react';
import { startCrawl, stopCrawl, getCrawlStatus, clearCrawlLogs } from '../../services/api';
import './AdminCrawler.css';

// 카테고리 옵션
const CATEGORY_OPTIONS = [
  { value: '', label: '전체 (필터 없음)' },
  { value: '남성', label: '남성' },
  { value: '남성 > 가방', label: '남성 > 가방' },
  { value: '남성 > 지갑', label: '남성 > 지갑' },
  { value: '남성 > 시계', label: '남성 > 시계' },
  { value: '남성 > 신발', label: '남성 > 신발' },
  { value: '남성 > 벨트', label: '남성 > 벨트' },
  { value: '남성 > 의류', label: '남성 > 의류' },
  { value: '여성', label: '여성' },
  { value: '여성 > 가방', label: '여성 > 가방' },
  { value: '여성 > 지갑', label: '여성 > 지갑' },
  { value: '여성 > 시계', label: '여성 > 시계' },
  { value: '여성 > 신발', label: '여성 > 신발' },
  { value: '여성 > 벨트', label: '여성 > 벨트' },
  { value: '여성 > 의류', label: '여성 > 의류' },
  { value: '국내출고상품', label: '국내출고상품' },
];

const AdminCrawler = () => {
  const [crawlLimit, setCrawlLimit] = useState(20);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [status, setStatus] = useState({
    isRunning: false,
    logs: [],
    startTime: null,
    endTime: null,
    savedCount: 0,
    targetCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const logContainerRef = useRef(null);
  const pollingRef = useRef(null);

  // 상태 조회
  const fetchStatus = useCallback(async () => {
    try {
      const response = await getCrawlStatus();
      setStatus(response.data);
    } catch (error) {
      console.error('상태 조회 실패:', error);
    }
  }, []);

  // 초기 로드 및 폴링
  useEffect(() => {
    fetchStatus();
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchStatus]);

  // 크롤링 진행 중일 때 폴링
  useEffect(() => {
    if (status.isRunning) {
      pollingRef.current = setInterval(fetchStatus, 2000);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [status.isRunning, fetchStatus]);

  // 로그 자동 스크롤
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [status.logs]);

  // 크롤링 시작
  const handleStartCrawl = async () => {
    if (status.isRunning) return;
    
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    const category = useCustomCategory ? customCategory : categoryFilter;
    
    try {
      const response = await startCrawl({ 
        limit: crawlLimit,
        category: category
      });
      setMessage({ type: 'success', text: response.data.message });
      fetchStatus();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || '크롤링 시작에 실패했습니다.' 
      });
    } finally {
      setLoading(false);
    }
  };

  // 크롤링 중지
  const handleStopCrawl = async () => {
    if (!status.isRunning) return;
    
    try {
      const response = await stopCrawl();
      setMessage({ type: 'success', text: response.data.message });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || '크롤링 중지에 실패했습니다.' 
      });
    }
  };

  // 로그 초기화
  const handleClearLogs = async () => {
    if (status.isRunning) return;
    
    try {
      await clearCrawlLogs();
      setStatus(prev => ({ ...prev, logs: [], savedCount: 0, targetCount: 0 }));
      setMessage({ type: 'success', text: '로그가 초기화되었습니다.' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || '로그 초기화에 실패했습니다.' 
      });
    }
  };

  // 진행률 계산
  const progress = status.targetCount > 0 
    ? Math.min(100, Math.round((status.savedCount / status.targetCount) * 100))
    : 0;

  return (
    <div className="admin-crawler">
      <div className="crawler-header">
        <h2>상품 크롤링</h2>
        <p className="crawler-desc">외부 사이트에서 상품 정보를 자동으로 수집합니다.</p>
      </div>

      {message.text && (
        <div className={`alert ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="crawler-controls">
        <div className="control-row">
          <div className="control-group">
            <label>크롤링 개수</label>
            <div className="limit-input-wrapper">
              <input
                type="number"
                min="1"
                value={crawlLimit}
                onChange={(e) => setCrawlLimit(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={status.isRunning}
                placeholder="개수 입력"
              />
            </div>
          </div>
          
          <div className="control-group category-group">
            <label>
              카테고리 필터
              <label className="custom-toggle">
                <input
                  type="checkbox"
                  checked={useCustomCategory}
                  onChange={(e) => setUseCustomCategory(e.target.checked)}
                  disabled={status.isRunning}
                />
                <span>직접 입력</span>
              </label>
            </label>
            {useCustomCategory ? (
              <input
                type="text"
                className="category-input"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                disabled={status.isRunning}
                placeholder="예: 남성 > 지갑 > 프라다"
              />
            ) : (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                disabled={status.isRunning}
                className="category-select"
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        
        <div className="control-buttons">
          {status.isRunning ? (
            <button 
              className="btn-stop"
              onClick={handleStopCrawl}
            >
              크롤링 중지
            </button>
          ) : (
            <button 
              className="btn-start"
              onClick={handleStartCrawl}
              disabled={loading}
            >
              크롤링 시작
            </button>
          )}
          
          <button 
            className="btn-clear"
            onClick={handleClearLogs}
            disabled={status.isRunning}
          >
            로그 초기화
          </button>
        </div>
      </div>

      {/* 진행 상태 */}
      {(status.isRunning || status.savedCount > 0) && (
        <div className="crawler-progress">
          <div className="progress-info">
            <span className="progress-label">
              {status.isRunning ? '진행 중' : '완료'}
            </span>
            <span className="progress-count">
              {status.savedCount} / {status.targetCount}개 저장됨
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-time">
            {status.startTime && (
              <span>시작: {new Date(status.startTime).toLocaleString()}</span>
            )}
            {status.endTime && (
              <span>종료: {new Date(status.endTime).toLocaleString()}</span>
            )}
          </div>
        </div>
      )}

      {/* 로그 출력 */}
      <div className="crawler-log-section">
        <div className="log-header">
          <h3>크롤링 로그</h3>
          <span className="log-count">{status.logs.length}줄</span>
        </div>
        <div className="log-container" ref={logContainerRef}>
          {status.logs.length === 0 ? (
            <div className="log-empty">로그가 없습니다. 크롤링을 시작해주세요.</div>
          ) : (
            status.logs.map((log, idx) => (
              <div 
                key={idx} 
                className={`log-line ${log.includes('[ERROR]') ? 'error' : ''} ${log.includes('[OK]') ? 'success' : ''} ${log.includes('[SKIP]') ? 'skip' : ''}`}
              >
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCrawler;
