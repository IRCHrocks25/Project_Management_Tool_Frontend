import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
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
    { value: 'Premium', label: 'Premium', color: '#8b5cf6' },
    { value: 'Powered-Up', label: 'Powered-Up', color: '#a855f7' },
  ];

  const packages = ['Starter', 'Standard', 'Premium', 'ICON Package', 'Custom'];
  
  const allDeliverables = [
    'Logo',
    'Brand Book',
    'Home Page',
    'Copy of Home Page',
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
        let newSelection = currentSelection.filter(t => t !== clientType);
        
        // If deselecting "Premium" or "Powered-Up", remove auto-added "Katalyst" only if it's the only remaining type
        // (This handles the case where Katalyst was auto-added and user deselects Premium or Powered-Up)
        if ((clientType === 'Premium' || clientType === 'Powered-Up') && newSelection.length === 1 && newSelection[0] === 'Katalyst') {
          newSelection = [];
        }
        
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
        let newSelection = [...currentSelection, clientType];
        
        // If selecting "Premium" or "Powered-Up", automatically add "Katalyst" for CRM assignment
        if ((clientType === 'Premium' || clientType === 'Powered-Up') && !currentSelection.includes('Katalyst')) {
          // Add Katalyst if we have room (max 2 total visible in UI)
          if (newSelection.length < 2) {
            newSelection.push('Katalyst');
          }
          // If we're at max (2), Katalyst will be added in the backend submission
        }
        
        console.log('Selecting, new selection:', newSelection);
        // Update formData to use first selected type (primary)
        setFormData((prevFormData) => ({
          ...prevFormData,
          clientType: newSelection[0]
        }));
        return newSelection;
      } else {
        // If trying to select when already at max, check if it's Premium or Powered-Up
        // In this case, we'll allow it but Katalyst will be added in backend
        if ((clientType === 'Premium' || clientType === 'Powered-Up') && !currentSelection.includes(clientType)) {
          // Replace the last selected type with Premium or Powered-Up
          const newSelection = [currentSelection[0], clientType];
          setFormData((prevFormData) => ({
            ...prevFormData,
            clientType: newSelection[0]
          }));
          return newSelection;
        }
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
      deliverables.push('Home Page');
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
      clientType: clientType as 'ICON' | 'STAR' | 'Katalyst' | 'Private' | 'Premium' | 'Powered-Up',
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

        // Helper function to normalize and validate client type
        // Handles variations like: "Powered-Up", "Powered-up", "powered-up", "Powered Up", "powered up", etc.
        const normalizeClientType = (input: string): string | null => {
          if (!input || !input.trim()) return null;
          
          const normalized = input.trim();
          const lowerNormalized = normalized.toLowerCase();
          
          // Map variations to valid client types (all lowercase for case-insensitive matching)
          const clientTypeMap: Record<string, string> = {
            'icon': 'ICON',
            'star': 'STAR',
            'katalyst': 'Katalyst',
            'private': 'Private',
            'premium': 'Premium',
            'powered-up': 'Powered-Up', // Handles: "Powered-Up", "Powered-up", "powered-up", "POWERED-UP"
            'powered up': 'Powered-Up', // Handles: "Powered Up", "powered up", "POWERED UP"
            'poweredup': 'Powered-Up', // Handles: "PoweredUp", "poweredup", "POWEREDUP"
          };
          
          // Check exact match first (case-insensitive - converts to lowercase before lookup)
          const exactMatch = clientTypeMap[lowerNormalized];
          if (exactMatch) return exactMatch;
          
          // Fallback: Check against valid client types (case-insensitive with flexible matching)
          const validTypes = clientTypes.map(ct => ct.value);
          const matchedType = validTypes.find(type => {
            const typeLower = type.toLowerCase();
            return (
              typeLower === lowerNormalized || 
              typeLower.replace(/-/g, ' ') === lowerNormalized ||
              typeLower.replace(/-/g, '') === lowerNormalized ||
              lowerNormalized.replace(/-/g, ' ') === typeLower ||
              lowerNormalized.replace(/-/g, '') === typeLower
            );
          });
          
          return matchedType || null;
        };

        // Normalize column names and prepare preview
        const normalizedData = jsonData.map((row: any) => {
          const client = row.Client || row.client || row.CLIENT || '';
          const packageValue = row.Package || row.package || row.PACKAGE || '';
          const notes = row.Notes || row.notes || row.NOTES || '';
          const clientTypeFromColumn = row['Client Type'] || row['client type'] || row.clientType || row['CLIENT TYPE'] || '';
          
          // Normalize and validate client type from column
          let clientType: string;
          let clientTypeWarning: string | undefined;
          const normalizedClientType = normalizeClientType(clientTypeFromColumn);
          
          if (normalizedClientType) {
            // Use the normalized client type from the column
            clientType = normalizedClientType;
            // Show warning if the input was different from the normalized value
            if (clientTypeFromColumn.trim() !== normalizedClientType) {
              clientTypeWarning = `Normalized "${clientTypeFromColumn.trim()}" to "${normalizedClientType}"`;
            }
          } else {
            // Fall back to inferring from package
            const mapped = mapPackageToClientTypeAndPackage(packageValue);
            clientType = mapped.clientType;
            // Show warning if client type column had a value but couldn't be normalized
            if (clientTypeFromColumn && clientTypeFromColumn.trim()) {
              clientTypeWarning = `Invalid client type "${clientTypeFromColumn.trim()}", inferred "${clientType}" from package`;
            }
          }
          
          return {
            client,
            package: mapPackageToClientTypeAndPackage(packageValue).package,
            clientType,
            notes,
            originalPackage: packageValue,
            clientTypeWarning,
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
          // If "Premium" or "Powered-Up" is the client type, ensure "Katalyst" is included for CRM assignment
          const clientType = row.clientType;
          
          // Debug logging
          console.log(`Creating project for ${row.client}:`, {
            clientType,
            package: row.package,
            hasClientType: !!clientType,
            clientTypeValue: clientType
          });
          
          // Validate clientType is set
          if (!clientType) {
            throw new Error('Client type is missing. Please ensure Client Type column is properly formatted.');
          }
          
          const secondaryClientTypes = (clientType === 'Premium' || clientType === 'Powered-Up')
            ? ['Katalyst'] 
            : undefined;
          
          const projectData = {
            clientName: row.client,
            clientType: clientType,
            secondaryClientTypes: secondaryClientTypes, // Include Katalyst for Premium and Powered-Up
            package: row.package,
            priority: 'Medium',
            targetCloseMonth: currentMonth,
            notes: row.notes || '',
            pmId: user?.id || '',
          };
          
          console.log(`Project data for ${row.client}:`, projectData);
          
          const createdProject = await projectService.create(projectData);
          console.log(`Successfully created project for ${row.client}:`, createdProject);
          
          // If Premium or Powered-Up, automatically create a default CRM task
          if (clientType === 'Premium' || clientType === 'Powered-Up') {
            try {
              await taskService.create({
                projectId: createdProject.id,
                title: `Initial Setup - ${row.client}`,
                description: `Initial setup and onboarding task for ${clientType} client.`,
                type: 'CRM',
                status: 'Todo',
                isCompleted: false,
              });
              console.log(`Successfully created CRM task for ${row.client}`);
            } catch (taskError: any) {
              console.error(`Failed to create default CRM task for ${row.client}:`, taskError);
              // Don't fail the project creation if task creation fails
            }
          }
          
          results.success++;
        } catch (err: any) {
          console.error(`Error creating project for ${row.client}:`, err);
          const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
          const fullError = `${row.client}: ${errorMsg}`;
          console.error(`Full error details:`, {
            client: row.client,
            clientType: row.clientType,
            error: errorMsg,
            response: err.response?.data
          });
          errors.push(fullError);
          results.failed++;
        }
      }

      // Show success or error message
      if (results.failed > 0) {
        setError(`${results.success} projects created successfully. ${results.failed} failed:\n${errors.join('\n')}`);
      } else if (results.success > 0) {
        setError(`✅ Successfully created ${results.success} project${results.success === 1 ? '' : 's'}!`);
        // Clear success message after 3 seconds
        setTimeout(() => setError(''), 3000);
      }

      // Always refresh dashboard data after bulk create, but don't auto-close the modal
      if (onBulkSuccess) {
        onBulkSuccess();
      } else {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Fatal error in bulk create:', err);
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
      // If "Premium" or "Powered-Up" is selected, ensure "Katalyst" is included for CRM assignment
      let finalClientTypes = [...selectedClientTypes];
      if ((selectedClientTypes.includes('Premium') || selectedClientTypes.includes('Powered-Up')) && !selectedClientTypes.includes('Katalyst')) {
        // Add Katalyst to ensure CRM assignment
        // If we have room (less than 2), add it; otherwise, it will be added to secondary types
        if (finalClientTypes.length < 2) {
          finalClientTypes.push('Katalyst');
        } else {
          // If already at max, add Katalyst to secondary types array
          finalClientTypes = [...finalClientTypes, 'Katalyst'];
        }
      }
      
      // Prepare secondary client types (all except the first one)
      const secondaryClientTypes = finalClientTypes.length > 1 
        ? finalClientTypes.slice(1) 
        : undefined;
      
      const createdProject = await projectService.create({
        ...formData,
        clientType: finalClientTypes[0], // Primary client type
        secondaryClientTypes: secondaryClientTypes, // Secondary client types array (includes Katalyst if Premium and Powered-Up is selected)
        pmId: user?.id,
        customDeliverables: formData.package === 'Custom' ? selectedDeliverables : undefined,
      });
      
      // If Premium or Powered-Up, automatically create a default CRM task
      if (finalClientTypes.includes('Premium') || finalClientTypes.includes('Powered-Up')) {
        try {
          await taskService.create({
            projectId: createdProject.id,
            title: `Initial Setup - ${formData.clientName}`,
            description: `Initial setup and onboarding task for ${finalClientTypes.includes('Premium') ? 'Premium' : 'Powered-Up'} client.`,
            type: 'CRM',
            status: 'Todo',
            isCompleted: false,
          });
        } catch (taskError) {
          console.error('Failed to create default CRM task:', taskError);
          // Don't fail the project creation if task creation fails
        }
      }
      
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

        {error && (
          <div 
            className="error-message" 
            style={{ 
              whiteSpace: 'pre-wrap',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              borderRadius: '0.375rem',
              backgroundColor: error.startsWith('✅') ? '#d1fae5' : '#fee2e2',
              color: error.startsWith('✅') ? '#065f46' : '#991b1b',
              border: `1px solid ${error.startsWith('✅') ? '#86efac' : '#fecaca'}`,
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            {error}
          </div>
        )}

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
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>{row.clientType}</span>
                              {row.clientTypeWarning && (
                                <span 
                                  style={{ 
                                    fontSize: '0.75rem', 
                                    color: '#f59e0b',
                                    fontStyle: 'italic'
                                  }}
                                  title={row.clientTypeWarning}
                                >
                                  ⚠️ {row.clientTypeWarning}
                                </span>
                              )}
                            </div>
                          </td>
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
                    title={
                      isSelected 
                        ? `Selected: ${type.label}${(type.value === 'Premium' || type.value === 'Powered-Up') ? ' (Auto-assigned to CRM)' : ''}` 
                        : canSelect 
                        ? `Click to select ${type.label}${(type.value === 'Premium' || type.value === 'Powered-Up') ? ' (Auto-assigns to CRM)' : ''}` 
                        : 'You can only select up to 2 client types'
                    }
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
                {(selectedClientTypes.includes('Premium') || selectedClientTypes.includes('Powered-Up')) && (
                  <div style={{ 
                    marginTop: '0.5rem', 
                    fontSize: '0.75rem', 
                    color: '#667eea',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <span>ℹ️</span>
                    <span>Premium and Powered-Up projects are automatically assigned to CRM</span>
                  </div>
                )}
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

