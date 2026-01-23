import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getUser, updateUser, updateUserPoints, getImageUrl } from '../../services/api';
import { formatPrice, formatDate, getOrderStatusText, getOrderStatusColor } from '../../utils/format';

const AdminUserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [pointsHistory, setPointsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 수정 가능한 필드
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'user',
    gender: '',
    address: '',
    birthDate: '',
    customsNumber: '',
    memo: '',
    is_active: true
  });

  // 적립금 지급/차감
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsDescription, setPointsDescription] = useState('');

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchUser = async () => {
    try {
      const response = await getUser(id);
      const userData = response.data.user;
      setUser(userData);
      setOrders(response.data.orders || []);
      setPointsHistory(response.data.pointsHistory || []);
      
      setFormData({
        name: userData.name || '',
        phone: userData.phone || '',
        role: userData.role || 'user',
        gender: userData.gender || '',
        address: userData.address || '',
        birthDate: userData.birth_date ? userData.birth_date.split('T')[0] : '',
        customsNumber: userData.customs_number || '',
        memo: userData.memo || '',
        is_active: userData.is_active !== false
      });
    } catch (error) {
      console.error('Failed to fetch user:', error);
      alert('회원 정보를 불러올 수 없습니다.');
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser(id, formData);
      alert('회원 정보가 수정되었습니다.');
      fetchUser();
    } catch (error) {
      alert(error.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handlePointsSubmit = async (isAdd) => {
    const amount = parseInt(pointsAmount);
    if (!amount || amount <= 0) {
      alert('금액을 입력해주세요.');
      return;
    }

    const finalAmount = isAdd ? amount : -amount;

    try {
      await updateUserPoints(id, {
        amount: finalAmount,
        type: isAdd ? 'add' : 'deduct',
        description: pointsDescription || (isAdd ? '관리자 지급' : '관리자 차감')
      });
      alert(isAdd ? '적립금이 지급되었습니다.' : '적립금이 차감되었습니다.');
      setPointsAmount('');
      setPointsDescription('');
      fetchUser();
    } catch (error) {
      alert(error.response?.data?.message || '처리에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="loading">회원 정보를 불러오는 중...</div>;
  }

  if (!user) {
    return <div>회원을 찾을 수 없습니다.</div>;
  }

  const sectionStyle = {
    backgroundColor: 'white',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px'
  };

  const titleStyle = {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '2px solid #333'
  };

  const rowStyle = {
    display: 'flex',
    padding: '10px 0',
    borderBottom: '1px solid #f0f0f0',
    alignItems: 'center'
  };

  const labelStyle = {
    width: '120px',
    fontWeight: '500',
    color: '#666',
    flexShrink: 0
  };

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>회원 상세 #{user.id}</h1>
          <span style={{ color: '#666', fontSize: '14px' }}>{user.email}</span>
        </div>
        <button
          onClick={() => navigate('/admin/users')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          목록으로
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* 기본 정보 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>기본 정보</h3>
          
          {/* 프로필 이미지 */}
          {user.profile_image && (
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <img 
                src={getImageUrl(user.profile_image)} 
                alt="프로필" 
                style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '50%', 
                  objectFit: 'cover',
                  border: '2px solid #ddd'
                }} 
              />
            </div>
          )}
          
          <div style={rowStyle}>
            <span style={labelStyle}>이메일</span>
            <span>{user.email}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>이름</span>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>연락처</span>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="010-0000-0000"
              style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>성별</span>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">선택안함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>생년월일</span>
            <input
              type="date"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleChange}
              style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>주소</span>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>개인통관부호</span>
            <input
              type="text"
              name="customsNumber"
              value={formData.customsNumber}
              onChange={handleChange}
              placeholder="P로 시작하는 13자리"
              style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>권한</span>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="user">일반회원</option>
              <option value="admin">관리자</option>
            </select>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>상태</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
              />
              활성 회원
            </label>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>가입일</span>
            <span>{formatDate(user.created_at)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>최근 로그인</span>
            <span>{user.last_login_at ? formatDate(user.last_login_at) : '-'}</span>
          </div>
        </div>

        {/* 구매 통계 & 적립금 */}
        <div>
          <div style={sectionStyle}>
            <h3 style={titleStyle}>구매 통계</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#007bff' }}>
                  {user.order_count || 0}건
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>총 주문수</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#28a745' }}>
                  {formatPrice(user.total_spent || 0)}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>총 구매액</div>
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={titleStyle}>적립금 관리</h3>
            <div style={{ 
              textAlign: 'center', 
              padding: '20px', 
              backgroundColor: '#fff3cd', 
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#856404' }}>
                {(user.points || 0).toLocaleString()}P
              </div>
              <div style={{ fontSize: '13px', color: '#856404', marginTop: '4px' }}>현재 적립금</div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="number"
                value={pointsAmount}
                onChange={(e) => setPointsAmount(e.target.value)}
                placeholder="금액"
                style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <button
                onClick={() => handlePointsSubmit(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                지급
              </button>
              <button
                onClick={() => handlePointsSubmit(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                차감
              </button>
            </div>
            <input
              type="text"
              value={pointsDescription}
              onChange={(e) => setPointsDescription(e.target.value)}
              placeholder="사유 (선택)"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
        </div>
      </div>

      {/* 관리자 메모 */}
      <div style={sectionStyle}>
        <h3 style={titleStyle}>관리자 메모</h3>
        <textarea
          name="memo"
          value={formData.memo}
          onChange={handleChange}
          placeholder="관리자 메모 (고객에게 노출되지 않음)"
          rows={3}
          style={{ 
            width: '100%', 
            padding: '12px', 
            border: '1px solid #ddd', 
            borderRadius: '4px',
            resize: 'vertical'
          }}
        />
      </div>

      {/* 저장 버튼 */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '12px 48px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          {saving ? '저장 중...' : '회원정보 저장'}
        </button>
      </div>

      {/* 최근 주문 내역 */}
      <div style={sectionStyle}>
        <h3 style={titleStyle}>최근 주문 내역</h3>
        {orders.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>주문번호</th>
                <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>금액</th>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>상태</th>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>주문일</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '10px' }}>
                    <Link to={`/admin/orders/${order.id}`} style={{ color: '#007bff' }}>
                      #{order.id}
                    </Link>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{formatPrice(order.total_amount)}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{ color: getOrderStatusColor(order.status) }}>
                      {getOrderStatusText(order.status)}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            주문 내역이 없습니다.
          </div>
        )}
      </div>

      {/* 적립금 내역 */}
      <div style={sectionStyle}>
        <h3 style={titleStyle}>적립금 내역</h3>
        {pointsHistory.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>일시</th>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>유형</th>
                <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>금액</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>사유</th>
                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>처리자</th>
              </tr>
            </thead>
            <tbody>
              {pointsHistory.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '10px', fontSize: '13px' }}>
                    {formatDate(item.created_at)}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: item.amount > 0 ? '#d4edda' : '#f8d7da',
                      color: item.amount > 0 ? '#155724' : '#721c24'
                    }}>
                      {item.amount > 0 ? '지급' : '차감'}
                    </span>
                  </td>
                  <td style={{ 
                    padding: '10px', 
                    textAlign: 'right',
                    fontWeight: '500',
                    color: item.amount > 0 ? '#28a745' : '#dc3545'
                  }}>
                    {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}P
                  </td>
                  <td style={{ padding: '10px', fontSize: '13px' }}>{item.description || '-'}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                    {item.admin_name || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            적립금 내역이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUserDetail;
