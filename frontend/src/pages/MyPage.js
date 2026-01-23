import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, updateUserProfile, changePassword, uploadImage, getImageUrl } from '../services/api';
import { formatPrice } from '../utils/format';
import './MyPage.css';

const MyPage = () => {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'edit' | 'password'
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // 수정 폼 데이터
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '',
    address: '',
    addressDetail: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    customsNumber: '',
    profileImage: ''
  });

  // 비밀번호 변경 폼
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await getUserProfile();
      const data = response.data.user;
      setProfile(data);
      
      // 생년월일 파싱
      let birthYear = '', birthMonth = '', birthDay = '';
      if (data.birth_date) {
        const date = new Date(data.birth_date);
        birthYear = date.getFullYear().toString();
        birthMonth = (date.getMonth() + 1).toString().padStart(2, '0');
        birthDay = date.getDate().toString().padStart(2, '0');
      }

      // 주소 파싱 (기본주소와 상세주소 분리)
      let address = data.address || '';
      let addressDetail = '';
      if (address.includes(' / ')) {
        const parts = address.split(' / ');
        address = parts[0];
        addressDetail = parts[1] || '';
      }

      setFormData({
        name: data.name || '',
        phone: data.phone || '',
        gender: data.gender || '',
        address: address,
        addressDetail: addressDetail,
        birthYear,
        birthMonth,
        birthDay,
        customsNumber: data.customs_number || '',
        profileImage: data.profile_image || ''
      });
    } catch (err) {
      setError('회원 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 프로필 이미지 클릭
  const handleProfileImageClick = () => {
    fileInputRef.current?.click();
  };

  // 프로필 이미지 업로드
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }

    // 이미지 타입 체크
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    try {
      setUploadingImage(true);
      setError('');
      
      const response = await uploadImage(file);
      const imageUrl = response.data.url;
      
      setFormData(prev => ({ ...prev, profileImage: imageUrl }));
      setSuccess('프로필 이미지가 업로드되었습니다.');
      
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
  };

  // 주소 검색
  const handleAddressSearch = () => {
    new window.daum.Postcode({
      oncomplete: function(data) {
        let fullAddress = data.address;
        let extraAddress = '';

        if (data.addressType === 'R') {
          if (data.bname !== '') extraAddress += data.bname;
          if (data.buildingName !== '') {
            extraAddress += (extraAddress !== '' ? ', ' + data.buildingName : data.buildingName);
          }
          fullAddress += (extraAddress !== '' ? ' (' + extraAddress + ')' : '');
        }

        setFormData(prev => ({
          ...prev,
          address: fullAddress,
          addressDetail: ''
        }));
      }
    }).open();
  };

  // 회원정보 수정 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // 생년월일 조합
      let birthDate = null;
      if (formData.birthYear && formData.birthMonth && formData.birthDay) {
        birthDate = `${formData.birthYear}-${formData.birthMonth}-${formData.birthDay}`;
      }

      // 주소 조합
      let fullAddress = formData.address;
      if (formData.addressDetail) {
        fullAddress += ' / ' + formData.addressDetail;
      }

      await updateUserProfile({
        name: formData.name,
        phone: formData.phone,
        gender: formData.gender,
        address: fullAddress,
        birthDate,
        customsNumber: formData.customsNumber,
        profileImage: formData.profileImage
      });

      setSuccess('회원 정보가 수정되었습니다.');
      await refreshUser();
      await fetchProfile();
      
      setTimeout(() => {
        setSuccess('');
        setActiveTab('info');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || '정보 수정에 실패했습니다.');
    }
  };

  // 비밀번호 변경 제출
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      setSuccess('비밀번호가 변경되었습니다.');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      setTimeout(() => {
        setSuccess('');
        setActiveTab('info');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || '비밀번호 변경에 실패했습니다.');
    }
  };

  // 연도 옵션 생성
  const yearOptions = () => {
    const years = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1920; y--) {
      years.push(y);
    }
    return years;
  };

  // 월 옵션 생성
  const monthOptions = () => {
    return Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  };

  // 일 옵션 생성
  const dayOptions = () => {
    return Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  };

  if (loading) {
    return <div className="container loading">로딩 중...</div>;
  }

  return (
    <div className="mypage">
      <div className="container">
        <h1>마이페이지</h1>

        {/* 상단 요약 정보 */}
        <div className="mypage-summary">
          <div className="summary-profile">
            <div className="profile-image-wrapper">
              {(formData.profileImage || profile?.profile_image) ? (
                <img src={getImageUrl(formData.profileImage || profile.profile_image)} alt="프로필" className="profile-image" />
              ) : (
                <div className="profile-image-placeholder">
                  <span>{user?.name?.charAt(0) || '?'}</span>
                </div>
              )}
            </div>
          </div>
          <div className="summary-item">
            <span className="summary-label">이름</span>
            <span className="summary-value">{user?.name}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">보유 적립금</span>
            <span className="summary-value highlight">{formatPrice(user?.points || 0)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">회원등급</span>
            <span className="summary-value">일반회원</span>
          </div>
        </div>

        {/* 퀵 메뉴 */}
        <div className="mypage-quick-menu">
          <Link to="/orders" className="quick-menu-item">
            <span className="quick-icon">📦</span>
            <span>주문내역</span>
          </Link>
          <Link to="/cart" className="quick-menu-item">
            <span className="quick-icon">🛒</span>
            <span>장바구니</span>
          </Link>
        </div>

        {/* 탭 메뉴 */}
        <div className="mypage-tabs">
          <button 
            className={`mypage-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            회원정보
          </button>
          <button 
            className={`mypage-tab ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            정보수정
          </button>
          <button 
            className={`mypage-tab ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            비밀번호 변경
          </button>
        </div>

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        {/* 회원정보 보기 */}
        {activeTab === 'info' && profile && (
          <div className="mypage-content">
            <div className="info-section">
              <h3>기본 정보</h3>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">이메일</span>
                  <span className="info-value">{profile.email}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">이름</span>
                  <span className="info-value">{profile.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">연락처</span>
                  <span className="info-value">{profile.phone || '-'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">성별</span>
                  <span className="info-value">
                    {profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : '-'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">생년월일</span>
                  <span className="info-value">
                    {profile.birth_date ? new Date(profile.birth_date).toLocaleDateString('ko-KR') : '-'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">주소</span>
                  <span className="info-value">{profile.address || '-'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">개인통관부호</span>
                  <span className="info-value">{profile.customs_number || '-'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">가입일</span>
                  <span className="info-value">
                    {new Date(profile.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 정보 수정 */}
        {activeTab === 'edit' && (
          <div className="mypage-content">
            <form onSubmit={handleSubmit} className="edit-form">
              {/* 프로필 이미지 업로드 */}
              <div className="form-group profile-upload-group">
                <label>프로필 이미지</label>
                <div className="profile-upload-wrapper">
                  <div 
                    className="profile-upload-preview"
                    onClick={handleProfileImageClick}
                  >
                    {formData.profileImage ? (
                      <img src={getImageUrl(formData.profileImage)} alt="프로필" />
                    ) : (
                      <div className="profile-upload-placeholder">
                        <span>+</span>
                        <p>클릭하여 업로드</p>
                      </div>
                    )}
                    {uploadingImage && (
                      <div className="profile-upload-loading">
                        <span>업로드 중...</span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                  <small>JPG, PNG, GIF 형식 / 최대 5MB</small>
                </div>
              </div>

              <div className="form-group">
                <label>이메일</label>
                <input type="email" value={profile?.email || ''} disabled />
                <small>이메일은 변경할 수 없습니다.</small>
              </div>

              <div className="form-group">
                <label>이름 *</label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>연락처</label>
                <input 
                  type="tel" 
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="010-0000-0000"
                />
              </div>

              <div className="form-group">
                <label>성별</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input 
                      type="radio" 
                      name="gender" 
                      value="male"
                      checked={formData.gender === 'male'}
                      onChange={handleChange}
                    />
                    남성
                  </label>
                  <label className="radio-label">
                    <input 
                      type="radio" 
                      name="gender" 
                      value="female"
                      checked={formData.gender === 'female'}
                      onChange={handleChange}
                    />
                    여성
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>생년월일</label>
                <div className="birth-selects">
                  <select 
                    name="birthYear" 
                    value={formData.birthYear}
                    onChange={handleChange}
                  >
                    <option value="">년</option>
                    {yearOptions().map(y => (
                      <option key={y} value={y}>{y}년</option>
                    ))}
                  </select>
                  <select 
                    name="birthMonth" 
                    value={formData.birthMonth}
                    onChange={handleChange}
                  >
                    <option value="">월</option>
                    {monthOptions().map(m => (
                      <option key={m} value={m}>{parseInt(m)}월</option>
                    ))}
                  </select>
                  <select 
                    name="birthDay" 
                    value={formData.birthDay}
                    onChange={handleChange}
                  >
                    <option value="">일</option>
                    {dayOptions().map(d => (
                      <option key={d} value={d}>{parseInt(d)}일</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>주소</label>
                <div className="address-input">
                  <input 
                    type="text" 
                    name="address"
                    value={formData.address}
                    readOnly
                    placeholder="주소 검색을 클릭하세요"
                  />
                  <button type="button" onClick={handleAddressSearch} className="btn-address">
                    주소 검색
                  </button>
                </div>
                <input 
                  type="text" 
                  name="addressDetail"
                  value={formData.addressDetail}
                  onChange={handleChange}
                  placeholder="상세주소"
                  style={{ marginTop: '8px' }}
                />
              </div>

              <div className="form-group">
                <label>개인통관부호</label>
                <input 
                  type="text" 
                  name="customsNumber"
                  value={formData.customsNumber}
                  onChange={handleChange}
                  placeholder="P로 시작하는 13자리"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full">
                정보 수정
              </button>
            </form>
          </div>
        )}

        {/* 비밀번호 변경 */}
        {activeTab === 'password' && (
          <div className="mypage-content">
            <form onSubmit={handlePasswordSubmit} className="edit-form">
              <div className="form-group">
                <label>현재 비밀번호 *</label>
                <input 
                  type="password" 
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>새 비밀번호 *</label>
                <input 
                  type="password" 
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  required
                  placeholder="최소 8자 이상"
                />
              </div>

              <div className="form-group">
                <label>새 비밀번호 확인 *</label>
                <input 
                  type="password" 
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full">
                비밀번호 변경
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyPage;
