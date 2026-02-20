import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaSpinner, FaImage, FaPaperPlane } from 'react-icons/fa';
import { clientUpdatesService, FormBlock, SubmissionResponse } from '../services/client-updates.service';
import './ClientUpdateFormView.css';

const ClientUpdateFormView: React.FC = () => {
  const { publicToken } = useParams<{ publicToken: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [responses, setResponses] = useState<Record<string, SubmissionResponse>>({});
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (publicToken) {
      loadForm();
    }
  }, [publicToken]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const formData = await clientUpdatesService.getFormByToken(publicToken!);
      setForm(formData);
      
      // Initialize responses for each block
      const initialResponses: Record<string, SubmissionResponse> = {};
      formData.blocks.forEach((block: FormBlock) => {
        initialResponses[block.id] = {
          blockId: block.id,
          type: block.type,
          text: '',
          imageUrls: [],
        };
      });
      setResponses(initialResponses);
    } catch (error: any) {
      console.error('Failed to load form:', error);
      alert('Form not found or not available');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (blockId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [blockId]: {
        ...prev[blockId],
        text: value,
      },
    }));
  };

  const handleImageUpload = async (blockId: string, file: File) => {
    try {
      setUploadingImages(prev => ({ ...prev, [blockId]: true }));
      const url = await clientUpdatesService.uploadImagePublic(file);
      setResponses(prev => ({
        ...prev,
        [blockId]: {
          ...prev[blockId],
          imageUrls: [...(prev[blockId]?.imageUrls || []), url],
        },
      }));
    } catch (error) {
      alert('Failed to upload image');
    } finally {
      setUploadingImages(prev => ({ ...prev, [blockId]: false }));
    }
  };

  const removeImage = (blockId: string, imageUrl: string) => {
    setResponses(prev => ({
      ...prev,
      [blockId]: {
        ...prev[blockId],
        imageUrls: prev[blockId]?.imageUrls?.filter(url => url !== imageUrl) || [],
      },
    }));
  };

  // Function to detect and convert URLs to clickable links
  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#1a73e8',
              textDecoration: 'none',
              wordBreak: 'break-all',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Function to render paragraphs with proper separation
  const renderParagraphs = (content: string, bold: boolean = false) => {
    if (!content) return null;
    
    // Split by double newlines or single newlines for paragraph separation
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    
    if (paragraphs.length === 0) return null;
    
    return (
      <div style={{ marginBottom: '1rem' }}>
        {paragraphs.map((paragraph, index) => {
          // Further split by single newlines for line breaks within paragraphs
          const lines = paragraph.split('\n').filter(l => l.trim());
          
          return (
            <div key={index} style={{ marginBottom: index < paragraphs.length - 1 ? '1.5rem' : '0' }}>
              {lines.map((line, lineIndex) => (
                <p
                  key={lineIndex}
                  style={{
                    color: '#202124',
                    fontSize: '0.875rem',
                    lineHeight: '1.75',
                    marginBottom: lineIndex < lines.length - 1 ? '0.75rem' : '0',
                    fontWeight: bold ? 600 : 400,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {renderTextWithLinks(line.trim())}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const handleSubmit = async () => {
    if (!form) return;
    
    try {
      setSubmitting(true);
      const responseArray = Object.values(responses);
      await clientUpdatesService.submitForm(form.id, responseArray, clientName || undefined, clientEmail || undefined);
      setSubmitted(true);
    } catch (error: any) {
      console.error('Failed to submit form:', error);
      alert('Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <FaSpinner style={{ fontSize: '2rem', color: '#667eea', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading form...</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#64748b' }}>Form not found</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f9fafb'
      }}>
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: '3rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <FaCheckCircle style={{ fontSize: '3rem', color: '#10b981', marginBottom: '1rem' }} />
          <h2 style={{ color: '#1e293b', marginBottom: '0.5rem' }}>Thank You!</h2>
          <p style={{ color: '#64748b' }}>Your response has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f8f9fa',
      padding: '2rem 1rem'
    }}>
      <div style={{ 
        maxWidth: '760px', 
        margin: '0 auto',
        background: 'white',
        borderRadius: '8px',
        padding: '2rem',
        boxShadow: '0 2px 4px rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)'
      }}>
        <h1 style={{ 
          color: '#202124', 
          fontSize: '2rem', 
          fontWeight: 400,
          marginBottom: '0.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #dadce0'
        }}>
          {form.update?.project?.clientName ? `${form.update.project.clientName} - ` : ''}Project Update
        </h1>
        <p style={{ 
          color: '#5f6368', 
          fontSize: '0.875rem',
          marginBottom: '2rem',
          marginTop: '1rem'
        }}>
          Please fill out the form below to provide your feedback.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {form.blocks.map((block: FormBlock) => (
            <div key={block.id} style={{ 
              paddingBottom: '1.5rem',
              borderBottom: '1px solid #dadce0'
            }}>
              {/* Display block content */}
              {block.type === 'heading' && (
                <h2 style={{ 
                  color: '#202124', 
                  fontSize: '1rem', 
                  fontWeight: 500,
                  marginBottom: '1.5rem',
                  marginTop: '0.5rem'
                }}>
                  {block.content}
                </h2>
              )}

              {block.type === 'paragraph' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  {renderParagraphs(block.content || '', block.bold || false)}
                </div>
              )}

              {block.type === 'image' && block.imageUrl && (
                <img
                  src={block.imageUrl}
                  alt={block.imageAlt || ''}
                  style={{ 
                    maxWidth: '100%', 
                    borderRadius: '8px',
                    marginBottom: '1rem'
                  }}
                />
              )}

              {block.type === 'text_with_image' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {block.text && (
                      <div style={{ flex: 1, minWidth: '250px' }}>
                        {renderParagraphs(block.text, false)}
                      </div>
                    )}
                    {block.imageUrl && (
                      <img
                        src={block.imageUrl}
                        alt={block.imageAlt || ''}
                        style={{ 
                          maxWidth: '300px',
                          width: '100%',
                          borderRadius: '4px',
                          marginTop: '0.5rem'
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Response input */}
              {(block.type === 'paragraph' || block.type === 'text_with_image' || block.type === 'heading') && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    fontWeight: 400, 
                    marginBottom: '0.5rem',
                    color: '#202124',
                    fontSize: '0.875rem'
                  }}>
                    Your Response:
                  </label>
                  <textarea
                    value={responses[block.id]?.text || ''}
                    onChange={(e) => handleResponseChange(block.id, e.target.value)}
                    placeholder="Enter your response..."
                    style={{
                      width: '100%',
                      minHeight: '120px',
                      padding: '0.75rem',
                      border: '1px solid #dadce0',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      color: '#202124',
                      lineHeight: '1.5',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#673ab7';
                      e.target.style.outline = 'none';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#dadce0';
                    }}
                  />
                </div>
              )}

              {(block.type === 'image' || block.type === 'text_with_image') && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    fontWeight: 400, 
                    marginBottom: '0.75rem',
                    color: '#202124',
                    fontSize: '0.875rem'
                  }}>
                    Upload Images:
                  </label>
                  <div style={{
                    border: '1px dashed #dadce0',
                    borderRadius: '4px',
                    padding: '1.5rem',
                    textAlign: 'center',
                    background: '#f8f9fa',
                    marginBottom: '0.75rem',
                    cursor: 'pointer',
                    position: 'relative',
                  }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(block.id, file);
                        }
                      }}
                      disabled={uploadingImages[block.id]}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                      }}
                    />
                    {uploadingImages[block.id] ? (
                      <div>
                        <FaSpinner style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem', color: '#5f6368' }} />
                        <span style={{ fontSize: '0.875rem', color: '#5f6368' }}>Uploading...</span>
                      </div>
                    ) : (
                      <div>
                        <FaImage style={{ fontSize: '1.5rem', color: '#5f6368', marginBottom: '0.5rem' }} />
                        <p style={{ fontSize: '0.875rem', color: '#5f6368', margin: 0 }}>
                          Click to upload or drag and drop
                        </p>
                      </div>
                    )}
                  </div>
                  {responses[block.id]?.imageUrls && responses[block.id].imageUrls!.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.75rem' }}>
                      {responses[block.id].imageUrls!.map((url, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          <img
                            src={url}
                            alt={`Upload ${idx + 1}`}
                            style={{ 
                              width: '120px', 
                              height: '120px', 
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #dadce0'
                            }}
                          />
                          <button
                            onClick={() => removeImage(block.id, url)}
                            style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              background: '#d93025',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ 
          marginTop: '3rem', 
          paddingTop: '2rem',
          borderTop: '1px solid #dadce0'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              fontWeight: 400, 
              marginBottom: '0.5rem',
              color: '#202124',
              fontSize: '0.875rem'
            }}>
              Your Name (Optional):
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter your name"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                color: '#202124',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#673ab7';
                e.target.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#dadce0';
              }}
            />
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block', 
              fontWeight: 400, 
              marginBottom: '0.5rem',
              color: '#202124',
              fontSize: '0.875rem'
            }}>
              Your Email (Optional):
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="Enter your email"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                color: '#202124',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#673ab7';
                e.target.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#dadce0';
              }}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%',
              background: '#673ab7',
              color: 'white',
              border: 'none',
              padding: '0.875rem 1.5rem',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: submitting ? 0.6 : 1,
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = '#5e35b1';
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = '#673ab7';
              }
            }}
          >
            {submitting ? (
              <>
                <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
                Submitting...
              </>
            ) : (
              <>
                <FaPaperPlane />
                Submit Response
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ClientUpdateFormView;

