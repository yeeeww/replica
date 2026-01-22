import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNotice, createNotice, updateNotice, uploadImages } from '../../services/api';

const AdminNoticeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const contentRef = useRef(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_pinned: false
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState([]);

  const fetchNotice = useCallback(async () => {
    try {
      const response = await getNotice(id);
      const notice = response.data.notice;
      setFormData({
        title: notice.title,
        content: notice.content,
        is_pinned: notice.is_pinned || false
      });
      if (notice.attachments) {
        setAttachments(JSON.parse(notice.attachments) || []);
      }
    } catch (error) {
      console.error('Failed to fetch notice:', error);
      setError('공지사항을 불러오는데 실패했습니다.');
    }
  }, [id]);

  useEffect(() => {
    if (isEdit) {
      fetchNotice();
    }
  }, [isEdit, fetchNotice]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // 텍스트 서식 적용
  const applyFormat = (tag, className = '') => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.content.substring(start, end);
    
    let formattedText = '';
    let cursorOffset = 0;

    switch (tag) {
      case 'bold':
        formattedText = `<b>${selectedText}</b>`;
        cursorOffset = 3;
        break;
      case 'italic':
        formattedText = `<i>${selectedText}</i>`;
        cursorOffset = 3;
        break;
      case 'underline':
        formattedText = `<u>${selectedText}</u>`;
        cursorOffset = 3;
        break;
      case 'strike':
        formattedText = `<s>${selectedText}</s>`;
        cursorOffset = 3;
        break;
      case 'h1':
        formattedText = `<h1>${selectedText}</h1>`;
        cursorOffset = 4;
        break;
      case 'h2':
        formattedText = `<h2>${selectedText}</h2>`;
        cursorOffset = 4;
        break;
      case 'h3':
        formattedText = `<h3>${selectedText}</h3>`;
        cursorOffset = 4;
        break;
      case 'color':
        formattedText = `<span style="color:${className}">${selectedText}</span>`;
        cursorOffset = 20 + className.length;
        break;
      case 'bgcolor':
        formattedText = `<span style="background-color:${className}">${selectedText}</span>`;
        cursorOffset = 31 + className.length;
        break;
      case 'size':
        formattedText = `<span style="font-size:${className}">${selectedText}</span>`;
        cursorOffset = 23 + className.length;
        break;
      case 'align':
        formattedText = `<div style="text-align:${className}">${selectedText}</div>`;
        cursorOffset = 24 + className.length;
        break;
      case 'ul':
        formattedText = `<ul>\n  <li>${selectedText}</li>\n</ul>`;
        cursorOffset = 10;
        break;
      case 'ol':
        formattedText = `<ol>\n  <li>${selectedText}</li>\n</ol>`;
        cursorOffset = 10;
        break;
      case 'link':
        const url = prompt('링크 URL을 입력하세요:', 'https://');
        if (url) {
          formattedText = `<a href="${url}" target="_blank">${selectedText || url}</a>`;
          cursorOffset = 9 + url.length;
        } else {
          return;
        }
        break;
      case 'hr':
        formattedText = `${selectedText}\n<hr>\n`;
        cursorOffset = 0;
        break;
      case 'br':
        formattedText = `${selectedText}<br>\n`;
        cursorOffset = 0;
        break;
      case 'quote':
        formattedText = `<blockquote style="border-left:4px solid #ddd;padding-left:16px;margin:16px 0;color:#666">${selectedText}</blockquote>`;
        cursorOffset = 90;
        break;
      case 'code':
        formattedText = `<pre style="background:#f5f5f5;padding:12px;border-radius:4px;overflow-x:auto"><code>${selectedText}</code></pre>`;
        cursorOffset = 85;
        break;
      default:
        return;
    }

    const newContent = formData.content.substring(0, start) + formattedText + formData.content.substring(end);
    setFormData({ ...formData, content: newContent });

    // 커서 위치 조정
    setTimeout(() => {
      textarea.focus();
      const newPos = start + (selectedText ? formattedText.length : cursorOffset);
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // 이미지 삽입
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const response = await uploadImages(files);
      const uploadedFiles = response.data.files;

      // 이미지 태그 생성
      const imageTags = uploadedFiles.map(file => 
        `<img src="${file.url}" alt="${file.originalname}" style="max-width:100%;height:auto;margin:8px 0">`
      ).join('\n');

      // 현재 커서 위치에 삽입
      const textarea = contentRef.current;
      const start = textarea?.selectionStart || formData.content.length;
      const newContent = formData.content.substring(0, start) + '\n' + imageTags + '\n' + formData.content.substring(start);
      setFormData({ ...formData, content: newContent });

    } catch (error) {
      console.error('Image upload failed:', error);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // 첨부파일 업로드
  const handleAttachmentUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const response = await uploadImages(files);
      const uploadedFiles = response.data.files.map(file => ({
        url: file.url,
        name: file.originalname,
        size: file.size
      }));
      setAttachments(prev => [...prev, ...uploadedFiles]);
    } catch (error) {
      console.error('Attachment upload failed:', error);
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // 첨부파일 삭제
  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        attachments: JSON.stringify(attachments)
      };

      if (isEdit) {
        await updateNotice(id, submitData);
        alert('공지사항이 수정되었습니다.');
      } else {
        await createNotice(submitData);
        alert('공지사항이 등록되었습니다.');
      }
      navigate('/admin/notices');
    } catch (error) {
      setError(error.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 툴바 버튼 스타일
  const toolbarBtnStyle = {
    padding: '6px 10px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    minWidth: '32px'
  };

  const toolbarGroupStyle = {
    display: 'flex',
    gap: '4px',
    alignItems: 'center'
  };

  const dividerStyle = {
    width: '1px',
    height: '24px',
    backgroundColor: '#ddd',
    margin: '0 8px'
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>{isEdit ? '공지사항 수정' : '새 공지사항'}</h1>
      </div>

      {error && <div className="error" style={{ marginBottom: '20px' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        {/* 제목 */}
        <div className="form-group">
          <label htmlFor="title">제목 *</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            placeholder="공지사항 제목을 입력하세요"
            style={{ fontSize: '16px', padding: '12px' }}
          />
        </div>

        {/* 에디터 툴바 */}
        <div className="form-group">
          <label>내용 *</label>
          
          {/* 툴바 */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            gap: '8px', 
            padding: '12px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px 8px 0 0',
            border: '1px solid #ddd',
            borderBottom: 'none'
          }}>
            {/* 제목 스타일 */}
            <div style={toolbarGroupStyle}>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('h1')} title="제목1">H1</button>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('h2')} title="제목2">H2</button>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('h3')} title="제목3">H3</button>
            </div>

            <div style={dividerStyle} />

            {/* 텍스트 스타일 */}
            <div style={toolbarGroupStyle}>
              <button type="button" style={{...toolbarBtnStyle, fontWeight: 'bold'}} onClick={() => applyFormat('bold')} title="굵게">B</button>
              <button type="button" style={{...toolbarBtnStyle, fontStyle: 'italic'}} onClick={() => applyFormat('italic')} title="기울임">I</button>
              <button type="button" style={{...toolbarBtnStyle, textDecoration: 'underline'}} onClick={() => applyFormat('underline')} title="밑줄">U</button>
              <button type="button" style={{...toolbarBtnStyle, textDecoration: 'line-through'}} onClick={() => applyFormat('strike')} title="취소선">S</button>
            </div>

            <div style={dividerStyle} />

            {/* 글자 색상 */}
            <div style={toolbarGroupStyle}>
              <select 
                onChange={(e) => e.target.value && applyFormat('color', e.target.value)} 
                style={{...toolbarBtnStyle, minWidth: '80px'}}
                defaultValue=""
              >
                <option value="">글자색</option>
                <option value="#000000">검정</option>
                <option value="#ff0000">빨강</option>
                <option value="#0000ff">파랑</option>
                <option value="#008000">초록</option>
                <option value="#ff6600">주황</option>
                <option value="#800080">보라</option>
                <option value="#666666">회색</option>
              </select>
              <select 
                onChange={(e) => e.target.value && applyFormat('bgcolor', e.target.value)} 
                style={{...toolbarBtnStyle, minWidth: '80px'}}
                defaultValue=""
              >
                <option value="">배경색</option>
                <option value="#ffff00">노랑</option>
                <option value="#00ff00">연두</option>
                <option value="#00ffff">하늘</option>
                <option value="#ffcccc">분홍</option>
                <option value="#f0f0f0">밝은회색</option>
              </select>
            </div>

            <div style={dividerStyle} />

            {/* 글자 크기 */}
            <div style={toolbarGroupStyle}>
              <select 
                onChange={(e) => e.target.value && applyFormat('size', e.target.value)} 
                style={{...toolbarBtnStyle, minWidth: '80px'}}
                defaultValue=""
              >
                <option value="">크기</option>
                <option value="12px">12px</option>
                <option value="14px">14px</option>
                <option value="16px">16px</option>
                <option value="18px">18px</option>
                <option value="20px">20px</option>
                <option value="24px">24px</option>
                <option value="28px">28px</option>
                <option value="32px">32px</option>
              </select>
            </div>

            <div style={dividerStyle} />

            {/* 정렬 */}
            <div style={toolbarGroupStyle}>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('align', 'left')} title="왼쪽 정렬">◀</button>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('align', 'center')} title="가운데 정렬">■</button>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('align', 'right')} title="오른쪽 정렬">▶</button>
            </div>

            <div style={dividerStyle} />

            {/* 목록 */}
            <div style={toolbarGroupStyle}>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('ul')} title="글머리 기호">•</button>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('ol')} title="번호 매기기">1.</button>
            </div>

            <div style={dividerStyle} />

            {/* 기타 */}
            <div style={toolbarGroupStyle}>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('link')} title="링크">🔗</button>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('hr')} title="구분선">―</button>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('quote')} title="인용">❝</button>
              <button type="button" style={toolbarBtnStyle} onClick={() => applyFormat('code')} title="코드">&lt;/&gt;</button>
            </div>

            <div style={dividerStyle} />

            {/* 이미지 업로드 */}
            <div style={toolbarGroupStyle}>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                id="image-upload"
              />
              <label 
                htmlFor="image-upload" 
                style={{...toolbarBtnStyle, backgroundColor: '#e7f3ff', cursor: uploading ? 'not-allowed' : 'pointer'}}
              >
                {uploading ? '업로드중...' : '🖼️ 이미지'}
              </label>
            </div>
          </div>

          {/* 내용 입력 */}
          <textarea
            ref={contentRef}
            id="content"
            name="content"
            value={formData.content}
            onChange={handleChange}
            required
            rows="20"
            placeholder="공지사항 내용을 입력하세요. HTML 태그를 사용할 수 있습니다."
            style={{ 
              minHeight: '400px',
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: '1.6',
              borderRadius: '0 0 8px 8px',
              borderTop: 'none'
            }}
          />

          <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            * 텍스트를 선택한 후 버튼을 클릭하면 서식이 적용됩니다. HTML 태그를 직접 입력할 수도 있습니다.
          </p>
        </div>

        {/* 미리보기 */}
        {formData.content && (
          <div className="form-group">
            <label>미리보기</label>
            <div 
              style={{ 
                padding: '20px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#fafafa',
                minHeight: '100px',
                maxHeight: '400px',
                overflow: 'auto'
              }}
              dangerouslySetInnerHTML={{ __html: formData.content }}
            />
          </div>
        )}

        {/* 첨부파일 */}
        <div className="form-group">
          <label>첨부파일</label>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            onChange={handleAttachmentUpload}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              marginBottom: '12px'
            }}
          >
            {uploading ? '업로드 중...' : '📎 파일 첨부'}
          </button>

          {attachments.length > 0 && (
            <div style={{ 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              padding: '12px',
              backgroundColor: '#f8f9fa'
            }}>
              {attachments.map((file, index) => (
                <div 
                  key={index} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    marginBottom: index < attachments.length - 1 ? '8px' : 0
                  }}
                >
                  <div>
                    <span style={{ fontWeight: '500' }}>📄 {file.name}</span>
                    <span style={{ color: '#666', fontSize: '12px', marginLeft: '12px' }}>
                      ({formatFileSize(file.size)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 상단 고정 */}
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="is_pinned"
              checked={formData.is_pinned}
              onChange={handleChange}
              style={{ width: '18px', height: '18px' }}
            />
            <span>상단 고정</span>
          </label>
        </div>

        {/* 버튼 */}
        <div className="form-actions" style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '저장 중...' : (isEdit ? '수정하기' : '등록하기')}
          </button>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => navigate('/admin/notices')}
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminNoticeForm;
