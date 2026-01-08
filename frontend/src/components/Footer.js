import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>MODERN SHOP</h3>
            <p>현대적이고 세련된 쇼핑 경험</p>
          </div>
          
          <div className="footer-section">
            <h4>고객 서비스</h4>
            <ul>
              <li><a href="#!">FAQ</a></li>
              <li><a href="#!">배송 정보</a></li>
              <li><a href="#!">반품 및 교환</a></li>
              <li><a href="#!">이용약관</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>회사 정보</h4>
            <ul>
              <li><a href="#!">회사 소개</a></li>
              <li><a href="#!">채용</a></li>
              <li><a href="#!">개인정보처리방침</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>문의</h4>
            <p>이메일: support@modernshop.com</p>
            <p>전화: 1588-0000</p>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; 2024 Modern Shop. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

