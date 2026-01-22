import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getOrder, updateOrderStatus } from '../../services/api';
import { formatPrice, formatDate, getOrderStatusText, getOrderStatusColor } from '../../utils/format';

// 택배사 목록
const SHIPPING_CARRIERS = [
  { code: '', name: '택배사 선택' },
  { code: 'cj', name: 'CJ대한통운' },
  { code: 'hanjin', name: '한진택배' },
  { code: 'lotte', name: '롯데택배' },
  { code: 'logen', name: '로젠택배' },
  { code: 'post', name: '우체국택배' },
  { code: 'ems', name: 'EMS' },
  { code: 'fedex', name: 'FedEx' },
  { code: 'ups', name: 'UPS' },
  { code: 'dhl', name: 'DHL' },
  { code: 'sf', name: 'SF익스프레스' },
  { code: 'etc', name: '기타' },
];

const getCarrierName = (code) => {
  const carrier = SHIPPING_CARRIERS.find(c => c.code === code);
  return carrier ? carrier.name : code;
};

const AdminOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 수정 가능한 필드
  const [status, setStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCarrier, setShippingCarrier] = useState('');
  const [adminMemo, setAdminMemo] = useState('');

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchOrder = async () => {
    try {
      const response = await getOrder(id);
      const orderData = response.data.order;
      setOrder(orderData);
      setStatus(orderData.status || 'pending');
      setTrackingNumber(orderData.tracking_number || '');
      setShippingCarrier(orderData.shipping_carrier || '');
      setAdminMemo(orderData.admin_memo || '');
    } catch (error) {
      console.error('Failed to fetch order:', error);
      alert('주문 정보를 불러올 수 없습니다.');
      navigate('/admin/orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrderStatus(id, {
        status,
        tracking_number: trackingNumber || null,
        shipping_carrier: shippingCarrier || null,
        admin_memo: adminMemo || null
      });
      alert('저장되었습니다.');
      fetchOrder();
    } catch (error) {
      alert(error.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">주문 정보를 불러오는 중...</div>;
  }

  if (!order) {
    return <div>주문을 찾을 수 없습니다.</div>;
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
    borderBottom: '1px solid #f0f0f0'
  };

  const labelStyle = {
    width: '140px',
    fontWeight: '500',
    color: '#666',
    flexShrink: 0
  };

  const valueStyle = {
    flex: 1,
    color: '#333'
  };

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>주문 상세 #{order.id}</h1>
          <span style={{ 
            display: 'inline-block',
            marginTop: '8px',
            padding: '4px 12px',
            borderRadius: '4px',
            backgroundColor: getOrderStatusColor(order.status) + '20',
            color: getOrderStatusColor(order.status),
            fontWeight: '500'
          }}>
            {getOrderStatusText(order.status)}
          </span>
        </div>
        <button
          onClick={() => navigate('/admin/orders')}
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
        {/* 주문 정보 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>주문 정보</h3>
          <div style={rowStyle}>
            <span style={labelStyle}>주문번호</span>
            <span style={valueStyle}>#{order.id}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>주문일시</span>
            <span style={valueStyle}>{formatDate(order.created_at)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>결제금액</span>
            <span style={{ ...valueStyle, fontWeight: '600', color: '#007bff' }}>
              {formatPrice(order.total_amount)}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>입금자명</span>
            <span style={valueStyle}>{order.depositor_name || '-'}</span>
          </div>
        </div>

        {/* 주문자 정보 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>주문자 정보</h3>
          <div style={rowStyle}>
            <span style={labelStyle}>이름</span>
            <span style={valueStyle}>{order.orderer_name || order.shipping_name || '-'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>연락처</span>
            <span style={valueStyle}>{order.orderer_phone || order.shipping_phone || '-'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>이메일</span>
            <span style={valueStyle}>{order.orderer_email || '-'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>회원 계정</span>
            <span style={valueStyle}>{order.user_email || '비회원'}</span>
          </div>
        </div>

        {/* 배송 정보 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>배송 정보</h3>
          <div style={rowStyle}>
            <span style={labelStyle}>수령인</span>
            <span style={valueStyle}>{order.shipping_name}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>연락처</span>
            <span style={valueStyle}>{order.shipping_phone}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>배송지</span>
            <span style={valueStyle}>{order.shipping_address}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>배송 메모</span>
            <span style={valueStyle}>{order.shipping_memo || '-'}</span>
          </div>
          <div style={{ ...rowStyle, backgroundColor: '#fff3cd', margin: '10px -20px -20px', padding: '15px 20px', borderRadius: '0 0 8px 8px' }}>
            <span style={{ ...labelStyle, color: '#856404' }}>개인통관부호</span>
            <span style={{ ...valueStyle, fontWeight: '600', color: '#856404' }}>
              {order.customs_id || '미입력'}
            </span>
          </div>
        </div>

        {/* 배송 처리 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>배송 처리</h3>
          <div style={rowStyle}>
            <span style={labelStyle}>주문 상태</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="pending">주문 접수</option>
              <option value="processing">처리중</option>
              <option value="shipped">배송중</option>
              <option value="delivered">배송 완료</option>
              <option value="cancelled">취소됨</option>
            </select>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>택배사</span>
            <select
              value={shippingCarrier}
              onChange={(e) => setShippingCarrier(e.target.value)}
              style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              {SHIPPING_CARRIERS.map((carrier) => (
                <option key={carrier.code} value={carrier.code}>
                  {carrier.name}
                </option>
              ))}
            </select>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>운송장 번호</span>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="운송장 번호 입력"
              style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          {order.tracking_number && (
            <div style={{ marginTop: '10px', textAlign: 'right' }}>
              <a 
                href={`https://trace.cjlogistics.com/web/detail.jsp?slipno=${order.tracking_number}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#007bff', fontSize: '13px' }}
              >
                배송 조회 →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 주문 상품 */}
      <div style={sectionStyle}>
        <h3 style={titleStyle}>주문 상품</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>상품명</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6', width: '100px' }}>옵션</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6', width: '120px' }}>단가</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6', width: '80px' }}>수량</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6', width: '120px' }}>소계</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px' }}>
                  <Link 
                    to={`/products/${item.product_id}`}
                    style={{ color: '#007bff', textDecoration: 'none' }}
                    target="_blank"
                  >
                    {item.product_name}
                  </Link>
                </td>
                <td style={{ padding: '12px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                  {item.selected_options || '-'}
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  {formatPrice(item.product_price)}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {item.quantity}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: '500' }}>
                  {formatPrice(item.product_price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <td colSpan="4" style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                총 결제금액
              </td>
              <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '16px', color: '#007bff' }}>
                {formatPrice(order.total_amount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 관리자 메모 */}
      <div style={sectionStyle}>
        <h3 style={titleStyle}>관리자 메모</h3>
        <textarea
          value={adminMemo}
          onChange={(e) => setAdminMemo(e.target.value)}
          placeholder="관리자 메모 (고객에게 노출되지 않음)"
          rows={4}
          style={{ 
            width: '100%', 
            padding: '12px', 
            border: '1px solid #ddd', 
            borderRadius: '4px',
            resize: 'vertical',
            fontSize: '14px'
          }}
        />
      </div>

      {/* 저장 버튼 */}
      <div style={{ textAlign: 'center', marginTop: '24px', marginBottom: '40px' }}>
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
          {saving ? '저장 중...' : '변경사항 저장'}
        </button>
      </div>
    </div>
  );
};

export default AdminOrderDetail;
