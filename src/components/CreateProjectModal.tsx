import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { authService } from '../services/auth.service';
import { FaTimes, FaUpload, FaPlus, FaCheck, FaInfoCircle } from 'react-icons/fa';

interface CreateProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onBulkSuccess?: () => void;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .cpm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 25, 35, 0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: overlayIn 0.15s ease;
  }
  @keyframes overlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .cpm-modal {
    --bg: #ffffff;
    --surface: #f8f9fb;
    --border: #e8ecf0;
    --border-strong: #d0d7de;
    --text-primary: #0f1923;
    --text-secondary: #4a5568;
    --text-muted: #94a3b8;
    --accent: #2563eb;
    --accent-light: #eff6ff;
    --danger: #dc2626;
    --danger-light: #fff1f2;
    --success: #16a34a;
    --success-light: #f0fdf4;

    font-family: 'Instrument Sans', sans-serif;
    background: var(--bg);
    border-radius: 16px;
    border: 1px solid var(--border);
    box-shadow: 0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
    width: 100%;
    max-width: 580px;
    max-height: 90vh;
    overflow-y: auto;
    animation: modalIn 0.2s ease;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .cpm-modal::-webkit-scrollbar { width: 4px; }
  .cpm-modal::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }

  @keyframes modalIn {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Header */
  .cpm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 18px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--bg);
    z-index: 2;
    border-radius: 16px 16px 0 0;
  }
  .cpm-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.01em;
  }
  .cpm-close {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.12s;
  }
  .cpm-close:hover { background: var(--danger-light); border-color: #fecdd3; color: var(--danger); }

  /* Body */
  .cpm-body { padding: 20px 24px 24px; }

  /* Mode toggle */
  .cpm-mode-toggle {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    margin-bottom: 20px;
  }
  .cpm-mode-btn {
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-radius: 7px;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.13s;
    color: var(--text-muted);
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .cpm-mode-btn.active {
    background: white;
    color: var(--text-primary);
    font-weight: 600;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  /* Alert / error */
  .cpm-alert {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 500;
    margin-bottom: 16px;
    line-height: 1.5;
    white-space: pre-wrap;
  }
  .cpm-alert.error   { background: var(--danger-light); border: 1px solid #fecdd3; color: #9f1239; }
  .cpm-alert.success { background: var(--success-light); border: 1px solid #bbf7d0; color: #14532d; }

  /* Form */
  .cpm-form { display: flex; flex-direction: column; gap: 16px; }

  .cpm-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  @media (max-width: 480px) { .cpm-row { grid-template-columns: 1fr; } }

  .cpm-field { display: flex; flex-direction: column; gap: 5px; }

  .cpm-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .cpm-label-hint {
    font-size: 11px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--text-muted);
    margin-left: 4px;
  }

  .cpm-input,
  .cpm-select,
  .cpm-textarea {
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 13.5px;
    color: var(--text-primary);
    background: white;
    transition: border-color 0.13s, box-shadow 0.13s;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .cpm-input:focus,
  .cpm-select:focus,
  .cpm-textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
  }
  .cpm-input::placeholder { color: var(--text-muted); }
  .cpm-textarea { resize: vertical; min-height: 80px; }
  .cpm-select { appearance: none; -webkit-appearance: none; cursor: pointer; }

  /* Client type grid */
  .cpm-client-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 2px;
  }
  .cpm-client-card {
    position: relative;
    border-radius: 9px;
    border: 1.5px solid var(--border);
    background: white;
    padding: 10px 8px;
    cursor: pointer;
    transition: all 0.13s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    outline: none;
    box-sizing: border-box;
  }
  .cpm-client-card:hover:not(:disabled) { border-color: var(--border-strong); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .cpm-client-card.selected { border-width: 2px; background: #fafbff; }
  .cpm-client-card:disabled { opacity: 0.35; cursor: not-allowed; }

  .cpm-client-pill {
    padding: 3px 8px;
    border-radius: 20px;
    font-size: 10.5px;
    font-weight: 700;
    color: white;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .cpm-client-check {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 7px;
    color: white;
  }
  .cpm-client-add {
    border-style: dashed;
    min-height: 52px;
    justify-content: center;
    color: var(--text-muted);
  }
  .cpm-client-add:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

  /* Selection summary */
  .cpm-selection-info {
    padding: 9px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 12.5px;
    color: var(--text-secondary);
    display: flex;
    align-items: flex-start;
    gap: 7px;
    margin-top: 4px;
  }
  .cpm-selection-info .crm-note {
    margin-top: 4px;
    font-size: 11.5px;
    color: var(--accent);
    display: flex;
    align-items: center;
    gap: 5px;
  }

  /* Deliverables */
  .cpm-deliverables-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .cpm-deliverable-badge {
    padding: 4px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text-secondary);
  }
  .cpm-deliverable-hint {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .cpm-deliverables-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .cpm-deliverable-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border: 1.5px solid var(--border);
    border-radius: 20px;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    background: white;
    cursor: pointer;
    transition: all 0.12s;
  }
  .cpm-deliverable-toggle:hover { border-color: var(--border-strong); }
  .cpm-deliverable-toggle.checked {
    background: var(--accent-light);
    border-color: #bfdbfe;
    color: var(--accent);
    font-weight: 600;
  }

  /* Excel upload */
  .cpm-file-zone {
    border: 2px dashed var(--border-strong);
    border-radius: 10px;
    padding: 24px;
    text-align: center;
    cursor: pointer;
    transition: all 0.13s;
    background: var(--surface);
  }
  .cpm-file-zone:hover { border-color: var(--accent); background: var(--accent-light); }
  .cpm-file-hint {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 8px;
    line-height: 1.5;
  }

  /* Preview table */
  .cpm-preview-wrap {
    margin-top: 16px;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .cpm-preview-title {
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .cpm-preview-scroll { max-height: 240px; overflow-y: auto; }
  .cpm-preview-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .cpm-preview-table th {
    padding: 8px 12px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
  }
  .cpm-preview-table td {
    padding: 9px 12px;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border);
  }
  .cpm-preview-table tr:last-child td { border-bottom: none; }
  .cpm-preview-table tr:hover td { background: var(--surface); }
  .cpm-warn-text {
    font-size: 11px;
    color: #d97706;
    font-style: italic;
  }

  /* Actions */
  .cpm-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    padding-top: 4px;
  }
  .cpm-btn-secondary {
    padding: 9px 18px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: white;
    color: var(--text-secondary);
    font-family: 'Instrument Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
  }
  .cpm-btn-secondary:hover { background: var(--surface); border-color: var(--border-strong); }

  .cpm-btn-primary {
    padding: 9px 20px;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: white;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, opacity 0.12s;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .cpm-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
  .cpm-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Divider */
  .cpm-divider { height: 1px; background: var(--border); margin: 4px 0; }
`;

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

  useEffect(() => {
    console.log('selectedClientTypes state changed to:', selectedClientTypes);
  }, [selectedClientTypes]);

  const [uploadMode, setUploadMode] = useState<'single' | 'excel'>('single');
  const [excelPreview, setExcelPreview] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const clientTypes = [
    { value: 'ICON',       label: 'ICON',       color: '#d97706' },
    { value: 'STAR',       label: 'STAR',       color: '#7c3aed' },
    { value: 'Katalyst',   label: 'Katalyst',   color: '#2563eb' },
    { value: 'Private',    label: 'Private',    color: '#64748b' },
    { value: 'Premium',    label: 'Premium',    color: '#7c3aed' },
    { value: 'Powered-Up', label: 'Powered-Up', color: '#db2777' },
  ];

  const packages = ['Starter', 'Standard', 'Premium', 'ICON Package', 'Custom'];

  const allDeliverables = ['Logo', 'Brand Book', 'Home Page', 'Copy of Home Page', 'Speaker Kit', 'Social Banners', 'Other'];
  const [selectedDeliverables, setSelectedDeliverables] = useState<string[]>(['Logo', 'Brand Book']);
  const isPrivateOnlyClient = selectedClientTypes.length === 1 && selectedClientTypes[0] === 'Private';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setFormData({ ...formData, [e.target.name]: newValue });
    if (e.target.name === 'package' && newValue !== 'Custom') setSelectedDeliverables(['Logo', 'Brand Book']);
    setError('');
  };

  const toggleClientType = (clientType: string) => {
    setSelectedClientTypes((current) => {
      if (current.includes(clientType)) {
        let next = current.filter(t => t !== clientType);
        if ((clientType === 'Premium' || clientType === 'Powered-Up') && next.length === 1 && next[0] === 'Katalyst') next = [];
        setFormData((prev) => ({ ...prev, clientType: next[0] || clientTypes[0].value }));
        return next;
      } else if (current.length < 2) {
        let next = [...current, clientType];
        if ((clientType === 'Premium' || clientType === 'Powered-Up') && !current.includes('Katalyst') && next.length < 2) next.push('Katalyst');
        setFormData((prev) => ({ ...prev, clientType: next[0] }));
        return next;
      } else {
        if ((clientType === 'Premium' || clientType === 'Powered-Up') && !current.includes(clientType)) {
          const next = [current[0], clientType];
          setFormData((prev) => ({ ...prev, clientType: next[0] }));
          return next;
        }
        return current;
      }
    });
  };

  const toggleDeliverable = (d: string) => {
    setSelectedDeliverables(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const getIncludedDeliverables = () => {
    if (isPrivateOnlyClient) return [];
    if (formData.package === 'Custom') return selectedDeliverables;
    const d = ['Logo', 'Brand Book'];
    if (selectedClientTypes.includes('ICON')) d.push('Speaker Kit');
    if (formData.package === 'Premium' || formData.package === 'ICON Package') d.push('Home Page');
    if (formData.package !== 'Starter') d.push('Social Banners');
    return d;
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const mapPackageToClientTypeAndPackage = (packageValue: string) => {
    const l = packageValue.toLowerCase().trim();
    if (l.includes('icon')) return { clientType: 'ICON' as const, package: 'ICON Package' as const };
    let mappedPackage = 'Standard';
    if (l.includes('starter')) mappedPackage = 'Starter';
    else if (l.includes('premium')) mappedPackage = 'Premium';
    else if (l.includes('custom')) mappedPackage = 'Custom';
    let clientType = 'STAR';
    if (l.includes('star')) clientType = 'STAR';
    else if (l.includes('katalyst')) clientType = 'Katalyst';
    else if (l.includes('private')) clientType = 'Private';
    return { clientType: clientType as any, package: mappedPackage as any };
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
        if (jsonData.length === 0) { setError('Excel file is empty'); return; }
        const firstRow = jsonData[0] as any;
        if (!('Client' in firstRow || 'client' in firstRow || 'CLIENT' in firstRow) || !('Package' in firstRow || 'package' in firstRow || 'PACKAGE' in firstRow)) {
          setError('Excel file must contain "Client" and "Package" columns'); return;
        }
        const normalizeClientType = (input: string): string | null => {
          if (!input?.trim()) return null;
          const l = input.trim().toLowerCase();
          const map: Record<string, string> = { 'icon': 'ICON', 'star': 'STAR', 'katalyst': 'Katalyst', 'private': 'Private', 'premium': 'Premium', 'powered-up': 'Powered-Up', 'powered up': 'Powered-Up', 'poweredup': 'Powered-Up', 'rapid prospect': 'Rapid Prospect', 'rapid-prospect': 'Rapid Prospect', 'rapidprospect': 'Rapid Prospect' };
          if (map[l]) return map[l];
          return clientTypes.map(ct => ct.value).find(type => {
            const tl = type.toLowerCase();
            return tl === l || tl.replace(/-/g, ' ') === l || tl.replace(/-/g, '') === l || l.replace(/-/g, ' ') === tl || l.replace(/-/g, '') === tl;
          }) || null;
        };
        const normalized = jsonData.map((row: any) => {
          const client = row.Client || row.client || row.CLIENT || '';
          const packageValue = row.Package || row.package || row.PACKAGE || '';
          const notes = row.Notes || row.notes || row.NOTES || '';
          const clientTypeFromColumn = row['Client Type'] || row['client type'] || row.clientType || row['CLIENT TYPE'] || '';
          const normalizedCT = normalizeClientType(clientTypeFromColumn);
          let clientType: string;
          let clientTypeWarning: string | undefined;
          if (normalizedCT) {
            clientType = normalizedCT;
            if (clientTypeFromColumn.trim() !== normalizedCT) clientTypeWarning = `Normalized "${clientTypeFromColumn.trim()}" → "${normalizedCT}"`;
          } else {
            const mapped = mapPackageToClientTypeAndPackage(packageValue);
            clientType = mapped.clientType;
            if (clientTypeFromColumn?.trim()) clientTypeWarning = `Invalid "${clientTypeFromColumn.trim()}", inferred "${clientType}" from package`;
          }
          return { client, package: mapPackageToClientTypeAndPackage(packageValue).package, clientType, notes, originalPackage: packageValue, clientTypeWarning };
        });
        setExcelPreview(normalized);
      } catch (err: any) {
        setError('Failed to parse Excel file: ' + (err.message || 'Invalid file format'));
        setExcelPreview([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkCreate = async () => {
    if (excelPreview.length === 0) { setError('No projects to create'); return; }
    setUploading(true); setError('');
    const currentMonth = getCurrentMonth();
    const results = { success: 0, failed: 0 };
    const errors: string[] = [];
    try {
      for (const row of excelPreview) {
        if (!row.client || !row.package) { errors.push(`Skipping row: Missing client name or package`); results.failed++; continue; }
        try {
          const ct = row.clientType;
          if (!ct) throw new Error('Client type is missing.');
          const secondaryClientTypes = (ct === 'Premium' || ct === 'Powered-Up') ? ['Katalyst'] : undefined;
          const createdProject = await projectService.create({ clientName: row.client, clientType: ct, secondaryClientTypes, package: row.package, priority: 'Medium', targetCloseMonth: currentMonth, notes: row.notes || '', pmId: user?.id || '' });
          if (ct === 'Premium' || ct === 'Powered-Up') {
            try { await taskService.create({ projectId: createdProject.id, title: `Initial Setup - ${row.client}`, description: `Initial setup for ${ct} client.`, type: 'CRM', status: 'Todo', isCompleted: false }); } catch {}
          }
          results.success++;
        } catch (err: any) {
          errors.push(`${row.client}: ${err.response?.data?.message || err.message || 'Unknown error'}`);
          results.failed++;
        }
      }
      if (results.failed > 0) setError(`${results.success} created, ${results.failed} failed:\n${errors.join('\n')}`);
      else if (results.success > 0) { setError(`✅ Successfully created ${results.success} project${results.success === 1 ? '' : 's'}!`); setTimeout(() => setError(''), 3000); }
      if (onBulkSuccess) onBulkSuccess(); else onSuccess();
    } catch (err: any) {
      setError('Failed to create projects: ' + (err.message || 'Unknown error'));
    } finally { setUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (selectedClientTypes.length === 0) { setError('Please select at least one client type'); return; }
    if (!isPrivateOnlyClient && !formData.targetCloseMonth) {
      setError('Please select a target close month');
      return;
    }
    if (formData.package === 'Custom' && !isPrivateOnlyClient && selectedDeliverables.length === 0) {
      setError('Please select at least one deliverable for Custom package');
      return;
    }
    setLoading(true);
    try {
      let finalClientTypes = [...selectedClientTypes];
      if ((selectedClientTypes.includes('Premium') || selectedClientTypes.includes('Powered-Up')) && !selectedClientTypes.includes('Katalyst')) {
        if (finalClientTypes.length < 2) finalClientTypes.push('Katalyst');
        else finalClientTypes = [...finalClientTypes, 'Katalyst'];
      }
      const secondaryClientTypes = finalClientTypes.length > 1 ? finalClientTypes.slice(1) : undefined;
      const createdProject = await projectService.create({
        ...formData,
        targetCloseMonth: formData.targetCloseMonth || (isPrivateOnlyClient ? getCurrentMonth() : ''),
        clientType: finalClientTypes[0],
        secondaryClientTypes,
        pmId: user?.id,
        customDeliverables: formData.package === 'Custom'
          ? (isPrivateOnlyClient ? [] : selectedDeliverables)
          : undefined,
      });
      if (finalClientTypes.includes('Premium') || finalClientTypes.includes('Powered-Up')) {
        try { await taskService.create({ projectId: createdProject.id, title: `Initial Setup - ${formData.clientName}`, description: `Initial setup for ${finalClientTypes.includes('Premium') ? 'Premium' : 'Powered-Up'} client.`, type: 'CRM', status: 'Todo', isCompleted: false }); } catch {}
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally { setLoading(false); }
  };

  const isSuccess = error.startsWith('✅');

  return (
    <>
      <style>{STYLES}</style>
      <div className="cpm-overlay" onClick={onClose}>
        <div className="cpm-modal" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="cpm-header">
            <h2 className="cpm-title">Create New Project</h2>
            <button className="cpm-close" onClick={onClose}><FaTimes /></button>
          </div>

          <div className="cpm-body">
            {/* Mode toggle */}
            <div className="cpm-mode-toggle">
              <button
                type="button"
                className={`cpm-mode-btn${uploadMode === 'single' ? ' active' : ''}`}
                onClick={() => { setUploadMode('single'); setExcelPreview([]); setError(''); }}
              >
                <FaPlus style={{ fontSize: 10 }} /> Single Project
              </button>
              <button
                type="button"
                className={`cpm-mode-btn${uploadMode === 'excel' ? ' active' : ''}`}
                onClick={() => { setUploadMode('excel'); setError(''); }}
              >
                <FaUpload style={{ fontSize: 10 }} /> Upload Excel
              </button>
            </div>

            {/* Alert */}
            {error && (
              <div className={`cpm-alert ${isSuccess ? 'success' : 'error'}`}>{error}</div>
            )}

            {/* Excel mode */}
            {uploadMode === 'excel' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="cpm-field">
                  <label className="cpm-label">Excel File</label>
                  <label className="cpm-file-zone" htmlFor="excelFile">
                    <FaUpload style={{ fontSize: 20, color: 'var(--text-muted)', marginBottom: 6 }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Click to upload .xlsx or .xls
                    </div>
                    <p className="cpm-file-hint">
                      Required columns: <strong>Client</strong>, <strong>Package</strong><br />
                      Optional: <strong>Notes</strong>, <strong>Client Type</strong>
                    </p>
                    <input id="excelFile" type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} style={{ display: 'none' }} />
                  </label>
                </div>

                {excelPreview.length > 0 && (
                  <div className="cpm-preview-wrap">
                    <div className="cpm-preview-title">{excelPreview.length} projects to import</div>
                    <div className="cpm-preview-scroll">
                      <table className="cpm-preview-table">
                        <thead>
                          <tr>
                            <th>Client</th>
                            <th>Package</th>
                            <th>Client Type</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excelPreview.map((row, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{row.client}</td>
                              <td>{row.package}</td>
                              <td>
                                <div>{row.clientType}</div>
                                {row.clientTypeWarning && <div className="cpm-warn-text">⚠ {row.clientTypeWarning}</div>}
                              </td>
                              <td style={{ color: 'var(--text-muted)' }}>{row.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="cpm-actions">
                  <button type="button" className="cpm-btn-secondary" onClick={onClose}>Cancel</button>
                  <button
                    type="button"
                    className="cpm-btn-primary"
                    onClick={handleBulkCreate}
                    disabled={uploading || excelPreview.length === 0}
                  >
                    {uploading
                      ? `Creating ${excelPreview.length} projects…`
                      : <><FaCheck style={{ fontSize: 10 }} /> Create {excelPreview.length} Projects</>
                    }
                  </button>
                </div>
              </div>
            ) : (

              /* Single project form */
              <form onSubmit={handleSubmit} className="cpm-form">
                <div className="cpm-row">
                  <div className="cpm-field">
                    <label className="cpm-label" htmlFor="clientName">Client Name</label>
                    <input id="clientName" className="cpm-input" type="text" name="clientName" value={formData.clientName} onChange={handleChange} required placeholder="Enter client name" />
                  </div>
                  <div className="cpm-field">
                    <label className="cpm-label" htmlFor="targetCloseMonth">
                      Target Close Month
                      {isPrivateOnlyClient && (
                        <span className="cpm-label-hint">(optional for Private)</span>
                      )}
                    </label>
                    <input
                      id="targetCloseMonth"
                      className="cpm-input"
                      type="month"
                      name="targetCloseMonth"
                      value={formData.targetCloseMonth}
                      onChange={handleChange}
                      required={!isPrivateOnlyClient}
                    />
                  </div>
                </div>

                {/* Client type */}
                <div className="cpm-field">
                  <label className="cpm-label">
                    Client Type <span className="cpm-label-hint">(select up to 2)</span>
                  </label>
                  <div className="cpm-client-grid">
                    {clientTypes.map((type) => {
                      const isSelected = selectedClientTypes.includes(type.value);
                      const canSelect = selectedClientTypes.length < 2 || isSelected;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          className={`cpm-client-card${isSelected ? ' selected' : ''}`}
                          disabled={!canSelect}
                          onClick={() => toggleClientType(type.value)}
                          style={{
                            borderColor: isSelected ? type.color : undefined,
                            boxShadow: isSelected ? `0 0 0 3px ${type.color}18` : undefined,
                          }}
                          title={isSelected ? `Deselect ${type.label}` : canSelect ? `Select ${type.label}` : 'Max 2 types'}
                        >
                          <span className="cpm-client-pill" style={{ backgroundColor: type.color }}>{type.label}</span>
                          {isSelected && (
                            <span className="cpm-client-check" style={{ backgroundColor: type.color }}>
                              <FaCheck />
                            </span>
                          )}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="cpm-client-card cpm-client-add"
                      onClick={() => alert('Add more client types feature coming soon!')}
                      title="Add custom type"
                    >
                      <FaPlus style={{ fontSize: 14 }} />
                    </button>
                  </div>

                  {selectedClientTypes.length > 0 && (
                    <div className="cpm-selection-info">
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedClientTypes.join(', ')}</span>
                        <span style={{ color: 'var(--text-muted)' }}> ({selectedClientTypes.length}/2 selected)</span>
                        {(selectedClientTypes.includes('Premium') || selectedClientTypes.includes('Powered-Up')) && (
                          <div className="crm-note">
                            <FaInfoCircle style={{ fontSize: 10 }} />
                            Automatically assigned to CRM
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="cpm-row">
                  <div className="cpm-field">
                    <label className="cpm-label" htmlFor="package">Package</label>
                    <select id="package" className="cpm-select" name="package" value={formData.package} onChange={handleChange} required>
                      {packages.map((pkg) => <option key={pkg} value={pkg}>{pkg}</option>)}
                    </select>
                  </div>
                  <div className="cpm-field">
                    <label className="cpm-label" htmlFor="priority">Priority</label>
                    <select id="priority" className="cpm-select" name="priority" value={formData.priority} onChange={handleChange} required>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Deliverables */}
                <div className="cpm-field">
                  <label className="cpm-label">Included Deliverables</label>
                  {isPrivateOnlyClient ? (
                    <div
                      className="cpm-selection-info"
                      style={{ marginTop: 0 }}
                    >
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          No specific deliverables yet
                        </span>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                          Private clients can be created normally now and deliverables can be added later.
                        </div>
                      </div>
                    </div>
                  ) : formData.package === 'Custom' ? (
                    <>
                      <p className="cpm-deliverable-hint">Select deliverables for this project:</p>
                      <div className="cpm-deliverables-grid">
                        {allDeliverables.map((d) => (
                          <button
                            key={d}
                            type="button"
                            className={`cpm-deliverable-toggle${selectedDeliverables.includes(d) ? ' checked' : ''}`}
                            onClick={() => toggleDeliverable(d)}
                          >
                            {selectedDeliverables.includes(d) && <FaCheck style={{ fontSize: 9 }} />}
                            {d}
                          </button>
                        ))}
                      </div>
                      {selectedDeliverables.length === 0 && (
                        <p style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 6 }}>Select at least one deliverable</p>
                      )}
                    </>
                  ) : (
                    <div className="cpm-deliverables-preview">
                      {getIncludedDeliverables().map((d) => (
                        <span key={d} className="cpm-deliverable-badge">{d}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="cpm-field">
                  <label className="cpm-label" htmlFor="notes">Notes <span className="cpm-label-hint">(optional)</span></label>
                  <textarea id="notes" className="cpm-textarea" name="notes" value={formData.notes} onChange={handleChange} rows={3} placeholder="Additional notes or requirements..." />
                </div>

                <div className="cpm-divider" />

                <div className="cpm-actions">
                  <button type="button" className="cpm-btn-secondary" onClick={onClose}>Cancel</button>
                  <button type="submit" className="cpm-btn-primary" disabled={loading}>
                    {loading ? 'Creating…' : <><FaCheck style={{ fontSize: 10 }} /> Create Project</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateProjectModal;