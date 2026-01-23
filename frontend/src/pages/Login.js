import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(location.state?.success || '');
  const [loading, setLoading] = useState(false);

  // 아이디/비밀번호 찾기 모달 상태
  const [showFindModal, setShowFindModal] = useState(false);
  const [findType, setFindType] = useState('email'); // 'email' or 'password'
  const [findFormData, setFindFormData] = useState({ name: '', phone: '', email: '' });
  const [findResult, setFindResult] = useState('');
  const [findError, setFindError] = useState('');
  const [findLoading, setFindLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      navigate(from, { replace: true });
    } catch (error) {
      setError(error.response?.data?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page login-page">
      <div className="auth-container login-container">
        <h1>Login</h1>
        
        {success && <div className="success">{success}</div>}
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form login-form">
          <div className="form-group">
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="이메일"
              required
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호"
              required
            />
          </div>

          <label className="remember-me">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>로그인상태유지</span>
          </label>

          <button 
            type="submit" 
            className="btn btn-dark btn-full"
            disabled={loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="login-bottom-links">
          <Link to="/terms" className="bottom-link">회원가입</Link>
          <button 
            type="button" 
            className="bottom-link"
            onClick={() => { setShowFindModal(true); setFindResult(''); setFindError(''); }}
          >
            아이디 · 비밀번호 찾기
          </button>
        </div>

        <div className="login-divider">
          <span>또는</span>
        </div>

        <Link to="/order-lookup" className="btn btn-guest-order">
          비회원 주문
        </Link>
      </div>

      {/* 아이디/비밀번호 찾기 모달 */}
      {showFindModal && (
        <div className="modal-overlay" onClick={() => setShowFindModal(false)}>
          <div className="modal-content find-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowFindModal(false)}>×</button>
            
            <div className="find-tabs">
              <button 
                className={`find-tab ${findType === 'email' ? 'active' : ''}`}
                onClick={() => { setFindType('email'); setFindResult(''); setFindError(''); }}
              >
                아이디 찾기
              </button>
              <button 
                className={`find-tab ${findType === 'password' ? 'active' : ''}`}
                onClick={() => { setFindType('password'); setFindResult(''); setFindError(''); }}
              >
                비밀번호 찾기
              </button>
            </div>

            {findType === 'email' ? (
              <div className="find-form">
                <p className="find-desc">가입 시 등록한 이름과 연락처를 입력해주세요.</p>
                <div className="form-group">
                  <label>이름</label>
                  <input
                    type="text"
                    value={findFormData.name}
                    onChange={(e) => setFindFormData({ ...findFormData, name: e.target.value })}
                    placeholder="이름을 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label>연락처</label>
                  <input
                    type="tel"
                    value={findFormData.phone}
                    onChange={(e) => setFindFormData({ ...findFormData, phone: e.target.value })}
                    placeholder="연락처를 입력하세요"
                  />
                </div>
                {findError && <div className="error">{findError}</div>}
                {findResult && <div className="find-result">{findResult}</div>}
                <button 
                  className="btn btn-primary btn-full"
                  onClick={handleFindEmail}
                  disabled={findLoading}
                >
                  {findLoading ? '조회 중...' : '아이디 찾기'}
                </button>
              </div>
            ) : (
              <div className="find-form">
                <p className="find-desc">가입한 이메일 주소를 입력하시면 임시 비밀번호를 안내해드립니다.</p>
                <div className="form-group">
                  <label>이메일</label>
                  <input
                    type="email"
                    value={findFormData.email}
                    onChange={(e) => setFindFormData({ ...findFormData, email: e.target.value })}
                    placeholder="이메일을 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label>이름</label>
                  <input
                    type="text"
                    value={findFormData.name}
                    onChange={(e) => setFindFormData({ ...findFormData, name: e.target.value })}
                    placeholder="이름을 입력하세요"
                  />
                </div>
                {findError && <div className="error">{findError}</div>}
                {findResult && <div className="find-result">{findResult}</div>}
                <button 
                  className="btn btn-primary btn-full"
                  onClick={handleFindPassword}
                  disabled={findLoading}
                >
                  {findLoading ? '조회 중...' : '비밀번호 찾기'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // 아이디 찾기
  async function handleFindEmail() {
    if (!findFormData.name || !findFormData.phone) {
      setFindError('이름과 연락처를 모두 입력해주세요.');
      return;
    }
    setFindLoading(true);
    setFindError('');
    setFindResult('');
    try {
      const response = await axios.post('/auth/find-email', {
        name: findFormData.name,
        phone: findFormData.phone
      });
      setFindResult(`회원님의 이메일은 ${response.data.email} 입니다.`);
    } catch (err) {
      setFindError(err.response?.data?.message || '일치하는 회원 정보를 찾을 수 없습니다.');
    } finally {
      setFindLoading(false);
    }
  }

  // 비밀번호 찾기
  async function handleFindPassword() {
    if (!findFormData.email || !findFormData.name) {
      setFindError('이메일과 이름을 모두 입력해주세요.');
      return;
    }
    setFindLoading(true);
    setFindError('');
    setFindResult('');
    try {
      const response = await axios.post('/auth/find-password', {
        email: findFormData.email,
        name: findFormData.name
      });
      setFindResult(`임시 비밀번호: ${response.data.tempPassword}\n로그인 후 비밀번호를 변경해주세요.`);
    } catch (err) {
      setFindError(err.response?.data?.message || '일치하는 회원 정보를 찾을 수 없습니다.');
    } finally {
      setFindLoading(false);
    }
  }
};

export default Login;

