import React, { useState, useEffect } from 'react';
import { getAdminSettings, updateAdminSettings } from '../../services/api';

const AdminPointsSettings = () => {
  const [settings, setSettings] = useState({
    register_points: 5000,
    purchase_points_rate: 1
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await getAdminSettings();
      const data = response.data.settings || {};
      setSettings({
        register_points: parseInt(data.register_points) || 5000,
        purchase_points_rate: parseFloat(data.purchase_points_rate) || 1
      });
    } catch (error) {
      console.error('설정 로딩 실패:', error);
      setMessage('설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await updateAdminSettings(settings);
      setMessage('설정이 저장되었습니다.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('설정 저장 실패:', error);
      setMessage('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: name === 'purchase_points_rate' ? parseFloat(value) || 0 : parseInt(value) || 0
    }));
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px' }}>로딩 중...</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>적립금 설정</h1>

      {message && (
        <div style={{
          ...messageStyle,
          backgroundColor: message.includes('실패') ? '#f8d7da' : '#d4edda',
          color: message.includes('실패') ? '#721c24' : '#155724'
        }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>회원가입 적립금</h2>
          <p style={descStyle}>신규 회원가입 시 자동으로 지급되는 적립금입니다.</p>
          
          <div style={formGroupStyle}>
            <label style={labelStyle}>적립금 금액</label>
            <div style={inputWrapperStyle}>
              <input
                type="number"
                name="register_points"
                value={settings.register_points}
                onChange={handleChange}
                style={inputStyle}
                min="0"
                step="100"
              />
              <span style={unitStyle}>P (포인트)</span>
            </div>
            <p style={helpTextStyle}>
              예시: 5000 입력 시, 회원가입 완료 시 5,000P가 자동 지급됩니다.
            </p>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>구매 적립률</h2>
          <p style={descStyle}>결제 완료(배송완료) 시 결제금액의 일정 비율을 적립금으로 지급합니다.</p>
          
          <div style={formGroupStyle}>
            <label style={labelStyle}>적립률</label>
            <div style={inputWrapperStyle}>
              <input
                type="number"
                name="purchase_points_rate"
                value={settings.purchase_points_rate}
                onChange={handleChange}
                style={inputStyle}
                min="0"
                max="100"
                step="0.1"
              />
              <span style={unitStyle}>%</span>
            </div>
            <p style={helpTextStyle}>
              예시: 1% 입력 시, 100,000원 결제 → 배송완료 시 1,000P 적립
            </p>
          </div>

          <div style={infoBoxStyle}>
            <strong>적립금 지급 시점</strong>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li>회원가입 적립금: 회원가입 완료 즉시</li>
              <li>구매 적립금: 주문 상태가 "배송완료"로 변경될 때</li>
            </ul>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>적립금 사용 안내</h2>
          <div style={infoBoxStyle}>
            <ul style={{ margin: 0, padding: '0 0 0 20px' }}>
              <li>고객은 결제 시 보유 적립금을 사용하여 결제금액을 차감할 수 있습니다.</li>
              <li>주문 취소 시 사용한 적립금은 자동으로 환불됩니다.</li>
              <li>적립 예정 금액은 배송완료 후 지급됩니다.</li>
            </ul>
          </div>
        </div>

        <div style={buttonContainerStyle}>
          <button
            type="submit"
            disabled={saving}
            style={{
              ...submitButtonStyle,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </form>
    </div>
  );
};

// 스타일
const containerStyle = {
  padding: '24px',
  maxWidth: '800px',
  margin: '0 auto'
};

const titleStyle = {
  fontSize: '24px',
  fontWeight: '700',
  marginBottom: '24px',
  color: '#1a1a1a'
};

const messageStyle = {
  padding: '12px 16px',
  borderRadius: '6px',
  marginBottom: '20px',
  fontSize: '14px'
};

const cardStyle = {
  backgroundColor: '#fff',
  borderRadius: '8px',
  padding: '24px',
  marginBottom: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
};

const cardTitleStyle = {
  fontSize: '18px',
  fontWeight: '600',
  marginBottom: '8px',
  color: '#1a1a1a'
};

const descStyle = {
  fontSize: '14px',
  color: '#666',
  marginBottom: '20px'
};

const formGroupStyle = {
  marginBottom: '16px'
};

const labelStyle = {
  display: 'block',
  fontSize: '14px',
  fontWeight: '500',
  marginBottom: '8px',
  color: '#333'
};

const inputWrapperStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};

const inputStyle = {
  width: '150px',
  padding: '10px 12px',
  fontSize: '16px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  outline: 'none'
};

const unitStyle = {
  fontSize: '14px',
  color: '#666'
};

const helpTextStyle = {
  fontSize: '13px',
  color: '#888',
  marginTop: '8px'
};

const infoBoxStyle = {
  backgroundColor: '#f8f9fa',
  padding: '16px',
  borderRadius: '6px',
  fontSize: '14px',
  color: '#555',
  marginTop: '16px'
};

const buttonContainerStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: '24px'
};

const submitButtonStyle = {
  padding: '12px 32px',
  fontSize: '15px',
  fontWeight: '600',
  color: '#fff',
  backgroundColor: '#2563eb',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer'
};

export default AdminPointsSettings;
