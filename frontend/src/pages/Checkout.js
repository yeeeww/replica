import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder, createGuestOrder, getPublicSettings, getImageUrl } from '../services/api';
import { formatPrice } from '../utils/format';
import './Checkout.css';

const BANK_INFO = {
  bank: 'im뱅크',
  account: '262-13-084376',
  holder: '장태승'
};

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, clearCart } = useCart();
  const { user, updateUserPoints, refreshUser, isAuthenticated } = useAuth();

  // 바로구매 또는 장바구니 구매 판별
  const buyNowData = location.state;
  const isBuyNow = buyNowData?.buyNow === true;
  const isGuest = !isAuthenticated;
  
  const [formData, setFormData] = useState({
    // 주문자 정보
    orderer_name: user?.name || '',
    orderer_phone: '',
    orderer_email: user?.email || '',
    // 배송 정보
    shipping_name: '',
    shipping_phone: '',
    shipping_zipcode: '',
    shipping_address: '',
    shipping_address_detail: '',
    shipping_memo: '',
    // 추가 정보
    customs_id: '', // 개인통관부호
    referral_source: '', // 알게 된 경로
    delivery_message: '', // 배송메세지
    // 결제
    depositor_name: '' // 입금자명
  });
  
  const [sameAsOrderer, setSameAsOrderer] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreePurchase, setAgreePurchase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 적립금 관련 상태
  const [usePoints, setUsePoints] = useState(0);
  const [pointsRate, setPointsRate] = useState(1); // 적립률 (%)
  const [userPoints, setUserPoints] = useState(0);

  // 적립률 설정 및 사용자 포인트 가져오기 (최초 1회만)
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 설정 가져오기
        const settingsResponse = await getPublicSettings();
        const rate = parseFloat(settingsResponse.data.settings?.purchase_points_rate) || 1;
        setPointsRate(rate);

        // 로그인 사용자만 포인트 가져오기
        if (isAuthenticated) {
          const updatedUser = await refreshUser();
          if (updatedUser?.points !== undefined) {
            setUserPoints(updatedUser.points);
          }
        }
      } catch (error) {
        console.error('데이터 로딩 실패:', error);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // 주문 상품 목록 계산
  const orderItems = useMemo(() => {
    if (isBuyNow && buyNowData?.item) {
      return [buyNowData.item];
    }
    return cart.items;
  }, [isBuyNow, buyNowData, cart.items]);

  // 주문 총액 계산
  const orderTotal = useMemo(() => {
    if (isBuyNow && buyNowData?.item) {
      return buyNowData.item.product_price * buyNowData.item.quantity;
    }
    return cart.total;
  }, [isBuyNow, buyNowData, cart.total]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSameAsOrderer = (e) => {
    const checked = e.target.checked;
    setSameAsOrderer(checked);
    if (checked) {
      setFormData({
        ...formData,
        shipping_name: formData.orderer_name,
        shipping_phone: formData.orderer_phone
      });
    }
  };

  // 다음 우편번호 검색
  const handleAddressSearch = () => {
    new window.daum.Postcode({
      oncomplete: function(data) {
        // 도로명 주소 또는 지번 주소
        let fullAddress = data.roadAddress || data.jibunAddress;
        let extraAddress = '';

        // 참고 항목 추가 (건물명 등)
        if (data.roadAddress) {
          if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
            extraAddress += data.bname;
          }
          if (data.buildingName !== '' && data.apartment === 'Y') {
            extraAddress += (extraAddress !== '' ? ', ' + data.buildingName : data.buildingName);
          }
          if (extraAddress !== '') {
            fullAddress += ' (' + extraAddress + ')';
          }
        }

        setFormData(prev => ({
          ...prev,
          shipping_zipcode: data.zonecode,
          shipping_address: fullAddress
        }));
      }
    }).open();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!agreePrivacy || !agreePurchase) {
      setError('모든 약관에 동의해주세요.');
      return;
    }

    if (!formData.depositor_name.trim()) {
      setError('입금자명을 입력해주세요.');
      return;
    }

    if (!formData.shipping_name || !formData.shipping_name.trim()) {
      setError('수령인 이름을 입력해주세요.');
      return;
    }

    if (!formData.shipping_phone || !formData.shipping_phone.trim()) {
      setError('수령인 연락처를 입력해주세요.');
      return;
    }

    if (!formData.shipping_address || !formData.shipping_address.trim()) {
      setError('배송 주소를 입력해주세요.');
      return;
    }

    if (!formData.customs_id || !formData.customs_id.trim()) {
      setError('개인통관부호를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const fullAddress = `${formData.shipping_zipcode} ${formData.shipping_address} ${formData.shipping_address_detail}`.trim();
      
      // 주문 상품 목록 생성
      const items = isBuyNow && buyNowData?.item
        ? [{ product_id: buyNowData.item.product_id, quantity: buyNowData.item.quantity }]
        : cart.items.map(item => ({ product_id: item.product_id, quantity: item.quantity }));

      const orderData = {
        shipping_name: formData.shipping_name,
        shipping_phone: formData.shipping_phone,
        shipping_address: fullAddress,
        items: items,
        // 추가 정보
        orderer_name: formData.orderer_name,
        orderer_phone: formData.orderer_phone,
        orderer_email: formData.orderer_email,
        customs_id: formData.customs_id,
        referral_source: formData.referral_source,
        delivery_message: formData.delivery_message,
        depositor_name: formData.depositor_name,
        shipping_memo: formData.shipping_memo,
        // 적립금 사용 (로그인 사용자만)
        use_points: isGuest ? 0 : usePoints
      };

      let response;
      
      if (isGuest) {
        // 비회원 주문
        response = await createGuestOrder(orderData);
        
        // 장바구니에서 주문한 경우 장바구니 비우기
        if (!isBuyNow) {
          await clearCart();
        }
        
        // 비회원 주문 완료 페이지로 이동
        navigate('/order-lookup', { 
          state: { 
            orderComplete: true,
            orderId: response.data.order.id,
            message: '주문이 완료되었습니다! 주문번호를 기억해주세요.'
          }
        });
      } else {
        // 회원 주문
        response = await createOrder(orderData);
        
        // 사용자 포인트 업데이트
        if (response.data.remainingPoints !== undefined) {
          updateUserPoints(response.data.remainingPoints);
        }

        // 바로구매가 아닌 경우 장바구니는 API에서 자동으로 처리됨
        
        navigate(`/orders/${response.data.order.id}`, { 
          state: { 
            message: '주문이 완료되었습니다! 무통장 입금 후 48시간 동안 미입금시 자동 취소됩니다.',
            pointsUsed: response.data.pointsUsed,
            pointsToEarn: response.data.pointsToEarn,
            bankInfo: BANK_INFO,
            finalAmount
          }
        });
      }
    } catch (error) {
      setError(error.response?.data?.message || '주문에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 적립금 사용량 변경 핸들러
  const handlePointsChange = (e) => {
    let value = parseInt(e.target.value) || 0;
    // 보유 포인트와 상품가격 중 작은 값으로 제한
    const maxUsable = Math.min(userPoints, orderTotal);
    value = Math.max(0, Math.min(value, maxUsable));
    setUsePoints(value);
  };

  // 전액 사용 버튼
  const handleUseAllPoints = () => {
    const maxUsable = Math.min(userPoints, orderTotal);
    setUsePoints(maxUsable);
  };

  // 최종 결제금액 계산
  const finalAmount = Math.max(0, orderTotal - (isGuest ? 0 : usePoints));
  
  // 적립 예정 포인트 (배송완료 시, 회원만)
  const earnPoints = isGuest ? 0 : Math.floor(finalAmount * (pointsRate / 100));

  // 주문할 상품이 없으면 리다이렉트
  if (orderItems.length === 0) {
    navigate('/cart');
    return null;
  }

  const shippingMemoOptions = [
    '배송메모를 선택해 주세요.',
    '부재시 경비실에 맡겨주세요.',
    '부재시 문앞에 놓아주세요.',
    '배송 전 연락 바랍니다.',
    '직접 입력'
  ];

  return (
    <div className="checkout-page">
      <div className="container">
        <h1 className="checkout-title">결제하기</h1>

        {error && <div className="checkout-error">{error}</div>}

        <div className="checkout-content">
          {/* 좌측: 주문 상품 정보 + 주문자 정보 + 배송 정보 + 추가정보 */}
          <div className="checkout-left">
            {/* 주문 상품 정보 */}
            <div className="checkout-section">
              <h2>주문 상품 정보</h2>
              <div className="checkout-products">
                {orderItems.map((item, index) => (
                  <div key={item.id || item.product_id || index} className="checkout-product">
                    <div className="checkout-product-image">
                      <img src={getImageUrl(item.image_url)} alt={item.name || item.product_name} />
                    </div>
                    <div className="checkout-product-info">
                      <p className="checkout-product-name">{item.name || item.product_name}</p>
                      <p className="checkout-product-option">
                        {item.options && `${item.options} / `}
                        20일이내수령 - {item.quantity}개
                      </p>
                      <p className="checkout-product-price">
                        {formatPrice((item.price || item.product_price) * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="checkout-shipping-fee">
                  <span>배송비</span>
                  <span><strong>무료</strong></span>
                </div>
              </div>
            </div>

            {/* 주문자 정보 */}
            <div className="checkout-section">
              <h2>주문자 정보</h2>
              <div className="checkout-notice">
                <p>😊😊카드결제 는 무통장 결제하기 진행후 결제란 나옵니다😊 😊</p>
                <p>① 해외상품주문시 성함,연락처,통관부호가 모두 일치하셔야 출고가 가능합니다.</p>
                <p>② 상품의 주문후 일정시간상태로 미결제시 주문이 자동취소 될 수 있습니다.</p>
                <p>③ 사이트에서만 주문이 가능하며 사이트외 어떠한경우라도 주문을 받지 않습니다.</p>
                <p className="checkout-notice-small">(사칭도용등의 문제 발생시 법적책임x)</p>
              </div>
              <div className="checkout-form-row">
                <div className="checkout-form-group">
                  <input
                    type="text"
                    name="orderer_name"
                    value={formData.orderer_name}
                    onChange={handleChange}
                    placeholder="이름"
                    required
                  />
                </div>
                <div className="checkout-form-group">
                  <input
                    type="tel"
                    name="orderer_phone"
                    value={formData.orderer_phone}
                    onChange={handleChange}
                    placeholder="연락처"
                    required
                  />
                </div>
              </div>
              <div className="checkout-form-group">
                <input
                  type="email"
                  name="orderer_email"
                  value={formData.orderer_email}
                  onChange={handleChange}
                  placeholder="이메일(선택)"
                />
              </div>
            </div>

            {/* 배송 정보 */}
            <div className="checkout-section">
              <h2>배송 정보 <span className="section-required">* 필수입력</span></h2>
              <label className="checkout-checkbox-label">
                <input
                  type="checkbox"
                  checked={sameAsOrderer}
                  onChange={handleSameAsOrderer}
                />
                <span>주문자 정보와 동일</span>
              </label>
              <div className="checkout-form-row">
                <div className="checkout-form-group">
                  <input
                    type="text"
                    name="shipping_name"
                    value={formData.shipping_name}
                    onChange={handleChange}
                    placeholder="수령인 *"
                    required
                  />
                </div>
                <div className="checkout-form-group">
                  <input
                    type="tel"
                    name="shipping_phone"
                    value={formData.shipping_phone}
                    onChange={handleChange}
                    placeholder="연락처 *"
                    required
                  />
                </div>
              </div>
              <div className="checkout-form-row">
                <div className="checkout-form-group checkout-zipcode">
                  <input
                    type="text"
                    name="shipping_zipcode"
                    value={formData.shipping_zipcode}
                    onChange={handleChange}
                    placeholder="우편번호"
                    readOnly
                    required
                  />
                </div>
                <button type="button" className="checkout-address-btn" onClick={handleAddressSearch}>주소찾기</button>
              </div>
              <div className="checkout-form-group">
                <input
                  type="text"
                  name="shipping_address"
                  value={formData.shipping_address}
                  onChange={handleChange}
                  placeholder="주소 *"
                  readOnly
                  required
                />
              </div>
              <div className="checkout-form-group">
                <input
                  type="text"
                  name="shipping_address_detail"
                  value={formData.shipping_address_detail}
                  onChange={handleChange}
                  placeholder="상세주소"
                />
              </div>
              <div className="checkout-form-group">
                <label className="checkout-label">배송메모</label>
                <select
                  name="shipping_memo"
                  value={formData.shipping_memo}
                  onChange={handleChange}
                  className="checkout-select"
                >
                  {shippingMemoOptions.map((option, idx) => (
                    <option key={idx} value={option === '배송메모를 선택해 주세요.' ? '' : option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 추가정보 입력 */}
            <div className="checkout-section">
              <h2>추가정보 입력</h2>
              <div className="checkout-notice checkout-notice-orange">
                <p>카드결제 원하시는 고객님은 무통장 선택하고 결제하기 -&gt; 잠시 기다리신 후 화면이 바뀌면 한번 더 결제하기 클릭 ! (결제창이 뜨면 카드사 선택후 결제하기) 결제 오류시 카카오톡 상담부탁드립니다 🙂</p>
              </div>
              <div className="checkout-form-group">
                <label className="checkout-label">개인 통관부호 입력 <span className="required-mark">*</span></label>
                <input
                  type="text"
                  name="customs_id"
                  value={formData.customs_id}
                  onChange={handleChange}
                  placeholder="P로 시작하는 13자리 (필수)"
                  required
                />
              </div>
              <div className="checkout-form-group">
                <label className="checkout-label">
                  알게 된 경로를 남겨주세요 예)구글검색/SNS/네이버/지인소개등
                  <span className="checkout-label-sub">첫 주문 고객님께만 결제확인후 5,000원 할인쿠폰을 증정해 드립니다.</span>
                </label>
                <input
                  type="text"
                  name="referral_source"
                  value={formData.referral_source}
                  onChange={handleChange}
                  placeholder="내용을 입력해주세요."
                />
              </div>
              <div className="checkout-form-group">
                <label className="checkout-label">배송메세지</label>
                <input
                  type="text"
                  name="delivery_message"
                  value={formData.delivery_message}
                  onChange={handleChange}
                  placeholder="내용을 입력해주세요."
                />
              </div>
            </div>
          </div>

          {/* 우측: 주문 요약 + 결제수단 + 약관 + 결제버튼 */}
          <div className="checkout-right">
            {/* 적립금 사용 (회원만) */}
            {!isGuest && (
              <div className="checkout-points-box">
                <h2>적립금 사용</h2>
                <div className="checkout-points-info">
                  <span>보유 적립금</span>
                  <span className="checkout-points-available">{userPoints.toLocaleString()}P</span>
                </div>
                <div className="checkout-points-input-row">
                  <input
                    type="number"
                    value={usePoints}
                    onChange={handlePointsChange}
                    min="0"
                    max={Math.min(userPoints, orderTotal)}
                    className="checkout-points-input"
                    placeholder="0"
                  />
                  <span className="checkout-points-unit">P</span>
                  <button 
                    type="button" 
                    className="checkout-points-all-btn"
                    onClick={handleUseAllPoints}
                    disabled={userPoints === 0}
                  >
                    전액사용
                  </button>
                </div>
                {usePoints > 0 && (
                  <p className="checkout-points-discount">
                    -{formatPrice(usePoints)} 할인 적용
                  </p>
                )}
              </div>
            )}

            {/* 비회원 안내 */}
            {isGuest && (
              <div className="checkout-guest-notice">
                <p>비회원 주문입니다.</p>
                <p className="sub">회원 가입 시 적립금 혜택을 받으실 수 있습니다.</p>
              </div>
            )}

            {/* 주문 요약 */}
            <div className="checkout-summary-box">
              <h2>주문 요약</h2>
              <div className="checkout-summary-row">
                <span>상품가격</span>
                <span>{formatPrice(orderTotal)}</span>
              </div>
              {!isGuest && usePoints > 0 && (
                <div className="checkout-summary-row checkout-summary-discount">
                  <span>적립금 사용</span>
                  <span>-{formatPrice(usePoints)}</span>
                </div>
              )}
              <div className="checkout-summary-row">
                <span>배송비</span>
                <span>무료</span>
              </div>
              <div className="checkout-summary-total">
                <span>총 결제금액</span>
                <span className="checkout-total-price">{formatPrice(finalAmount)}</span>
              </div>
              {!isGuest && (
                <div className="checkout-earn-points">
                  <span>적립 예정</span>
                  <span>{earnPoints.toLocaleString()}P</span>
                </div>
              )}
            </div>

            {/* 결제수단 */}
            <div className="checkout-payment-box">
              <h2>결제수단</h2>
              <label className="checkout-radio-label">
                <input type="radio" name="payment" checked readOnly />
                <span>무통장입금</span>
              </label>
              <div className="checkout-bank-info">
                <div className="checkout-bank-row">
                  <span>입금은행</span>
                  <strong>{BANK_INFO.bank}</strong>
                </div>
                <div className="checkout-bank-row">
                  <span>계좌번호</span>
                  <strong>{BANK_INFO.account}</strong>
                </div>
                <div className="checkout-bank-row">
                  <span>예금주</span>
                  <strong>{BANK_INFO.holder}</strong>
                </div>
                <div className="checkout-bank-row">
                  <span>결제금액</span>
                  <strong>{formatPrice(finalAmount)}</strong>
                </div>
              </div>
              <div className="checkout-form-group">
                <label className="checkout-required-label">
                  입금자명 <span className="required-mark">필수</span>
                </label>
                <input
                  type="text"
                  name="depositor_name"
                  value={formData.depositor_name}
                  onChange={handleChange}
                  placeholder="입금자명 (미입력시 주문자명)"
                />
              </div>
              <p className="checkout-payment-notice">주문 후 48시간 동안 미입금시 자동 취소됩니다.</p>
            </div>

            {/* 이용 및 정보 제공 약관 */}
            <div className="checkout-terms-box">
              <h2>이용 및 정보 제공 약관</h2>
              <p className="checkout-terms-desc">결제 전 이용 및 정보 제공 약관 등의 내용을 확인했으며 이에 동의합니다.</p>
              <label className="checkout-checkbox-label">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                />
                <span>개인정보 수집 및 이용 동의</span>
                <a href="#!" className="checkout-terms-link">자세히</a>
              </label>
              <label className="checkout-checkbox-label">
                <input
                  type="checkbox"
                  checked={agreePurchase}
                  onChange={(e) => setAgreePurchase(e.target.checked)}
                />
                <span>구매조건 확인 및 결제진행 동의</span>
              </label>
              <label className="checkout-checkbox-label checkout-checkbox-all">
                <input
                  type="checkbox"
                  checked={agreePrivacy && agreePurchase}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAgreePrivacy(checked);
                    setAgreePurchase(checked);
                  }}
                />
                <span>전체 동의</span>
              </label>
            </div>

            {/* 결제하기 버튼 */}
            <button 
              type="button"
              onClick={handleSubmit}
              className="checkout-submit-btn"
              disabled={loading}
            >
              {loading ? '주문 처리 중...' : '결제하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
