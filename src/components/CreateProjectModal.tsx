import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { projectService } from '../services/project.service';
import { authService } from '../services/auth.service';
import './CreateProjectModal.css';

interface CreateProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onBulkSuccess?: () => void; // Optional: used to refresh data without closing modal
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ onClose, onSuccess, onBulkSuccess }) => {
  const user = authService.getUser();
  const [formData, setFormData] = useState({
    clientName: '',
    clientType: 'ICON',
    package: 'Standard',
    priority: 'Medium',
    targetCloseMonth: '',
    notes: '',
  });
  const [selectedClientTypes, setSelectedClientTypes] = useState<string[]>(['ICON']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Debug: Log state changes
  useEffect(() => {
    console.log('selectedClientTypes state changed to:', selectedClientTypes);
  }, [selectedClientTypes]);
  const [uploadMode, setUploadMode] = useState<'single' | 'excel'>('single');
  const [excelPreview, setExcelPreview] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const clientTypes = [
    { value: 'ICON', label: 'ICON', color: '#fbbf24' },
    { value: 'STAR', label: 'STAR', color: '#94a3b8' },
    { value: 'Katalyst', label: 'Katalyst', color: '#667eea' },
    { value: 'Private', label: 'Private', color: '#64748b' },
  ];

  const packages = ['Starter', 'Standard', 'Premium', 'ICON Package', 'Custom'];
  
  const allDeliverables = [
    'Logo',
    'Brand Book',
    'Landing Page',
    'Copy of Landing Page',
    'Speaker Kit',
    'Social Banners',
    'Other',
  ];
  
  const [selectedDeliverables, setSelectedDeliverables] = useState<string[]>(['Logo', 'Brand Book']);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: newValue,
    });
    
    // Reset selected deliverables when switching away from Custom
    if (e.target.name === 'package' && newValue !== 'Custom') {
      setSelectedDeliverables(['Logo', 'Brand Book']);
    }
    
    setError('');
  };

  const toggleClientType = (clientType: string) => {
    console.log('toggleClientType called:', clientType);
    
    // Use functional update to ensure we have the latest state
    setSelectedClientTypes((currentSelection) => {
      console.log('Current selectedClientTypes in update:', currentSelection);
      
      // If already selected, deselect it
      if (currentSelection.includes(clientType)) {
        const newSelection = currentSelection.filter(t => t !== clientType);
        console.log('Deselecting, new selection:', newSelection);
        // Update formData to use first remaining type, or default to first type
        setFormData((prevFormData) => ({
          ...prevFormData,
          clientType: newSelection[0] || clientTypes[0].value
        }));
        return newSelection;
      } 
      // If not selected and we have less than 2, add it
      else if (currentSelection.length < 2) {
        const newSelection = [...currentSelection, clientType];
        console.log('Selecting, new selection:', newSelection);
        // Update formData to use first selected type (primary)
        setFormData((prevFormData) => ({
          ...prevFormData,
          clientType: newSelection[0]
        }));
        return newSelection;
      } else {
        console.log('Cannot select more, already at max (2)');
        return currentSelection; // Return unchanged
      }
    });
  };

  const toggleDeliverable = (deliverable: string) => {
    if (selectedDeliverables.includes(deliverable)) {
      setSelectedDeliverables(selectedDeliverables.filter(d => d !== deliverable));
    } else {
      setSelectedDeliverables([...selectedDeliverables, deliverable]);
    }
  };

  const getIncludedDeliverables = () => {
    // If Custom package, return selected deliverables
    if (formData.package === 'Custom') {
      return selectedDeliverables;
    }
    
    // Otherwise, use standard logic
    const deliverables: string[] = ['Logo', 'Brand Book'];
    
    // Check if ICON is in selected client types (supports multiple selections)
    if (selectedClientTypes.includes('ICON')) {
      deliverables.push('Speaker Kit');
    }
    
    if (formData.package === 'Premium' || formData.package === 'ICON Package') {
      deliverables.push('Landing Page');
    }
    
    if (formData.package !== 'Starter') {
      deliverables.push('Social Banners');
    }
    
    return deliverables;
  };

  const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const mapPackageToClientTypeAndPackage = (packageValue: string) => {
    const packageLower = packageValue.toLowerCase().trim();
    
    // If package contains "icon" (case insensitive), set clientType to ICON and package to ICON_PACKAGE
    if (packageLower.includes('icon')) {
      return {
        clientType: 'ICON' as const,
        package: 'ICON Package' as const,
      };
    }
    
    // Otherwise, package is Standard and clientType is based on package name
    // Default to Standard package
    let mappedPackage: string = 'Standard';
    
    // Try to map package names to PackageType enum values
    if (packageLower.includes('starter')) {
      mappedPackage = 'Starter';
    } else if (packageLower.includes('premium')) {
      mappedPackage = 'Premium';
    } else if (packageLower.includes('standard')) {
      mappedPackage = 'Standard';
    } else if (packageLower.includes('custom')) {
      mappedPackage = 'Custom';
    }
    
    // Client type is inferred from the package name
    // If package name contains client type indicators, use them
    // Otherwise, default to STAR
    let clientType: string = 'STAR';
    if (packageLower.includes('star')) {
      clientType = 'STAR';
    } else if (packageLower.includes('katalyst')) {
      clientType = 'Katalyst';
    } else if (packageLower.includes('private')) {
      clientType = 'Private';
    }
    // If no indicator found, default to STAR (as per requirement: "client type is the package")
    
    return {
      clientType: clientType as 'ICON' | 'STAR' | 'Katalyst' | 'Private',
      package: mappedPackage as 'Starter' | 'Standard' | 'Premium' | 'ICON Package' | 'Custom',
    };
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Validate columns
        if (jsonData.length === 0) {
          setError('Excel file is empty');
          return;
        }

        const firstRow = jsonData[0] as any;
        const hasClient = 'Client' in firstRow || 'client' in firstRow || 'CLIENT' in firstRow;
        const hasPackage = 'Package' in firstRow || 'package' in firstRow || 'PACKAGE' in firstRow;

        if (!hasClient || !hasPackage) {
          setError('Excel file must contain "Client" and "Package" columns');
          return;
        }

        // Normalize column names and prepare preview
        const normalizedData = jsonData.map((row: any) => {
          const client = row.Client || row.client || row.CLIENT || '';
          const packageValue = row.Package || row.package || row.PACKAGE || '';
          const notes = row.Notes || row.notes || row.NOTES || '';
          
          const { clientType, package: mappedPackage } = mapPackageToClientTypeAndPackage(packageValue);
          
          return {
            client,
            package: mappedPackage,
            clientType,
            notes,
            originalPackage: packageValue,
          };
        });

        setExcelPreview(normalizedData);
      } catch (err: any) {
        setError('Failed to parse Excel file: ' + (err.message || 'Invalid file format'));
        setExcelPreview([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkCreate = async () => {
    if (excelPreview.length === 0) {
      setError('No projects to create');
      return;
    }

    setUploading(true);
    setError('');

    const currentMonth = getCurrentMonth();
    const results = { success: 0, failed: 0 };
    const errors: string[] = [];

    try {
      for (const row of excelPreview) {
        if (!row.client || !row.package) {
          errors.push(`Skipping row: Missing client name or package`);
          results.failed++;
          continue;
        }

        try {
          await projectService.create({
            clientName: row.client,
            clientType: row.clientType,
            package: row.package,
            priority: 'Medium',
            targetCloseMonth: currentMonth,
            notes: row.notes || '',
            pmId: user?.id || '',
          });
          results.success++;
        } catch (err: any) {
          const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
          errors.push(`${row.client}: ${errorMsg}`);
          results.failed++;
        }
      }

      if (results.failed > 0) {
        setError(`${results.success} projects created successfully. ${results.failed} failed:\n${errors.join('\n')}`);
      }

      // Always refresh dashboard data after bulk create, but don't auto-close the modal
      if (onBulkSuccess) {
        onBulkSuccess();
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setError('Failed to create projects: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate client types
    if (selectedClientTypes.length === 0) {
      setError('Please select at least one client type');
      return;
    }
    
    // Validate custom deliverables
    if (formData.package === 'Custom' && selectedDeliverables.length === 0) {
      setError('Please select at least one deliverable for Custom package');
      return;
    }
    
    setLoading(true);

    try {
      // Prepare secondary client types (all except the first one)
      const secondaryClientTypes = selectedClientTypes.length > 1 
        ? selectedClientTypes.slice(1) 
        : undefined;
      
      await projectService.create({
        ...formData,
        clientType: selectedClientTypes[0], // Primary client type
        secondaryClientTypes: secondaryClientTypes, // Secondary client types array
        pmId: user?.id,
        customDeliverables: formData.package === 'Custom' ? selectedDeliverables : undefined,
      });
      
      // Show confetti effect (simple version)
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Project</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Upload Mode Toggle */}
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginBottom: '1.5rem', 
          padding: '0.375rem',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #f1f5f9'
        }}>
          <button
            type="button"
            onClick={() => {
              setUploadMode('single');
              setExcelPreview([]);
              setError('');
            }}
            style={{
              flex: 1,
              padding: '0.625rem 1rem',
              border: 'none',
              borderRadius: '10px',
              background: uploadMode === 'single' ? 'white' : 'transparent',
              color: uploadMode === 'single' ? '#475569' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: uploadMode === 'single' ? 500 : 400,
              transition: 'all 0.2s',
              boxShadow: uploadMode === 'single' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none'
            }}
          >
            Single Project
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadMode('excel');
              setError('');
            }}
            style={{
              flex: 1,
              padding: '0.625rem 1rem',
              border: 'none',
              borderRadius: '10px',
              background: uploadMode === 'excel' ? 'white' : 'transparent',
              color: uploadMode === 'excel' ? '#475569' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: uploadMode === 'excel' ? 500 : 400,
              transition: 'all 0.2s',
              boxShadow: uploadMode === 'excel' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none'
            }}
          >
            Upload Excel
          </button>
        </div>

        {error && <div className="error-message" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}

        {uploadMode === 'excel' ? (
          <div className="create-project-form" style={{ padding: '1rem' }}>
            <div className="form-group">
              <label htmlFor="excelFile">Upload Excel File</label>
              <input
                id="excelFile"
                name="excelFile"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                Excel file must contain columns: <strong>Client</strong>, <strong>Package</strong> (optional: <strong>Notes</strong>)
              </p>
            </div>

            {excelPreview.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
                  Preview ({excelPreview.length} projects)
                </h3>
                <div style={{ 
                  maxHeight: '300px', 
                  overflowY: 'auto', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '0.375rem'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Client</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Package</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Client Type</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excelPreview.map((row, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem' }}>{row.client}</td>
                          <td style={{ padding: '0.75rem' }}>{row.package}</td>
                          <td style={{ padding: '0.75rem' }}>{row.clientType}</td>
                          <td style={{ padding: '0.75rem', color: '#64748b' }}>{row.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleBulkCreate} 
                className="btn-primary" 
                disabled={uploading || excelPreview.length === 0}
              >
                {uploading ? `Creating ${excelPreview.length} projects...` : `Create ${excelPreview.length} Projects`}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="create-project-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="clientName">Client Name</label>
              <input
                id="clientName"
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                required
                placeholder="Enter client name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="targetCloseMonth">Target Close Month</label>
              <input
                id="targetCloseMonth"
                type="month"
                name="targetCloseMonth"
                value={formData.targetCloseMonth}
                onChange={handleChange}
                required
              />
            </div>
          </div>


          <div className="form-group" style={{ padding: '0' }}>
            <label id="clientTypeLabel" style={{ color: '#475569', fontWeight: 500 }}>
              Client Type {selectedClientTypes.length > 0 && <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>(Select up to 2)</span>}
            </label>
            <div className="client-type-grid" role="group" aria-labelledby="clientTypeLabel" style={{ marginTop: '0.5rem' }}>
              {clientTypes.map((type) => {
                const isSelected = selectedClientTypes.includes(type.value);
                const canSelect = selectedClientTypes.length < 2 || isSelected;
                
                return (
                  <button
                    key={type.value}
                    type="button"
                    id={`clientType-${type.value}`}
                    name={`clientType-${type.value}`}
                    className={`client-type-card ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Button clicked:', type.value, 'Current state:', selectedClientTypes);
                      toggleClientType(type.value);
                    }}
                    style={{ 
                      borderColor: isSelected ? type.color : '#e2e8f0',
                      borderWidth: isSelected ? '2px' : '1.5px',
                      opacity: canSelect ? 1 : 0.4,
                      cursor: canSelect ? 'pointer' : 'not-allowed',
                      backgroundColor: isSelected ? '#f8fafc' : 'white',
                      boxShadow: isSelected ? `0 0 0 3px ${type.color}15` : 'none'
                    }}
                    title={isSelected ? `Selected: ${type.label}` : canSelect ? `Click to select ${type.label}` : 'You can only select up to 2 client types'}
                    aria-pressed={isSelected}
                  >
                    <div className="client-type-badge" style={{ backgroundColor: type.color }}>
                      {type.label}
                    </div>
                    {isSelected && (
                      <div 
                        className="checkmark-overlay"
                        style={{ background: type.color }}
                      >
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
              {/* Add More Button */}
              <button
                type="button"
                className="client-type-card add-client-type"
                onClick={() => {
                  // Placeholder for adding more client types
                  // Could open a modal or input field for custom types
                  alert('Add more client types feature coming soon!');
                }}
                style={{ 
                  borderColor: '#e2e8f0',
                  borderStyle: 'dashed',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '60px'
                }}
                title="Add more client types"
              >
                <span style={{ fontSize: '1.5rem', color: '#64748b', fontWeight: 'bold' }}>+</span>
              </button>
            </div>
            {selectedClientTypes.length > 0 && (
              <div style={{ 
                marginTop: '0.75rem', 
                fontSize: '0.8125rem', 
                color: '#64748b',
                fontWeight: 400,
                padding: '0.625rem 0.875rem',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid #f1f5f9'
              }}>
                Selected ({selectedClientTypes.length}/2): <span style={{ fontWeight: 500, color: '#475569' }}>{selectedClientTypes.join(', ')}</span>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="package">Package</label>
              <select id="package" name="package" value={formData.package} onChange={handleChange} required>
                {packages.map((pkg) => (
                  <option key={pkg} value={pkg}>{pkg}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select id="priority" name="priority" value={formData.priority} onChange={handleChange} required>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label id="deliverablesLabel">Included Deliverables</label>
            {formData.package === 'Custom' ? (
              <div className="custom-deliverables-selector">
                <p className="deliverables-hint">Select the deliverables to include in this project:</p>
                <div className="deliverables-checkbox-grid" role="group" aria-labelledby="deliverablesLabel">
                  {allDeliverables.map((deliverable) => {
                    const isChecked = selectedDeliverables.includes(deliverable);
                    const deliverableId = `deliverable-${deliverable.toLowerCase().replace(/\s+/g, '-')}`;
                    return (
                      <label 
                        key={deliverable}
                        htmlFor={deliverableId}
                        className={`deliverable-checkbox-label ${isChecked ? 'checked' : ''}`}
                      >
                        <input
                          id={deliverableId}
                          name={deliverableId}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDeliverable(deliverable)}
                          className="deliverable-checkbox"
                        />
                        <span className="deliverable-checkbox-text">{deliverable}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedDeliverables.length === 0 && (
                  <p className="error-hint" style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Please select at least one deliverable
                  </p>
                )}
              </div>
            ) : (
              <div className="deliverables-preview">
                {getIncludedDeliverables().map((deliverable) => (
                  <span key={deliverable} className="deliverable-badge">
                    {deliverable}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes (Optional)</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes or requirements..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default CreateProjectModal;

