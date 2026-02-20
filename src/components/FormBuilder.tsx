import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaPlus, 
  FaTimes, 
  FaPaperPlane, 
  FaSave, 
  FaImage, 
  FaAlignLeft, 
  FaHeading, 
  FaFileImage,
  FaClipboardList,
  FaChevronUp,
  FaChevronDown,
  FaStar,
  FaFolder,
  FaPalette,
  FaEye,
  FaUndo,
  FaRedo,
  FaLink,
  FaUserPlus,
  FaEllipsisV,
  FaQuestionCircle,
  FaFileAlt,
  FaVideo,
  FaLayerGroup,
} from 'react-icons/fa';
import { clientUpdatesService, FormBlock, ClientUpdate, ClientUpdateForm } from '../services/client-updates.service';
import './FormBuilder.css';

const FormBuilder: React.FC = () => {
  const { projectId, updateId, formId } = useParams<{ projectId: string; updateId: string; formId?: string }>();
  const navigate = useNavigate();
  const [update, setUpdate] = useState<ClientUpdate | null>(null);
  const [form, setForm] = useState<ClientUpdateForm | null>(null);
  const [formBlocks, setFormBlocks] = useState<FormBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formTitle, setFormTitle] = useState('Untitled Form');
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishedFormUrl, setPublishedFormUrl] = useState('');
  const [isStarred, setIsStarred] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [formHistory, setFormHistory] = useState<FormBlock[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (updateId) {
      loadData();
    }
  }, [updateId, formId]);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMoreMenu) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMoreMenu]);

  const loadData = async () => {
    try {
      setLoading(true);
      const updateData = await clientUpdatesService.getOne(updateId!);
      setUpdate(updateData);

      if (formId) {
        // Editing existing form
        const formData = updateData.forms?.find((f: ClientUpdateForm) => f.id === formId);
        if (formData) {
          setForm(formData);
          const blocks = [...formData.blocks];
          setFormBlocks(blocks);
          setFormTitle(`Form - ${new Date(formData.createdAt).toLocaleDateString()}`);
          // Initialize history
          setFormHistory([JSON.parse(JSON.stringify(blocks))]);
          setHistoryIndex(0);
        }
      } else {
        // New form
        setFormBlocks([]);
        setFormTitle('Untitled Form');
        // Initialize history
        setFormHistory([[]]);
        setHistoryIndex(0);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      alert('Failed to load form data');
      navigate(`/project/${projectId}`);
    } finally {
      setLoading(false);
    }
  };

  const addFormBlock = (type: FormBlock['type']) => {
    const newBlock: FormBlock = {
      id: `block-${Date.now()}-${Math.random()}`,
      type,
      ...(type === 'paragraph' && { content: '', bold: false }),
      ...(type === 'heading' && { content: '' }),
      ...(type === 'image' && { imageUrl: '', imageAlt: '' }),
      ...(type === 'text_with_image' && { text: '', imageUrl: '', imageAlt: '' }),
      ...(type === 'layout' && { layout: { columns: 2, blocks: [] } }),
    };
    const newBlocks = [...formBlocks, newBlock];
    setFormBlocks(newBlocks);
    saveToHistory(newBlocks);
  };

  const updateFormBlock = (blockId: string, updates: Partial<FormBlock>) => {
    const newBlocks = formBlocks.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    );
    setFormBlocks(newBlocks);
    // Save to history for undo/redo
    saveToHistory(newBlocks);
  };

  const saveToHistory = (blocks: FormBlock[]) => {
    const newHistory = formHistory.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(blocks)));
    setFormHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const previousBlocks = formHistory[historyIndex - 1];
      setFormBlocks(JSON.parse(JSON.stringify(previousBlocks)));
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < formHistory.length - 1) {
      const nextBlocks = formHistory[historyIndex + 1];
      setFormBlocks(JSON.parse(JSON.stringify(nextBlocks)));
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handlePreview = () => {
    if (form?.isPublished && form?.publicToken) {
      const previewUrl = `${window.location.origin}/client-updates/forms/${form.publicToken}`;
      window.open(previewUrl, '_blank');
    } else {
      alert('Please publish the form first to preview it');
    }
  };

  const handleGetLink = () => {
    if (form?.isPublished && form?.publicToken) {
      const formUrl = `${window.location.origin}/client-updates/forms/${form.publicToken}`;
      setPublishedFormUrl(formUrl);
      setShowLinkModal(true);
      navigator.clipboard.writeText(formUrl);
    } else {
      alert('Please publish the form first to get a shareable link');
    }
  };

  const removeFormBlock = (blockId: string) => {
    const newBlocks = formBlocks.filter(block => block.id !== blockId);
    setFormBlocks(newBlocks);
    saveToHistory(newBlocks);
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const index = formBlocks.findIndex(b => b.id === blockId);
    if (index === -1) return;

    let newBlocks: FormBlock[];
    if (direction === 'up' && index > 0) {
      newBlocks = [...formBlocks];
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    } else if (direction === 'down' && index < formBlocks.length - 1) {
      newBlocks = [...formBlocks];
      [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
    } else {
      return;
    }
    setFormBlocks(newBlocks);
    saveToHistory(newBlocks);
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    try {
      setUploadingImage(true);
      const url = await clientUpdatesService.uploadImage(file);
      return url;
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDrop = async (e: React.DragEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverBlockId(null);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (imageFile) {
      try {
        const url = await handleImageUpload(imageFile);
        updateFormBlock(blockId, { imageUrl: url });
      } catch (error) {
        alert('Failed to upload image');
      }
    } else {
      alert('Please drop an image file');
    }
  };

  const handleDragOver = (e: React.DragEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverBlockId(blockId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverBlockId(null);
  };

  const handleSave = async () => {
    if (!updateId || formBlocks.length === 0) {
      alert('Please add at least one block to the form');
      return;
    }

    try {
      setSaving(true);
      if (form) {
        // Update existing form
        await clientUpdatesService.updateForm(form.id, formBlocks);
        alert('Form saved successfully!');
      } else {
        // Create new form
        const newForm = await clientUpdatesService.createForm(updateId, formBlocks);
        setForm(newForm);
        // Update URL to include formId
        navigate(`/project/${projectId}/form-builder/${updateId}/${newForm.id}`, { replace: true });
        alert('Form created successfully!');
      }
    } catch (error: any) {
      console.error('Failed to save form:', error);
      alert('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!form) {
      // Save first if it's a new form
      await handleSave();
      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!form) {
        alert('Please save the form first');
        return;
      }
    }

    if (formBlocks.length === 0) {
      alert('Please add at least one block to the form');
      return;
    }

    try {
      setPublishing(true);
      await clientUpdatesService.publishForm(form.id);
      const formUrl = `${window.location.origin}/client-updates/forms/${form.publicToken}`;
      
      // Copy URL to clipboard
      navigator.clipboard.writeText(formUrl);
      
      // Show modal with the URL
      setPublishedFormUrl(formUrl);
      setShowPublishModal(true);
      
      // Reload to get updated form data
      await loadData();
    } catch (error: any) {
      console.error('Failed to publish form:', error);
      alert('Failed to publish form');
    } finally {
      setPublishing(false);
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
          <p style={{ color: '#64748b' }}>Loading form builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Top Header Bar - Google Forms Style */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #dadce0',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 2px rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <button
            onClick={() => navigate(`/project/${projectId}`)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              color: '#5f6368',
              borderRadius: '50%',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f3f4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <FaArrowLeft style={{ fontSize: '1.125rem' }} />
          </button>
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              fontSize: '1.125rem',
              fontWeight: 400,
              color: '#202124',
              background: 'transparent',
              flex: 1,
              minWidth: '200px',
              padding: '0.25rem 0.5rem',
            }}
            placeholder="Untitled Form"
          />
          <button
            onClick={() => setIsStarred(!isStarred)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: isStarred ? '#fbbf24' : '#5f6368',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f3f4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
          >
            <FaStar style={{ fontSize: '1.125rem', fill: isStarred ? '#fbbf24' : 'none' }} />
          </button>
          <button
            onClick={() => alert('Move to folder feature coming soon')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#5f6368',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f3f4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Move to folder"
          >
            <FaFolder style={{ fontSize: '1.125rem' }} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          <button
            onClick={() => setShowThemeModal(true)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#5f6368',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f3f4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Customize theme"
          >
            <FaPalette style={{ fontSize: '1.125rem' }} />
          </button>
          <button
            onClick={handlePreview}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#5f6368',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f3f4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Preview"
          >
            <FaEye style={{ fontSize: '1.125rem' }} />
          </button>
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
              padding: '0.5rem',
              color: historyIndex <= 0 ? '#dadce0' : '#5f6368',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              if (historyIndex > 0) {
                e.currentTarget.style.background = '#f1f3f4';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Undo"
          >
            <FaUndo style={{ fontSize: '1.125rem' }} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= formHistory.length - 1}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: historyIndex >= formHistory.length - 1 ? 'not-allowed' : 'pointer',
              padding: '0.5rem',
              color: historyIndex >= formHistory.length - 1 ? '#dadce0' : '#5f6368',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              if (historyIndex < formHistory.length - 1) {
                e.currentTarget.style.background = '#f1f3f4';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Redo"
          >
            <FaRedo style={{ fontSize: '1.125rem' }} />
          </button>
          <button
            onClick={handleGetLink}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#5f6368',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f3f4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Get link"
          >
            <FaLink style={{ fontSize: '1.125rem' }} />
          </button>
          <button
            onClick={() => setShowCollaboratorsModal(true)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#5f6368',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f3f4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Add collaborators"
          >
            <FaUserPlus style={{ fontSize: '1.125rem' }} />
          </button>
          {form?.isPublished ? (
            <button
              style={{
                background: '#673ab7',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              Published
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing || formBlocks.length === 0}
              style={{
                background: '#673ab7',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: publishing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                opacity: publishing || formBlocks.length === 0 ? 0.6 : 1,
              }}
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                color: '#5f6368',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f3f4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              title="More options"
            >
              <FaEllipsisV style={{ fontSize: '1.125rem' }} />
            </button>
            {showMoreMenu && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                background: 'white',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)',
                padding: '0.5rem 0',
                marginTop: '0.25rem',
                minWidth: '200px',
                zIndex: 1000,
              }}>
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    alert('Make a copy feature coming soon');
                  }}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    padding: '0.625rem 1rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    color: '#202124',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f3f4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Make a copy
                </button>
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    if (form) {
                      if (window.confirm('Are you sure you want to delete this form?')) {
                        alert('Delete feature coming soon');
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    padding: '0.625rem 1rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    color: '#d93025',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fce8e6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #dadce0',
        padding: '0 1rem',
        display: 'flex',
        gap: '2rem',
        position: 'sticky',
        top: '48px',
        zIndex: 99,
      }}>
        <button
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '3px solid #673ab7',
            padding: '0.75rem 0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#673ab7',
            cursor: 'pointer',
          }}
        >
          Questions
        </button>
        <button
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '3px solid transparent',
            padding: '0.75rem 0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#5f6368',
            cursor: 'pointer',
          }}
        >
          Responses
        </button>
        <button
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '3px solid transparent',
            padding: '0.75rem 0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#5f6368',
            cursor: 'pointer',
          }}
        >
          Settings
        </button>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 96px)', background: '#f8f9fa' }}>
        {/* Right Sidebar - Google Forms Style */}
        <div style={{
          width: '64px',
          background: 'white',
          borderLeft: '1px solid #dadce0',
          padding: '0.5rem 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          position: 'fixed',
          right: 0,
          top: '96px',
          bottom: 0,
          zIndex: 10,
        }}>
          {[
            { icon: FaPlus, label: 'Add question', color: '#5f6368' },
            { icon: FaFileAlt, label: 'Import questions', color: '#5f6368' },
            { icon: FaHeading, label: 'Add title and description', color: '#5f6368' },
            { icon: FaImage, label: 'Add image', color: '#5f6368' },
            { icon: FaVideo, label: 'Add video', color: '#5f6368' },
            { icon: FaLayerGroup, label: 'Add section', color: '#5f6368' },
          ].map((item, index) => {
            const IconComponent = item.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  if (index === 0) addFormBlock('paragraph');
                  else if (index === 2) addFormBlock('heading');
                  else if (index === 3) addFormBlock('image');
                  else if (index === 5) addFormBlock('text_with_image');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0.75rem',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: item.color,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f3f4';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                title={item.label}
              >
                <IconComponent style={{ fontSize: '1.25rem' }} />
              </button>
            );
          })}
        </div>

        {/* Form Builder Area */}
        <div style={{ 
          flex: 1, 
          padding: '2rem', 
          overflowY: 'auto',
          marginRight: '64px',
        }}>
          <div style={{
            maxWidth: '760px',
            margin: '0 auto',
            background: 'white',
            borderRadius: '8px',
            padding: '2rem',
            boxShadow: '0 2px 4px rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)',
          }}>
            {/* Form Title */}
            <div style={{
              fontSize: '2rem',
              fontWeight: 400,
              color: '#202124',
              marginBottom: '0.5rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #dadce0',
            }}>
              {formTitle || 'Untitled Form'}
            </div>
            {formBlocks.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                color: '#5f6368',
              }}>
                <FaClipboardList style={{ fontSize: '4rem', color: '#dadce0', marginBottom: '1.5rem' }} />
                <h3 style={{ fontSize: '1.5rem', fontWeight: 400, marginBottom: '0.5rem', color: '#202124' }}>
                  Your form has no questions
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#5f6368', marginBottom: '1.5rem' }}>
                  Click the buttons on the right to add questions, titles, images, and more
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {formBlocks.map((block, index) => (
                  <div
                    key={block.id}
                    style={{
                      border: '1px solid #dadce0',
                      borderRadius: '4px',
                      padding: '1.5rem',
                      background: 'white',
                      position: 'relative',
                      transition: 'all 0.2s ease',
                      marginBottom: '1rem',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#673ab7';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#dadce0';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Block Controls */}
                    <div style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      display: 'flex',
                      gap: '0.25rem',
                      background: 'white',
                      borderRadius: '6px',
                      padding: '0.25rem',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    }}>
                      <button
                        onClick={() => moveBlock(block.id, 'up')}
                        disabled={index === 0}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                          padding: '0.25rem 0.5rem',
                          opacity: index === 0 ? 0.3 : 1,
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Move up"
                      >
                        <FaChevronUp />
                      </button>
                      <button
                        onClick={() => moveBlock(block.id, 'down')}
                        disabled={index === formBlocks.length - 1}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: index === formBlocks.length - 1 ? 'not-allowed' : 'pointer',
                          padding: '0.25rem 0.5rem',
                          opacity: index === formBlocks.length - 1 ? 0.3 : 1,
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Move down"
                      >
                        <FaChevronDown />
                      </button>
                      <button
                        onClick={() => removeFormBlock(block.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.25rem 0.5rem',
                          color: '#ef4444',
                        }}
                        title="Delete"
                      >
                        <FaTimes />
                      </button>
                    </div>

                    {/* Block Content */}
                    <div style={{ marginRight: '120px' }}>
                      {block.type === 'paragraph' && (
                        <div>
                          <textarea
                            value={block.content || ''}
                            onChange={(e) => updateFormBlock(block.id, { content: e.target.value })}
                            placeholder="Paragraph text"
                            style={{
                              width: '100%',
                              minHeight: '120px',
                              padding: '0.75rem 0',
                              border: 'none',
                              borderBottom: '1px solid #dadce0',
                              borderRadius: '0',
                              fontSize: '0.875rem',
                              fontFamily: 'inherit',
                              lineHeight: '1.75',
                              color: '#202124',
                              background: 'transparent',
                            }}
                            onFocus={(e) => {
                              e.target.style.borderBottomColor = '#673ab7';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderBottomColor = '#dadce0';
                            }}
                          />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={block.bold || false}
                              onChange={(e) => updateFormBlock(block.id, { bold: e.target.checked })}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.875rem', color: '#5f6368' }}>Bold text</span>
                          </label>
                        </div>
                      )}

                      {block.type === 'heading' && (
                        <input
                          type="text"
                          value={block.content || ''}
                          onChange={(e) => updateFormBlock(block.id, { content: e.target.value })}
                          placeholder="Untitled Question"
                          style={{
                            width: '100%',
                            padding: '0.5rem 0',
                            border: 'none',
                            borderBottom: '1px solid #dadce0',
                            borderRadius: '0',
                            fontSize: '1rem',
                            fontWeight: 500,
                            fontFamily: 'inherit',
                            color: '#202124',
                            background: 'transparent',
                          }}
                          onFocus={(e) => {
                            e.target.style.borderBottomColor = '#673ab7';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderBottomColor = '#dadce0';
                          }}
                        />
                      )}

                      {block.type === 'image' && (
                        <div>
                          <div
                            onDrop={(e) => handleDrop(e, block.id)}
                            onDragOver={(e) => handleDragOver(e, block.id)}
                            onDragLeave={handleDragLeave}
                            style={{
                              border: dragOverBlockId === block.id 
                                ? '2px dashed #673ab7' 
                                : '2px dashed #dadce0',
                              borderRadius: '4px',
                              padding: '2rem',
                              textAlign: 'center',
                              background: dragOverBlockId === block.id 
                                ? '#f3e5f5' 
                                : block.imageUrl ? 'transparent' : '#f8f9fa',
                              marginBottom: '0.75rem',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer',
                            }}
                          >
                            {block.imageUrl ? (
                              <div>
                                <img
                                  src={block.imageUrl}
                                  alt={block.imageAlt || ''}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '400px',
                                    borderRadius: '8px',
                                    marginBottom: '0.75rem',
                                  }}
                                />
                                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                  Drag a new image here to replace, or click to browse
                                </div>
                              </div>
                            ) : (
                              <div>
                                <FaImage style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '0.5rem' }} />
                                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                  {dragOverBlockId === block.id 
                                    ? 'Drop image here' 
                                    : 'Drag & drop an image here, or click to browse'}
                                </p>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const url = await handleImageUpload(file);
                                    updateFormBlock(block.id, { imageUrl: url });
                                  } catch (error) {
                                    alert('Failed to upload image');
                                  }
                                }
                              }}
                              style={{ 
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                top: 0,
                                left: 0,
                                opacity: 0,
                                cursor: 'pointer',
                              }}
                              disabled={uploadingImage}
                            />
                          </div>
                          {uploadingImage && (
                            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                              Uploading...
                            </p>
                          )}
                          <input
                            type="text"
                            value={block.imageAlt || ''}
                            onChange={(e) => updateFormBlock(block.id, { imageAlt: e.target.value })}
                            placeholder="Image description (optional)"
                            style={{
                              width: '100%',
                              padding: '0.5rem 0',
                              border: 'none',
                              borderBottom: '1px solid #dadce0',
                              borderRadius: '0',
                              fontSize: '0.875rem',
                              fontFamily: 'inherit',
                              color: '#5f6368',
                              background: 'transparent',
                            }}
                            onFocus={(e) => {
                              e.target.style.borderBottomColor = '#673ab7';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderBottomColor = '#dadce0';
                            }}
                          />
                        </div>
                      )}

                      {block.type === 'text_with_image' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <textarea
                            value={block.text || ''}
                            onChange={(e) => updateFormBlock(block.id, { text: e.target.value })}
                            placeholder="Text content"
                            style={{
                              width: '100%',
                              minHeight: '100px',
                              padding: '0.75rem 0',
                              border: 'none',
                              borderBottom: '1px solid #dadce0',
                              borderRadius: '0',
                              fontSize: '0.875rem',
                              fontFamily: 'inherit',
                              lineHeight: '1.75',
                              color: '#202124',
                              background: 'transparent',
                            }}
                            onFocus={(e) => {
                              e.target.style.borderBottomColor = '#673ab7';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderBottomColor = '#dadce0';
                            }}
                          />
                          <div
                            onDrop={(e) => handleDrop(e, block.id)}
                            onDragOver={(e) => handleDragOver(e, block.id)}
                            onDragLeave={handleDragLeave}
                            style={{
                              border: dragOverBlockId === block.id 
                                ? '2px dashed #673ab7' 
                                : '2px dashed #dadce0',
                              borderRadius: '4px',
                              padding: block.imageUrl ? '0.5rem' : '2rem',
                              textAlign: 'center',
                              background: dragOverBlockId === block.id 
                                ? '#f3e5f5' 
                                : block.imageUrl ? 'transparent' : '#f8f9fa',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer',
                              position: 'relative',
                            }}
                          >
                            {block.imageUrl ? (
                              <div>
                                <img
                                  src={block.imageUrl}
                                  alt={block.imageAlt || ''}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '300px',
                                    borderRadius: '8px',
                                    marginBottom: '0.5rem',
                                  }}
                                />
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  Drag a new image here to replace, or click to browse
                                </div>
                              </div>
                            ) : (
                              <div>
                                <FaImage style={{ fontSize: '1.5rem', color: '#94a3b8', marginBottom: '0.5rem' }} />
                                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                  {dragOverBlockId === block.id 
                                    ? 'Drop image here' 
                                    : 'Drag & drop an image here, or click to browse'}
                                </p>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const url = await handleImageUpload(file);
                                    updateFormBlock(block.id, { imageUrl: url });
                                  } catch (error) {
                                    alert('Failed to upload image');
                                  }
                                }
                              }}
                              style={{ 
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                top: 0,
                                left: 0,
                                opacity: 0,
                                cursor: 'pointer',
                              }}
                              disabled={uploadingImage}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Publish Success Modal */}
      {showPublishModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowPublishModal(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 10px 20px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 500,
              color: '#202124',
              marginBottom: '1rem',
            }}>
              Form Published!
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: '#5f6368',
              marginBottom: '1.5rem',
            }}>
              Your form has been published and the URL has been copied to your clipboard.
            </p>
            <div style={{
              background: '#f8f9fa',
              border: '1px solid #dadce0',
              borderRadius: '4px',
              padding: '1rem',
              marginBottom: '1.5rem',
              wordBreak: 'break-all',
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: '#5f6368',
                marginBottom: '0.5rem',
                fontWeight: 500,
              }}>
                Share this URL with your client:
              </p>
              <p style={{
                fontSize: '0.875rem',
                color: '#202124',
                fontFamily: 'monospace',
                lineHeight: '1.5',
              }}>
                {publishedFormUrl}
              </p>
            </div>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(publishedFormUrl);
                  alert('URL copied to clipboard!');
                }}
                style={{
                  background: '#f1f3f4',
                  border: '1px solid #dadce0',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: '#202124',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e8eaed';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f1f3f4';
                }}
              >
                Copy URL Again
              </button>
              <button
                onClick={() => setShowPublishModal(false)}
                style={{
                  background: '#673ab7',
                  color: 'white',
                  border: 'none',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#5e35b1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#673ab7';
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowLinkModal(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 10px 20px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 500,
              color: '#202124',
              marginBottom: '1rem',
            }}>
              Get Link
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: '#5f6368',
              marginBottom: '1.5rem',
            }}>
              Share this link with your client. The link has been copied to your clipboard.
            </p>
            <div style={{
              background: '#f8f9fa',
              border: '1px solid #dadce0',
              borderRadius: '4px',
              padding: '1rem',
              marginBottom: '1.5rem',
              wordBreak: 'break-all',
            }}>
              <p style={{
                fontSize: '0.875rem',
                color: '#202124',
                fontFamily: 'monospace',
                lineHeight: '1.5',
              }}>
                {publishedFormUrl}
              </p>
            </div>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(publishedFormUrl);
                  alert('URL copied to clipboard!');
                }}
                style={{
                  background: '#f1f3f4',
                  border: '1px solid #dadce0',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: '#202124',
                }}
              >
                Copy Again
              </button>
              <button
                onClick={() => setShowLinkModal(false)}
                style={{
                  background: '#673ab7',
                  color: 'white',
                  border: 'none',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Modal */}
      {showThemeModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowThemeModal(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 10px 20px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 500,
              color: '#202124',
              marginBottom: '1rem',
            }}>
              Customize Theme
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: '#5f6368',
              marginBottom: '1.5rem',
            }}>
              Theme customization feature coming soon.
            </p>
            <button
              onClick={() => setShowThemeModal(false)}
              style={{
                background: '#673ab7',
                color: 'white',
                border: 'none',
                padding: '0.625rem 1.25rem',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                float: 'right',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Collaborators Modal */}
      {showCollaboratorsModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowCollaboratorsModal(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 10px 20px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 500,
              color: '#202124',
              marginBottom: '1rem',
            }}>
              Add Collaborators
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: '#5f6368',
              marginBottom: '1.5rem',
            }}>
              Collaborator feature coming soon.
            </p>
            <button
              onClick={() => setShowCollaboratorsModal(false)}
              style={{
                background: '#673ab7',
                color: 'white',
                border: 'none',
                padding: '0.625rem 1.25rem',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                float: 'right',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormBuilder;

