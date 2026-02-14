import React, { useState, useEffect, useRef, useCallback } from 'react';
import { startCrawl, stopCrawl, getCrawlStatus, clearCrawlLogs } from '../../services/api';
import './AdminCrawler.css';

// 카테고리 옵션 (4뎁스 지원: 성별 > 상품종류 > 브랜드 > 세부카테고리)
const CATEGORY_OPTIONS = [
  { value: '', label: '전체 (필터 없음)' },
  { value: '남성', label: '남성' },
  { value: '남성 > 가방', label: '남성 > 가방' },
  { value: '남성 > 지갑', label: '남성 > 지갑' },
  { value: '남성 > 시계', label: '남성 > 시계' },
  { value: '남성 > 신발', label: '남성 > 신발' },
  { value: '남성 > 벨트', label: '남성 > 벨트' },
  { value: '남성 > 의류', label: '남성 > 의류' },
  { value: '남성 > 악세서리', label: '남성 > 악세서리' },
  { value: '남성 > 모자', label: '남성 > 모자' },
  { value: '남성 > 선글라스', label: '남성 > 선글라스' },
  { value: '여성', label: '여성' },
  { value: '여성 > 가방', label: '여성 > 가방' },
  { value: '여성 > 지갑', label: '여성 > 지갑' },
  { value: '여성 > 시계', label: '여성 > 시계' },
  { value: '여성 > 신발', label: '여성 > 신발' },
  { value: '여성 > 벨트', label: '여성 > 벨트' },
  { value: '여성 > 의류', label: '여성 > 의류' },
  { value: '여성 > 악세서리', label: '여성 > 악세서리' },
  { value: '여성 > 모자', label: '여성 > 모자' },
  { value: '여성 > 선글라스', label: '여성 > 선글라스' },
  { value: '국내출고상품', label: '국내출고상품' },
];

const URL_SOURCE_OPTIONS = [
  { value: 'both', label: '사이트맵 + 카테고리 (권장)', desc: '사이트맵과 카테고리 페이지를 모두 탐색하여 최대한 많은 상품을 수집합니다.' },
  { value: 'category', label: '카테고리 페이지만', desc: '카테고리 리스트 페이지를 순회하며 상품을 수집합니다. 사이트맵에 누락된 상품도 포함됩니다.' },
  { value: 'sitemap', label: '사이트맵만 (기존 방식)', desc: 'sitemap3.xml에서 URL을 수집합니다. 사이트맵이 불완전하면 상품이 누락될 수 있습니다.' },
];

const CRAWL_LIMIT_PRESETS = [
  { value: 100, label: '100개' },
  { value: 500, label: '500개' },
  { value: 1000, label: '1,000개' },
  { value: 5000, label: '5,000개' },
  { value: 0, label: '전체 (무제한)' },
];

const AdminCrawler = () => {
  const [crawlLimit, setCrawlLimit] = useState(100);
  const [unlimitedMode, setUnlimitedMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [urlSource, setUrlSource] = useState('both');
  const [speedMode, setSpeedMode] = useState('normal');
  const [skipS3, setSkipS3] = useState(false);
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
        limit: unlimitedMode ? 0 : crawlLimit,
        category: category,
        urlSource: urlSource,
        speedMode: speedMode,
        skipS3: skipS3
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
            <label>
              크롤링 개수
              <label className="custom-toggle">
                <input
                  type="checkbox"
                  checked={unlimitedMode}
                  onChange={(e) => setUnlimitedMode(e.target.checked)}
                  disabled={status.isRunning}
                />
                <span>전체 크롤링</span>
              </label>
            </label>
            {unlimitedMode ? (
              <div className="unlimited-info">
                발견되는 모든 상품을 크롤링합니다. (수만 개, 수 시간 소요 가능)
              </div>
            ) : (
              <div className="limit-presets">
                {CRAWL_LIMIT_PRESETS.filter(p => p.value > 0).map(preset => (
                  <button
                    key={preset.value}
                    className={`preset-btn ${crawlLimit === preset.value ? 'active' : ''}`}
                    onClick={() => setCrawlLimit(preset.value)}
                    disabled={status.isRunning}
                  >
                    {preset.label}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  value={crawlLimit}
                  onChange={(e) => setCrawlLimit(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={status.isRunning}
                  placeholder="직접 입력"
                  className="limit-custom-input"
                />
              </div>
            )}
          </div>
          
          <div className="control-group">
            <label>URL 수집 방식</label>
            <select
              value={urlSource}
              onChange={(e) => setUrlSource(e.target.value)}
              disabled={status.isRunning}
              className="source-select"
            >
              {URL_SOURCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="source-desc">
              {URL_SOURCE_OPTIONS.find(o => o.value === urlSource)?.desc}
            </span>
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
                placeholder="예: 남성 > 가방 > 고야드 > 크로스&숄더백"
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

          <div className="control-group speed-group">
            <label>속도 설정</label>
            <div className="speed-options">
              <div className="speed-toggle-row">
                <button
                  className={`preset-btn ${speedMode === 'normal' ? 'active' : ''}`}
                  onClick={() => setSpeedMode('normal')}
                  disabled={status.isRunning}
                >
                  일반 모드
                </button>
                <button
                  className={`preset-btn speed-fast ${speedMode === 'fast' ? 'active' : ''}`}
                  onClick={() => setSpeedMode('fast')}
                  disabled={status.isRunning}
                >
                  ⚡ 고속 모드
                </button>
              </div>
              <span className="source-desc">
                {speedMode === 'fast' 
                  ? '워커 10개, 배치 30개 (빠른 속도)' 
                  : '워커 6개, 배치 20개 (안정적)'}
              </span>
              <label className="custom-toggle s3-toggle">
                <input
                  type="checkbox"
                  checked={skipS3}
                  onChange={(e) => setSkipS3(e.target.checked)}
                  disabled={status.isRunning}
                />
                <span>S3 업로드 스킵 (원본 이미지 URL 사용)</span>
              </label>
              <span className="source-desc">
                {skipS3 
                  ? '이미지를 S3에 복사하지 않고 원본 URL을 그대로 사용합니다. 크롤링 속도 3~5배 향상' 
                  : '이미지를 S3에 업로드하여 자체 서버에서 제공합니다.'}
              </span>
            </div>
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
          {/* 단계 표시 */}
          <div className="phase-steps">
            {[
              { key: 'init', label: '초기화' },
              { key: 'sitemap', label: '사이트맵 수집' },
              { key: 'category_url', label: '카테고리 URL 수집' },
              { key: 'crawling', label: '상품 크롤링' },
              { key: 'retry', label: '재시도' },
              { key: 'done', label: '완료' },
            ].map((step, idx) => {
              const phaseOrder = ['init', 'sitemap', 'category_url', 'crawling', 'retry', 'done'];
              const currentIdx = phaseOrder.indexOf(status.phase || 'init');
              const stepIdx = phaseOrder.indexOf(step.key);
              const isActive = step.key === status.phase;
              const isDone = stepIdx < currentIdx;
              return (
                <div key={step.key} className={`phase-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                  <div className="phase-dot">{isDone ? '✓' : idx + 1}</div>
                  <span className="phase-label">{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* 상세 통계 */}
          <div className="crawl-stats">
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-label">사이트맵 URL</span>
                <span className="stat-value">{(status.sitemapCount || 0).toLocaleString()}개</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">카테고리 URL</span>
                <span className="stat-value">
                  {(status.categoryUrlCount || 0).toLocaleString()}개
                  {status.categoryUrlDone ? ' ✓' : status.phase === 'category_url' || status.phase === 'crawling' ? ' (수집 중...)' : ''}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">총 URL</span>
                <span className="stat-value">{(status.totalUrls || 0).toLocaleString()}개</span>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-item primary">
                <span className="stat-label">저장 성공</span>
                <span className="stat-value">{(status.savedCount || 0).toLocaleString()}개</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">스캔 완료</span>
                <span className="stat-value">{(status.scannedCount || 0).toLocaleString()}개</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">성공률</span>
                <span className="stat-value">{(status.successRate || 0).toFixed(1)}%</span>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-label">중복 스킵</span>
                <span className="stat-value">{(status.skipCount || 0).toLocaleString()}</span>
              </div>
              <div className="stat-item warn">
                <span className="stat-label">타임아웃</span>
                <span className="stat-value">{(status.timeoutCount || 0).toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">파싱 실패</span>
                <span className="stat-value">{(status.failCount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 진행 바 */}
          {status.totalUrls > 0 && (
            <div className="progress-detail">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${Math.min(100, (status.scannedCount / status.totalUrls) * 100)}%` }}
                ></div>
              </div>
              <div className="progress-meta">
                <span>{status.totalUrls > 0 ? `${((status.scannedCount / status.totalUrls) * 100).toFixed(1)}%` : '0%'}</span>
                <span>{status.elapsedStr ? `경과: ${status.elapsedStr}` : ''}</span>
                <span>{status.remainStr ? `남은: ${status.remainStr}` : ''}</span>
              </div>
            </div>
          )}

          <div className="progress-time">
            {status.startTime && (
              <span>시작: {new Date(status.startTime).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
            )}
            {status.endTime && (
              <span>종료: {new Date(status.endTime).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
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
                className={`log-line ${
                  log.includes('[ERROR]') || log.includes('[TIMEOUT]') ? 'error' : ''
                } ${
                  log.includes('[+') ? 'success' : ''
                } ${
                  log.includes('────') || log.includes('진행:') || log.includes('저장:') || log.includes('성공률:') ? 'progress' : ''
                } ${
                  log.includes('[SITEMAP]') || log.includes('[CATEGORY]') || log.includes('[COLLECT]') || log.includes('[CONFIG]') ? 'info' : ''
                }`}
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
