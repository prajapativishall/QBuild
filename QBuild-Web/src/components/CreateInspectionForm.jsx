import React, { useState, useEffect } from 'react';
import { projectApi, domainApi, subDomainApi, userApi, queryApi } from '../services/api';
import { toast } from 'react-toastify';
import QueryManagementModal from './QueryManagementModal';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const distributeEvenly100 = (count) => {
  if (count <= 0) return [];
  if (count === 1) return [100];
  const base = round2(100 / count);
  const weights = [];
  let running = 0;
  for (let i = 0; i < count; i += 1) {
    const w = i === count - 1 ? round2(100 - running) : base;
    running += w;
    weights.push(w);
  }
  return weights;
};

const normalizeWeights100 = (items, getWeight, setWeight) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (items.length === 1) return [setWeight({ ...items[0] }, 100)];

  const weights = items.map((it) => {
    const v = getWeight(it);
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const even = distributeEvenly100(items.length);
    return items.map((it, idx) => setWeight({ ...it }, even[idx]));
  }

  const factor = 100 / total;
  const scaled = weights.map((w) => round2(w * factor));
  const scaledTotal = scaled.reduce((a, b) => a + b, 0);
  const delta = round2(100 - scaledTotal);
  if (delta !== 0) scaled[scaled.length - 1] = round2(scaled[scaled.length - 1] + delta);
  return items.map((it, idx) => setWeight({ ...it }, scaled[idx]));
};

/**
 * Validate weightage totals and return array of warning messages.
 * Returns empty array if all weightages sum to 100%.
 */
const validateWeightages = (stages) => {
  const warnings = [];

  if (!stages || stages.length === 0) {
    return ['No domains configured. At least one domain is required.'];
  }

  // Check domain weightages total = 100%
  const domainTotal = round2(stages.reduce((sum, s) => sum + (s.weightage || 0), 0));
  if (Math.abs(domainTotal - 100) > 0.01) {
    warnings.push(`Domain weightages total ${domainTotal}% — must equal 100%.`);
  }

  // Check sub-domain weightages within each domain
  stages.forEach((stage) => {
    if (!stage.sections || stage.sections.length === 0) return;
    const sdTotal = round2(stage.sections.reduce((sum, sec) => sum + (sec.weightage || 0), 0));
    if (Math.abs(sdTotal - 100) > 0.01) {
      warnings.push(`"${stage.stageName}" sub-domain weightages total ${sdTotal}% — must equal 100%.`);
    }
  });

  return warnings;
};

const CreateInspectionForm = ({ project, sourcePhaseNumber, phaseNumber, mode = 'create', onClose, onSuccess }) => {
  const isEditMode = mode === 'edit' && phaseNumber;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weightageWarnings, setWeightageWarnings] = useState([]);
  const [showWeightageWarning, setShowWeightageWarning] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [users, setUsers] = useState([]);
  const [availableStages, setAvailableStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [availableSections, setAvailableSections] = useState([]);
  const [sectionPickerByStageId, setSectionPickerByStageId] = useState({});
  const [queryModalOpen, setQueryModalOpen] = useState(false);
  const [queryTarget, setQueryTarget] = useState({ stageIndex: null, sectionIndex: null });
  const [formData, setFormData] = useState({
    sourcePhaseNumber: isEditMode ? null : (sourcePhaseNumber || null),
    inspectorId: '',
    reviewerId: '',
    viewerId: '',
    description: '',
    startDate: '',
    endDate: '',
    stages: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load users for dropdowns
      try {
        const usersRes = await userApi.getAll();
        if (usersRes.success) setUsers(usersRes.data || []);
      } catch (userErr) { console.warn('Could not load users:', userErr); }

      // Load available domains
      try {
        const domainsRes = await domainApi.getAll();
        if (domainsRes.success) setAvailableStages(domainsRes.data || []);
      } catch (err) { console.warn('Could not load domains:', err); }

      // Load available sub-domains
      try {
        const sectionsRes = await subDomainApi.getAll();
        if (sectionsRes.success) setAvailableSections(sectionsRes.data || []);
      } catch (err) { console.warn('Could not load sub-domains:', err); }

      // Load selected phase configuration for either edit mode or create-from-previous mode.
      const phaseToLoad = isEditMode ? phaseNumber : sourcePhaseNumber;
      if (phaseToLoad && project) {
        const configRes = await projectApi.getPhaseConfiguration(project.id, phaseToLoad);
        if (configRes.success && configRes.data) {
          const config = configRes.data;
          const mappedStages = (config.domains || []).map(domain => ({
            stageId: domain.domain_id,
            stageName: domain.domain_name,
            weightage: domain.weightage || 0,
            sections: (domain.sub_domains || []).map(sd => ({
              sectionId: sd.sub_domain_id,
              sectionName: sd.sub_domain_name,
              weightage: sd.weightage || 0,
              isManual: sd.is_manual,
              queries: (sd.queries || []).map(q => ({ id: q.id, text: q.text, type: q.type || 'primary' }))
            }))
          }));

          setFormData({
            sourcePhaseNumber: isEditMode ? null : sourcePhaseNumber,
            inspectorId: config.inspector_id || '',
            reviewerId: config.reviewer_id || '',
            viewerId: config.viewer_id || '',
            description: config.description || '',
            startDate: config.start_date || '',
            endDate: config.end_date || '',
            stages: mappedStages
          });
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate weightages before submission
    const warnings = validateWeightages(formData.stages);
    if (warnings.length > 0) {
      setWeightageWarnings(warnings);
      setShowWeightageWarning(true);
      setPendingSubmit(true);
      return; // Don't submit until user confirms via warning modal
    }

    await doSubmit();
  };

  const doSubmit = async () => {
    try {
      setSaving(true);
      setShowWeightageWarning(false);

      const mappedDomains = (formData.stages || []).map(stage => ({
        domainId: stage.stageId,
        weightage: stage.weightage,
        subDomains: (stage.sections || []).map(section => ({
          subDomainId: section.sectionId,
          weightage: section.weightage,
          isManual: section.isManual || false,
          queries: section.queries || []
        }))
      }));

      const phaseData = {
        sourcePhaseNumber: formData.sourcePhaseNumber,
        inspectorId: formData.inspectorId ? parseInt(formData.inspectorId) : null,
        reviewerId: formData.reviewerId ? parseInt(formData.reviewerId) : null,
        viewerId: formData.viewerId ? parseInt(formData.viewerId) : null,
        description: formData.description || null,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        domains: mappedDomains
      };

      let response;
      if (isEditMode) {
        response = await projectApi.updatePhase(project.id, phaseNumber, phaseData);
        toast.success('Inspection phase updated successfully!');
      } else {
        response = await projectApi.createPhase(project.id, phaseData);
        toast.success('New inspection phase created successfully!');
      }

      const inspectionId = response?.data?.inspectionId;
      if (inspectionId) {
        toast.success('Phase created successfully! Inspection has been assigned to the inspector.');
        onSuccess && onSuccess();
        return;
      }

      onSuccess && onSuccess();
    } catch (error) {
      console.error('Error saving phase:', error);
      toast.error(error.message || (isEditMode ? 'Failed to update phase' : 'Failed to create new phase'));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmProceedWithWarnings = () => {
    setPendingSubmit(false);
    doSubmit();
  };

  const handleAddStage = async () => {
    if (!selectedStageId) {
      toast.error('Please select a domain');
      return;
    }

    const stage = availableStages.find(s => s.id === parseInt(selectedStageId));
    if (!stage) return;

    if (formData.stages.some(s => s.stageId === stage.id)) {
      toast.error('Domain already added');
      setSelectedStageId('');
      return;
    }

    let sections = [];
    try {
      const response = await domainApi.getSubDomains(stage.id);
      if (response.success && response.data) {
        sections = response.data.map(item => ({
          sectionId: item.sub_domain_id,
          sectionName: item.sub_domain_name,
          weightage: item.weightage || 0,
          queries: []
        }));

        // Load linked queries for each sub-domain so defaults appear in the form
        try {
          const queryPromises = sections.map(s => queryApi.getLinkedToSubDomain(s.sectionId).catch(() => ({ success: false })));
          const queriesResults = await Promise.all(queryPromises);
          sections = sections.map((s, idx) => {
            const qr = queriesResults[idx];
            if (qr && qr.success && Array.isArray(qr.data) && qr.data.length > 0) {
              return {
                ...s,
                queries: qr.data.map(q => ({ id: q.id || q.query_id, text: q.question_text || q.text || q.question || q.name, type: q.query_type || q.type || 'primary' }))
              };
            }
            return s;
          });
        } catch (qerr) {
          console.warn('Failed loading linked queries for sub-domains:', qerr);
        }

        sections = normalizeWeights100(
          sections,
          s => s.weightage,
          (s, w) => ({ ...s, weightage: w })
        );
      }
    } catch (error) {
      console.error('Error loading sub-domains:', error);
    }

    const newStage = {
      stageId: stage.id,
      stageName: stage.name,
      weightage: 0,
      sections
    };

    setFormData(prev => {
      const nextStages = [...prev.stages, newStage];
      const normalized = normalizeWeights100(
        nextStages,
        s => s.weightage,
        (s, w) => ({ ...s, weightage: w })
      );
      return { ...prev, stages: normalized };
    });
    setSelectedStageId('');
  };

  const handleRemoveStage = (index) => {
    setFormData(prev => {
      const removed = prev.stages.filter((_, i) => i !== index);
      const normalized = normalizeWeights100(
        removed,
        s => s.weightage,
        (s, w) => ({ ...s, weightage: w })
      );
      return { ...prev, stages: normalized };
    });
  };

  const handleStageWeightChange = (stageIndex, rawValue) => {
    // Simply update the one weight value without touching others.
    // Only enforced rule: individual weight cannot exceed 100.
    setFormData(prev => {
      const stages = [...prev.stages];
      const parsed = rawValue === '' ? 0 : (Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0);
      stages[stageIndex] = { ...stages[stageIndex], weightage: round2(Math.max(0, Math.min(100, parsed))) };
      return { ...prev, stages };
    });
  };

  const handleAddSectionToStage = async (stageIndex) => {
    const stage = formData.stages?.[stageIndex];
    if (!stage) return;

    const picker = sectionPickerByStageId[stage.stageId] || { sectionId: '', weightage: '' };
    const sectionId = parseInt(picker.sectionId);
    if (!Number.isFinite(sectionId)) return;

    const section = availableSections.find((s) => s.id === sectionId);
    if (!section) return;

    // Load linked queries for this sub-domain and add the section with default queries
    let linked = [];
    try {
      const qr = await queryApi.getLinkedToSubDomain(sectionId);
      if (qr && qr.success && Array.isArray(qr.data)) {
        linked = qr.data.map(q => ({ id: q.id || q.query_id, text: q.question_text || q.text || q.question || q.name, type: q.query_type || q.type || 'primary' }));
      }
    } catch (err) {
      console.warn('Failed to load linked queries for section:', err);
    }

    setFormData((prev) => {
      const stages = [...(prev.stages || [])];
      const target = stages[stageIndex];
      const existing = Array.isArray(target.sections) ? target.sections : [];
      if (existing.some((x) => x.sectionId === sectionId)) return prev;

      const appended = [...existing, { sectionId, sectionName: section.name, weightage: 0, queries: linked }];
      const normalized = normalizeWeights100(
        appended,
        (s) => s.weightage,
        (s, w) => ({ ...s, weightage: w })
      );
      stages[stageIndex] = { ...target, sections: normalized };
      return { ...prev, stages };
    });

    setSectionPickerByStageId((prevPickers) => ({
      ...prevPickers,
      [stage.stageId]: { sectionId: '', weightage: '' }
    }));
  };



  const handleRemoveSection = (stageIndex, sectionIndex) => {
    setFormData(prev => {
      const stages = [...prev.stages];
      const target = { ...stages[stageIndex] };
      const removed = target.sections.filter((_, i) => i !== sectionIndex);
      const normalized = normalizeWeights100(
        removed,
        s => s.weightage,
        (s, w) => ({ ...s, weightage: w })
      );
      target.sections = normalized;
      stages[stageIndex] = target;
      return { ...prev, stages };
    });
  };

  const handleSectionWeightChange = (stageIndex, sectionIndex, rawValue) => {
    // Simply update the one weight value without touching others.
    // Only enforced rule: individual weight cannot exceed 100.
    setFormData(prev => {
      const stages = [...prev.stages];
      const target = { ...stages[stageIndex] };
      const sections = [...(target.sections || [])];
      const parsed = rawValue === '' ? 0 : (Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0);
      const weight = round2(Math.max(0, Math.min(100, parsed)));
      sections[sectionIndex] = { ...sections[sectionIndex], weightage: weight, isManual: weight > 0 };
      target.sections = sections;
      stages[stageIndex] = target;
      return { ...prev, stages };
    });
  };

  const handleOpenQueryModal = (stageIndex, sectionIndex) => {
    setQueryTarget({ stageIndex, sectionIndex });
    setQueryModalOpen(true);
  };

  const handleSaveQueriesForSection = (stageIndex, sectionIndex, selectedQueries) => {
    setFormData(prev => {
      const stages = [...prev.stages];
      const target = { ...stages[stageIndex] };
      const sections = [...(target.sections || [])];
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        queries: selectedQueries.map(q => ({
          id: q.id,
          text: q.text,
          type: q.type || 'primary'
        }))
      };
      target.sections = sections;
      stages[stageIndex] = target;
      return { ...prev, stages };
    });
    setQueryModalOpen(false);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading configuration...</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Personnel Assignment */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>Personnel Assignment</h3>
        <div className="form-group">
          <label className="form-label">Assign Inspector</label>
          <select className="form-input" value={formData.inspectorId} onChange={(e) => setFormData({...formData, inspectorId: e.target.value})}>
            <option value="">Select Inspector</option>
            {users.filter(u => u.role === 'inspector').map(u => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Assign Reviewer</label>
          <select className="form-input" value={formData.reviewerId} onChange={(e) => setFormData({...formData, reviewerId: e.target.value})}>
            <option value="">Select Reviewer</option>
            {users.filter(u => u.role === 'reviewer').map(u => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Assign Viewer</label>
          <select className="form-input" value={formData.viewerId} onChange={(e) => setFormData({...formData, viewerId: e.target.value})}>
            <option value="">Select Viewer</option>
            {users.filter(u => u.role === 'viewer').map(u => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Phase Details */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>Phase Details</h3>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-input"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Enter phase description (optional)"
            rows={3}
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={formData.startDate}
              onChange={(e) => setFormData({...formData, startDate: e.target.value})}
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-input"
              value={formData.endDate}
              onChange={(e) => setFormData({...formData, endDate: e.target.value})}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Domain Selection & Configuration */}
      <div style={{ marginTop: '20px', borderTop: '1px solid #e0e0e0', paddingTop: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', color: '#333' }}>Domains Configuration</h3>
        
        <div className="form-group">
          <label className="form-label">Add Domain</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="form-input" value={selectedStageId} onChange={(e) => setSelectedStageId(e.target.value)}>
              <option value="">Select Domain</option>
              {availableStages.filter(s => !formData.stages.some(ex => ex.stageId === s.id)).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={handleAddStage} style={{ whiteSpace: 'nowrap' }}>Add</button>
          </div>
        </div>

        {formData.stages.length === 0 ? (
          <p style={{ color: '#9ca3af', fontStyle: 'italic', padding: '20px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px' }}>
            No domains configured. Add domains above or load from a previous phase.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {formData.stages.map((stage, sIdx) => (
              <div key={stage.stageId || sIdx} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: '#1d4ed8' }}>{stage.stageName || `Domain ${sIdx + 1}`}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>Weightage:</span>
                    <input type="number" min="0" max="100" step="0.01" value={stage.weightage}
                      onChange={(e) => handleStageWeightChange(sIdx, e.target.value)}
                      style={{ width: '70px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
                    <button type="button" onClick={() => handleRemoveStage(sIdx)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px', padding: '0' }}>×</button>
                  </div>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>Sub-Domains</span>
                  </div>
                  {stage.sections.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic', padding: '8px 0' }}>No sub-domains</p>
                  ) : (
                    stage.sections.map((section, secIdx) => (
                      <div key={section.sectionId || secIdx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 0', borderBottom: '1px solid #f3f4f6'
                      }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '14px', color: '#374151' }}>{section.sectionName}</span>
                          {section.isManual && <span style={{ fontSize: '11px', color: '#f59e0b', marginLeft: '6px' }}>(Manual)</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', color: '#6b7280' }}>Wt:</span>
                          <input type="number" min="0" max="100" step="0.01" value={section.weightage}
                            onChange={(e) => handleSectionWeightChange(sIdx, secIdx, e.target.value)}
                            style={{ width: '60px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} />
                          <button type="button" className="btn btn-sm" onClick={() => handleOpenQueryModal(sIdx, secIdx)} style={{ fontSize: '12px' }}>
                            Queries ({section.queries?.length || 0})
                          </button>
                          <button type="button" onClick={() => handleRemoveSection(sIdx, secIdx)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px', padding: '0' }}>×</button>
                        </div>
                      </div>
                    ))
                  )}
                  {/* Sub-domain add section - dropdown + button like Projects.jsx */}
                  <div style={{ marginTop: '12px', padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                    <select
                      className="form-input"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                      value={(sectionPickerByStageId[stage.stageId]?.sectionId) || ''}
                      onChange={(e) => setSectionPickerByStageId(prev => ({ 
                        ...prev, 
                        [stage.stageId]: { ...prev[stage.stageId], sectionId: e.target.value } 
                      }))}
                    >
                      <option value="">Select sub-domain to add...</option>
                      {availableSections
                        .filter(sec => !(stage.sections || []).some(s => s.sectionId === sec.id))
                        .map(sec => (
                          <option key={sec.id} value={sec.id}>{sec.name}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleAddSectionToStage(sIdx)}
                      style={{ marginTop: '8px', fontSize: '12px', padding: '4px 8px' }}
                    >
                      Add Sub-domain
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #e0e0e0', paddingTop: '16px' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Inspection')}
        </button>
      </div>

      {/* Query Management Modal */}
      <QueryManagementModal
        isOpen={queryModalOpen}
        onClose={() => setQueryModalOpen(false)}
        projectId={project?.id}
        stageIndex={queryTarget.stageIndex}
        sectionIndex={queryTarget.sectionIndex}
        stages={formData.stages}
        onSave={handleSaveQueriesForSection}
      />
    </form>
  );
};

export default CreateInspectionForm;
