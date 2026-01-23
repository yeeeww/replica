import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPublicSettings } from '../services/api';
import './Auth.css';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    gender: '',
    phone: '',
    address: '',
    addressDetail: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    referralSource: '',
    customsNumber: ''
  });
  const [profilePreview, setProfilePreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerPoints, setRegisterPoints] = useState(5000);

  // 약관 동의 없이 직접 접근 시 약관 페이지로 리디렉션
  useEffect(() => {
    if (!location.state?.termsAgreed) {
      navigate('/terms', { replace: true });
    }
  }, [location.state, navigate]);

  // 적립금 설정 가져오기
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await getPublicSettings();
        if (response.data.register_points) {
          setRegisterPoints(parseInt(response.data.register_points));
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // 년도 옵션 생성 (1940 ~ 현재년도)
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear; year >= 1940; year--) {
    years.push(year);
  }

  // 월 옵션
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // 일 옵션
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleProfileImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // 다음 주소 검색
  const handleAddressSearch = () => {
    new window.daum.Postcode({
      oncomplete: function(data) {
        // 도로명 주소 또는 지번 주소
        let fullAddress = data.roadAddress || data.jibunAddress;
        
        // 건물명이 있으면 추가
        if (data.buildingName) {
          fullAddress += ` (${data.buildingName})`;
        }

        setFormData(prev => ({
          ...prev,
          address: fullAddress,
          zonecode: data.zonecode
        }));
      }
    }).open();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    // 비밀번호 복잡성 검사 (대소문자, 숫자, 특수문자)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/;
    if (!passwordRegex.test(formData.password)) {
      setError('비밀번호는 대소문자, 숫자, 특수문자를 포함해야 합니다.');
      return;
    }

    if (!formData.name) {
      setError('이름을 입력해주세요.');
      return;
    }

    if (!formData.phone) {
      setError('연락처를 입력해주세요.');
      return;
    }

    if (!formData.address) {
      setError('주소를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      // 생년월일 조합
      let birthDate = null;
      if (formData.birthYear && formData.birthMonth && formData.birthDay) {
        birthDate = `${formData.birthYear}-${String(formData.birthMonth).padStart(2, '0')}-${String(formData.birthDay).padStart(2, '0')}`;
      }

      // 전체 주소 조합
      const fullAddress = formData.addressDetail 
        ? `${formData.address} ${formData.addressDetail}`
        : formData.address;

      await register(
        formData.email, 
        formData.password, 
        formData.name, 
        formData.phone,
        {
          gender: formData.gender,
          address: fullAddress,
          birthDate,
          referralSource: formData.referralSource,
          customsNumber: formData.customsNumber
        }
      );
      navigate('/login', { state: { success: '회원가입이 완료되었습니다. 로그인해주세요.' } });
    } catch (error) {
      setError(error.response?.data?.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page register-page">
      <div className="auth-container register-container">
        <h1>Sign In</h1>
        
        {/* 프로필 이미지 업로드 */}
        <div className="profile-upload" onClick={handleProfileImageClick}>
          <div className="profile-avatar">
            {profilePreview ? (
              <img src={profilePreview} alt="프로필 미리보기" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
          <button type="button" className="camera-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>

        {/* 안내 문구 */}
        <div className="register-notice">
          <p>해외상품 주문시 주문자명, 주문자 휴대폰번호가 개인통관부호에 등록된 정보와 모두 일치하셔야 정상 출고가 가능합니다.</p>
        </div>
        
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form register-form">
          {/* 이메일 */}
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

          {/* 비밀번호 */}
          <div className="form-group">
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호"
              required
              minLength="8"
            />
          </div>

          {/* 비밀번호 확인 */}
          <div className="form-group">
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="비밀번호 확인"
              required
            />
          </div>
          <p className="password-hint">8자리 이상의 대소문자, 숫자, 특수문자를 사용해 주세요.</p>

          {/* 이름 */}
          <div className="form-group form-group-labeled">
            <label htmlFor="name">이름 <span className="required-dot">●</span></label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="이름을(를) 입력하세요"
              required
            />
          </div>

          {/* 성별 */}
          <div className="form-group form-group-labeled">
            <label>성별</label>
            <div className="gender-options">
              <label className="radio-label">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={formData.gender === 'male'}
                  onChange={handleChange}
                />
                <span>남자</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={formData.gender === 'female'}
                  onChange={handleChange}
                />
                <span>여자</span>
              </label>
            </div>
          </div>

          {/* 연락처 */}
          <div className="form-group form-group-labeled">
            <label htmlFor="phone">연락처 <span className="required-dot">●</span></label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="연락처"
              required
            />
          </div>

          {/* 주소 */}
          <div className="form-group form-group-labeled">
            <label htmlFor="address">주소 <span className="required-dot">●</span></label>
            <div className="address-search-row">
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="주소를 검색해주세요"
                required
                readOnly
                onClick={handleAddressSearch}
              />
              <button 
                type="button" 
                className="address-search-btn"
                onClick={handleAddressSearch}
              >
                주소찾기
              </button>
            </div>
            <input
              type="text"
              id="addressDetail"
              name="addressDetail"
              value={formData.addressDetail}
              onChange={handleChange}
              placeholder="상세주소"
              className="address-detail"
            />
          </div>

          {/* 생년월일 */}
          <div className="form-group form-group-labeled">
            <label>생년월일</label>
            <div className="birth-selects">
              <select
                name="birthYear"
                value={formData.birthYear}
                onChange={handleChange}
              >
                <option value="">년도</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                name="birthMonth"
                value={formData.birthMonth}
                onChange={handleChange}
              >
                <option value="">월</option>
                {months.map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
              <select
                name="birthDay"
                value={formData.birthDay}
                onChange={handleChange}
              >
                <option value="">일</option>
                {days.map(day => (
                  <option key={day} value={day}>{day}일</option>
                ))}
              </select>
            </div>
          </div>

          {/* 가입 경로 */}
          <div className="form-group form-group-labeled">
            <label htmlFor="referralSource">&lt;선택사항&gt;WIZNOBLE을 알게된 경로 (선택시 {registerPoints.toLocaleString()}원 지급)</label>
            <select
              id="referralSource"
              name="referralSource"
              value={formData.referralSource}
              onChange={handleChange}
            >
              <option value="">선택해주세요 😊</option>
              <option value="search">검색 (네이버, 구글 등)</option>
              <option value="sns">SNS (인스타그램, 페이스북 등)</option>
              <option value="youtube">유튜브</option>
              <option value="blog">블로그</option>
              <option value="friend">지인 추천</option>
              <option value="ad">광고</option>
              <option value="other">기타</option>
            </select>
          </div>

          {/* 개인통관부호 */}
          <div className="form-group form-group-labeled">
            <label htmlFor="customsNumber">개인통관부호를 남겨주세요</label>
            <input
              type="text"
              id="customsNumber"
              name="customsNumber"
              value={formData.customsNumber}
              onChange={handleChange}
              placeholder=""
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-full register-submit-btn"
            disabled={loading}
          >
            {loading ? '가입 중...' : '가입하기'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
