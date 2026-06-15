import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useApi from '../hooks/useApi';
import { 
  fetchCustomerAnalytics, 
  listCustomers, 
  createCustomer, 
  deleteCustomer,
  ocrImportInvoice,
  createOrder,
  type OcrExtractedData
} from '../services/api';
import type { Customer } from '../services/api';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import { BrandedEmptyState } from '../components/BrandedEmptyState';
import { PremiumGlassCard } from '../components/PremiumGlassCard';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

/* ────────────────────────────────────────────────────────
   0. OCR IMPORT MODAL
   ──────────────────────────────────────────────────────── */
const CATEGORIES = ['Fashion', 'Beauty', 'Coffee', 'Lifestyle', 'Electronics', 'Other'];

interface OcrImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const OcrImportModal: React.FC<OcrImportModalProps> = React.memo(({ isOpen, onClose, onSuccess }) => {
  const [phase, setPhase] = useState<'upload' | 'scanning' | 'preview' | 'creating'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setExtracted] = useState<OcrExtractedData | null>(null);

  // Editable preview form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [amount, setAmount] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [category, setCategory] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPhase('upload');
    setDragOver(false);
    setError(null);
    setExtracted(null);
    setFirstName(''); setLastName(''); setEmail(''); setPhone('');
    setCity(''); setAmount(''); setOrderDate(''); setCategory('');
  };

  const handleClose = () => { reset(); onClose(); };

  const processFile = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload JPG, PNG, WebP, or PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10 MB.');
      return;
    }

    setError(null);
    setPhase('scanning');

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          // Strip data URI prefix (data:image/jpeg;base64,...)
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await ocrImportInvoice(base64, file.name, file.type);
      if (!response.success) {
        throw new Error(response.message || 'Extraction failed');
      }

      const d = response.data;
      setExtracted(d);
      setFirstName(d.firstName || '');
      setLastName(d.lastName || '');
      setEmail(d.email || '');
      setPhone(d.phone || '');
      setCity(d.city || '');
      setAmount(d.amount > 0 ? String(d.amount) : '');
      setOrderDate(d.orderDate || new Date().toISOString().split('T')[0]);
      setCategory(d.category || 'Other');
      
      console.log('FORM_STATE', { 
        firstName: d.firstName, 
        lastName: d.lastName, 
        email: d.email, 
        phone: d.phone, 
        city: d.city, 
        amount: d.amount, 
        orderDate: d.orderDate, 
        category: d.category 
      });

      setPhase('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to extract data from document.');
      setPhase('upload');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleConfirm = async () => {
    if (!firstName.trim() || !email.trim() || !amount) {
      setError('Name, email, and amount are required.');
      return;
    }
    setPhase('creating');
    setError(null);
    try {
      // 1. Create or find customer
      let customerId: string;
      try {
        const newCustomer = await createCustomer({
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || '+910000000000',
          city: city.trim() || 'Unknown',
          totalSpend: Number(amount) || 0,
          totalOrders: 1,
          lastPurchaseDate: orderDate || new Date().toISOString().split('T')[0],
        });
        customerId = newCustomer.id;
      } catch (custErr: any) {
        const msg = custErr.message || '';
        if (msg.toLowerCase().includes('email already exists')) {
          throw new Error('A customer with this email already exists. Please edit their record directly.');
        }
        throw custErr;
      }

      // 2. Create order linked to customer
      await createOrder({
        customerId,
        amount: Number(amount),
        category: category || 'Other',
        orderDate: orderDate || new Date().toISOString().split('T')[0],
      });

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create customer and order.');
      setPhase('preview');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
    }}>
      <style>{`
        @keyframes ocrPulse { 0%,100% { opacity:.4; transform:scale(.96); } 50% { opacity:1; transform:scale(1); } }
        @keyframes ocrSpin  { to { transform:rotate(360deg); } }
        @keyframes ocrScanLine { 0%,100%{ top:8%; } 50%{ top:88%; } }
      `}</style>

      <div style={{
        width: phase === 'preview' ? 560 : 460, maxHeight: '90vh', overflowY: 'auto',
        background: 'linear-gradient(145deg, #0d1526 0%, #111827 100%)',
        border: '1px solid rgba(79,140,255,0.2)', borderRadius: 20,
        boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(79,140,255,0.08)',
        transition: 'width 350ms cubic-bezier(.16,1,.3,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, background: 'rgba(79,140,255,0.15)',
                border: '1px solid rgba(79,140,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4F8CFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>Invoice OCR Import</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                  {phase === 'upload' && 'Upload a receipt or invoice'}
                  {phase === 'scanning' && 'AI is extracting data...'}
                  {phase === 'preview' && 'Review & confirm extracted data'}
                  {phase === 'creating' && 'Creating customer & order...'}
                </div>
              </div>
            </div>
          </div>
          <button type="button" onClick={handleClose}
            style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          {/* Error banner */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 16,
              fontSize: 12, color: '#FCA5A5', lineHeight: 1.5,
            }}>{error}</div>
          )}

          {/* PHASE: Upload */}
          {phase === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#4F8CFF' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 16, padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'rgba(79,140,255,0.05)' : 'rgba(255,255,255,0.02)',
                transition: 'all 250ms',
              }}
            >
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                style={{ display: 'none' }} onChange={handleFileSelect} />
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
                background: 'rgba(79,140,255,0.12)', border: '1px solid rgba(79,140,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4F8CFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16"/>
                  <line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 6 }}>Drop your invoice here</div>
              <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
                JPG, PNG, WebP, or PDF &nbsp;·&nbsp; Max 10 MB<br/>
                <span style={{ color: '#4F8CFF', fontWeight: 500 }}>Click to browse</span> or drag & drop
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {['Receipt', 'Invoice', 'Bill', 'Order Slip'].map(t => (
                  <span key={t} style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(79,140,255,0.08)', border: '1px solid rgba(79,140,255,0.2)',
                    color: '#94A3B8', fontWeight: 500
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* PHASE: Scanning */}
          {phase === 'scanning' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 20px' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  border: '3px solid rgba(79,140,255,0.15)',
                  borderTop: '3px solid #4F8CFF',
                  animation: 'ocrSpin 1s linear infinite'
                }}/>
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  fontSize: 24,
                }}>🤖</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 6 }}>AI Analysing Document</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>Extracting customer & order details via Groq Vision...</div>
              <div style={{ marginTop: 20, display: 'flex', gap: 6, justifyContent: 'center' }}>
                {['Reading invoice...', 'Identifying fields...', 'Structuring data...'].map((s, i) => (
                  <div key={i} style={{
                    fontSize: 10, color: '#4F8CFF', padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(79,140,255,0.08)', border: '1px solid rgba(79,140,255,0.2)',
                    animation: `ocrPulse 1.5s ${i * 0.4}s infinite`,
                  }}>{s}</div>
                ))}
              </div>
            </div>
          )}

          {/* PHASE: Preview */}
          {phase === 'preview' && (
            <div>
              <div style={{
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12,
                color: '#6EE7B7', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span>✓</span>
                <span>AI extraction complete. Review and edit fields before confirming.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>First Name</label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#F1F5F9', fontSize: 13 }}
                    placeholder="First name" />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Last Name</label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#F1F5F9', fontSize: 13 }}
                    placeholder="Last name" />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Email Address *</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#F1F5F9', fontSize: 13 }}
                  placeholder="Email address" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Phone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#F1F5F9', fontSize: 13 }}
                    placeholder="Phone number" />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>City</label>
                  <input value={city} onChange={e => setCity(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#F1F5F9', fontSize: 13 }}
                    placeholder="City" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Amount (₹) *</label>
                  <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '8px 12px', color: '#6EE7B7', fontSize: 13, fontWeight: 600 }}
                    placeholder="0" />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Order Date</label>
                  <input value={orderDate} onChange={e => setOrderDate(e.target.value)} type="date"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#F1F5F9', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#F1F5F9', fontSize: 13, cursor: 'pointer' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setPhase('upload')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 18px', color: '#94A3B8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ← Re-upload
                </button>
                <button type="button" onClick={handleConfirm}
                  style={{
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    border: 'none', borderRadius: 10, padding: '9px 22px',
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
                  }}>
                  ✓ Create Customer & Order
                </button>
              </div>
            </div>
          )}

          {/* PHASE: Creating */}
          {phase === 'creating' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>⚡</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 6 }}>Creating Records</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>Saving customer profile and order to the CRM...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/* ────────────────────────────────────────────────────────
   1. EXTRACED MODAL COMPONENT (Isolates Form State to prevent page re-renders)
   ──────────────────────────────────────────────────────── */
interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (customer: {
    name: string;
    email: string;
    phone: string;
    city: string;
    totalSpend: number;
    totalOrders: number;
    lastPurchaseDate: string;
  }) => Promise<void>;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = React.memo(({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [totalSpend, setTotalSpend] = useState('0');
  const [totalOrders, setTotalOrders] = useState('0');
  const [lastPurchaseDate, setLastPurchaseDate] = useState(new Date().toISOString().substring(0, 10));

  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedCity = city.trim();

    if (!trimmedName) {
      setFormError('Missing required field');
      setFormLoading(false);
      return;
    }

    if (!trimmedEmail) {
      setFormError('Missing required field');
      setFormLoading(false);
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setFormError('Invalid email format');
      setFormLoading(false);
      return;
    }

    if (!trimmedPhone) {
      setFormError('Missing required field');
      setFormLoading(false);
      return;
    }
    if (!/^[0-9]{10}$/.test(trimmedPhone)) {
      setFormError('Phone number must be exactly 10 digits');
      setFormLoading(false);
      return;
    }

    if (!trimmedCity) {
      setFormError('Missing required field');
      setFormLoading(false);
      return;
    }

    try {
      await onSubmit({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        city: trimmedCity,
        totalSpend: Number(totalSpend) || 0,
        totalOrders: Number(totalOrders) || 0,
        lastPurchaseDate
      });
      // Reset fields on success
      setName('');
      setEmail('');
      setPhone('');
      setCity('');
      setTotalSpend('0');
      setTotalOrders('0');
      setLastPurchaseDate(new Date().toISOString().substring(0, 10));
      onClose();
    } catch (err: any) {
      let userMessage = err.message || 'Failed to create customer.';
      if (typeof userMessage === 'string') {
        const lower = userMessage.toLowerCase();
        if (lower.includes('insert into') || lower.includes('failed query') || lower.includes('select ') || lower.includes('update ') || lower.includes('delete ') || lower.includes('uuid') || lower.includes('postgres') || lower.includes('drizzle')) {
          userMessage = 'An unexpected database error occurred. Please try again.';
        }
      }
      setFormError(userMessage);
    } finally {
      setFormLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <PremiumGlassCard className="card" style={{ width: '450px', background: '#111827', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <h3 className="text-subheading font-semibold" style={{ fontSize: '16px' }}>New Customer Record</h3>
          <button 
            type="button" 
            className="btn-remove" 
            onClick={onClose}
            style={{ fontSize: '16px', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        {formError && (
          <div className="alert-error" style={{ marginBottom: '12px', fontSize: '12px', padding: '8px 12px' }}>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '9px' }}>Full Name *</label>
            <input 
              type="text" 
              required
              className="form-input" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Enter full name"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '9px' }}>Email Address *</label>
              <input 
                type="email" 
                required
                className="form-input" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Enter email address"
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '9px' }}>Phone Number *</label>
              <input 
                type="text" 
                required
                className="form-input" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '9px' }}>City *</label>
              <input 
                type="text" 
                required
                className="form-input" 
                value={city} 
                onChange={(e) => setCity(e.target.value)} 
                placeholder="Enter city"
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '9px' }}>Last Purchase Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={lastPurchaseDate} 
                onChange={(e) => setLastPurchaseDate(e.target.value)} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '9px' }}>Total Spend (₹)</label>
              <input 
                type="number" 
                className="form-input" 
                value={totalSpend} 
                onChange={(e) => setTotalSpend(e.target.value)} 
                placeholder="Enter total spend"
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '9px' }}>Total Orders</label>
              <input 
                type="number" 
                className="form-input" 
                value={totalOrders} 
                onChange={(e) => setTotalOrders(e.target.value)} 
                placeholder="Enter total orders"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formLoading}>
              {formLoading ? 'Creating...' : 'Add Customer'}
            </button>
          </div>
        </form>
      </PremiumGlassCard>
    </div>
  );
});

/* ─── Premium Rich Geographic Tooltip Component ─── */
const GeographicTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0].payload;
    const name = entry.name;
    const value = entry.value;
    const percentage = entry.percentage;
    const color = entry.color;

    let description = null;
    if (name === 'Other Cities' && entry.allCities) {
      const cityList = entry.allCities.slice(0, 8).map((c: any) => `${c.city} (${c.count})`).join(', ');
      const hasMore = entry.allCities.length > 8;
      description = (
        <div style={{ fontSize: '10px', color: '#64748B', marginTop: '6px', maxWidth: '220px', wordBreak: 'break-word', lineHeight: 1.4 }}>
          Includes: {cityList}{hasMore ? '...' : ''}
        </div>
      );
    }

    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${color}40`,
        borderRadius: '10px',
        padding: '10px 14px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>{name}</span>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>
          {value.toLocaleString()} customers <span style={{ color: '#64748B', fontSize: '11px', fontWeight: 400 }}>({percentage.toFixed(1)}%)</span>
        </div>
        {description}
      </div>
    );
  }
  return null;
};

/* ────────────────────────────────────────────────────────
   2. MAIN CUSTOMERS PAGE COMPONENT
   ──────────────────────────────────────────────────────── */
export const Customers: React.FC = () => {
  const { data: customerData, loading: loadingAnalytics, error: errorAnalytics, refetch: refetchAnalytics } = useApi(fetchCustomerAnalytics);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [errorList, setErrorList] = useState<string | null>(null);
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

  // Form modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setErrorList(null);
    try {
      const res = await listCustomers();
      setCustomers(res);
    } catch (e: any) {
      setErrorList(e.message || 'Failed to load customers directory.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  const handleOcrSuccess = useCallback(() => {
    fetchList();
    refetchAnalytics();
  }, [fetchList, refetchAnalytics]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleCreateCustomerSubmit = useCallback(async (newCust: {
    name: string;
    email: string;
    phone: string;
    city: string;
    totalSpend: number;
    totalOrders: number;
    lastPurchaseDate: string;
  }) => {
    await createCustomer(newCust);
    // Refetch stats and directory list
    fetchList();
    refetchAnalytics();
  }, [fetchList, refetchAnalytics]);

  const handleDelete = useCallback(async (customerId: string) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      await deleteCustomer(customerId);
      fetchList();
      refetchAnalytics();
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer.');
    }
  }, [fetchList, refetchAnalytics]);

  // City Distribution calculations (Memoized)
  const cityDistribution = useMemo(() => customerData?.cityDistribution || [], [customerData]);
  const totalCustomers = useMemo(() => customerData?.totalCustomers || 1, [customerData]);
  const totalCities = useMemo(() => cityDistribution.length, [cityDistribution]);

  // Sorted list for rankings (Memoized)
  const sortedCities = useMemo(() => {
    return [...cityDistribution].sort((a, b) => b.count - a.count);
  }, [cityDistribution]);

  const totalDemographics = useMemo(() => {
    return sortedCities.reduce((acc, curr) => acc + curr.count, 0) || 1;
  }, [sortedCities]);

  // Donut chart segments calculation (Memoized for Recharts)
  const donutSegmentsData = useMemo(() => {
    const top3 = sortedCities.slice(0, 3);
    const othersCount = sortedCities.slice(3).reduce((acc, curr) => acc + curr.count, 0);
    const colors = ['#4F8CFF', '#7C5CFF', '#22D3EE', '#10B981'];

    const data: Array<{ name: string; value: number; percentage: number; color: string; allCities?: any[] }> = top3.map((c, i) => ({
      name: c.city,
      value: c.count,
      percentage: (c.count / totalDemographics) * 100,
      color: colors[i]
    }));

    if (othersCount > 0) {
      data.push({
        name: 'Other Cities',
        value: othersCount,
        percentage: (othersCount / totalDemographics) * 100,
        color: colors[3],
        allCities: sortedCities.slice(3)
      });
    }
    return data;
  }, [sortedCities, totalDemographics]);

  // Paginated customers list (Memoized)
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return customers.slice(startIndex, startIndex + itemsPerPage);
  }, [customers, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(customers.length / itemsPerPage) || 1;
  }, [customers]);

  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const handlePageSelect = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  if (loadingAnalytics && customers.length === 0) {
    return (
      <div className="flex-align-center justify-center" style={{ minHeight: '300px' }}>
        <p className="text-subheading font-medium">Loading customers directory...</p>
      </div>
    );
  }

  if (errorAnalytics && customers.length === 0) {
    return (
      <PremiumGlassCard className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <p className="text-body text-danger">Failed to load customers directory.</p>
        <button className="btn btn-primary margin-top-md" onClick={() => window.location.reload()}>Retry</button>
      </PremiumGlassCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* 1. Top Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard
          label="Total Index Customers"
          value={totalCustomers.toLocaleString('en-IN')}
          trend="+14.5%"
          trendText="Vs last quarter"
          sparkline={[9200, 9350, 9500, 9680, 9820, 9950, 10008]}
          className="accent-kpi-customers"
        />
        <StatCard
          label="Cities Represented"
          value={totalCities.toString()}
          trend="+4.8%"
          trendText="Active regional expansion"
          sparkline={[12, 12, 13, 13, 14, 14, 15]}
          className="accent-kpi-customers"
        />
        <StatCard
          label="Average Customer Spend"
          value="₹36,069"
          trend="+5.2%"
          trendText="AOV: ₹6,957"
          sparkline={[34500, 35100, 34800, 35400, 35900, 36000, 36069]}
          className="accent-kpi-revenue"
        />
        <StatCard
          label="Active Profiles Rate"
          value="98.2%"
          trend="+0.4%"
          trendText="Attributed delivery receipt"
          sparkline={[97.8, 97.9, 98.1, 98.0, 98.2, 98.1, 98.2]}
          className="accent-kpi-performance"
        />
      </div>

      {/* 2. Visual Demographic distribution row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '16px', alignItems: 'start' }}>
        
        {/* Left Side: Ranked Demographics Table/List */}
        <PremiumGlassCard className="card">
          <div style={{ marginBottom: '16px' }}>
            <h3 className="text-subheading font-semibold">Client Volume Distribution</h3>
            <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>Ranked customer regional densities per database records.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {sortedCities.slice(0, 5).map((cityObj, i) => {
              const percentage = ((cityObj.count / totalDemographics) * 100).toFixed(1);
              const color = i === 0 ? 'var(--accent-blue)' : i === 1 ? 'var(--accent-indigo)' : i === 2 ? 'var(--accent-cyan)' : 'var(--accent-emerald)';
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      #{i + 1} {cityObj.city}
                    </span>
                    <span className="text-muted" style={{ fontSize: '11px' }}>
                      {cityObj.count.toLocaleString()} customers ({percentage}%)
                    </span>
                  </div>
                  <div className="dist-bar-track" style={{ height: '8px' }}>
                    <div 
                      className="dist-bar-fill" 
                      style={{ 
                        width: `${percentage}%`, 
                        background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.05))` 
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </PremiumGlassCard>

        {/* Right Side: Recharts Pie Chart Demographic segments */}
        <PremiumGlassCard className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '304px' }}>
          <div style={{ width: '100%', marginBottom: '12px' }}>
            <h3 className="text-subheading font-semibold">Geography Segment Share</h3>
            <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>Attributed volume percentage splits.</p>
          </div>

          {/* Interactive Donut Chart container */}
          <div style={{ position: 'relative', width: '100%', height: '180px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '8px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={donutSegmentsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={(_, index) => setHoveredSlice(index)}
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  {donutSegmentsData.map((entry, index) => {
                    const isHovered = hoveredSlice === index;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        style={{
                          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                          transformOrigin: 'center',
                          transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
                          filter: isHovered ? `drop-shadow(0 0 8px ${entry.color}60)` : 'none',
                          cursor: 'pointer'
                        }}
                      />
                    );
                  })}
                </Pie>
                <Tooltip content={<GeographicTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-1px', lineHeight: 1 }}>{totalCities}</span>
              <span className="text-label" style={{ fontSize: '8px', color: '#64748B', marginTop: '4px', fontWeight: 600 }}>CITIES TOTAL</span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', width: '100%', marginTop: '20px' }}>
            {donutSegmentsData.map((seg, idx) => {
              const isHovered = hoveredSlice === idx;
              return (
                <div key={idx} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '11px',
                  opacity: hoveredSlice !== null && !isHovered ? 0.45 : 1,
                  transition: 'opacity 200ms ease'
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }}></span>
                  <span className="font-medium" style={{ 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    maxWidth: '80px',
                    color: isHovered ? '#F1F5F9' : '#F1F5F9',
                    fontWeight: isHovered ? 700 : 500
                  }}>{seg.name}</span>
                  <span className="text-muted" style={{ marginLeft: 'auto', fontSize: '10px' }}>{seg.percentage.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </PremiumGlassCard>

      </div>

      {/* 3. Detailed Client Volume Table */}
      <PremiumGlassCard className="card">
        <h3 className="text-subheading font-semibold" style={{ marginBottom: '12px' }}>Index Database Directory</h3>
        <div className="table-container" style={{ maxHeight: '250px' }}>
          <DataTable
            columns={[
              { key: 'rank', label: 'Rank' },
              { key: 'city', label: 'City Location', sortable: true },
              { key: 'count', label: 'Index Client Volume', sortable: true },
              { key: 'percentage', label: 'Proportion Share' }
            ]}
            data={sortedCities}
            renderRow={(item, idx) => {
              const percentage = ((item.count / totalDemographics) * 100).toFixed(1);
              return (
                <tr key={idx}>
                  <td className="font-semibold" style={{ color: 'var(--text-muted)' }}>#{idx + 1}</td>
                  <td className="font-semibold">{item.city}</td>
                  <td>{item.count.toLocaleString('en-IN')} customers</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="font-medium">{percentage}%</span>
                      <div className="dist-bar-track" style={{ width: '60px', height: '4px', marginBottom: 0 }}>
                        <div className="dist-bar-fill dist-fill-blue" style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            }}
          />
        </div>
      </PremiumGlassCard>

      {/* 4. Customers Directory List with Pagination */}
      <PremiumGlassCard className="card">
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <div>
            <h3 className="text-subheading font-semibold">Customers Directory</h3>
            <p className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
              Manage customer records, contact info, and aggregate spend metrics. (Showing {itemsPerPage} per page, page {currentPage} of {totalPages})
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsModalOpen(true)}
          >
            + Add Customer
          </button>
          <button
            type="button"
            onClick={() => setIsOcrModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, rgba(79,140,255,0.15), rgba(139,92,246,0.15))',
              border: '1px solid rgba(79,140,255,0.35)',
              borderRadius: 8, padding: '7px 14px',
              color: '#93C5FD', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 200ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(79,140,255,0.25), rgba(139,92,246,0.25))'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(79,140,255,0.15), rgba(139,92,246,0.15))'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Import Invoice
          </button>
        </div>

        {loadingList ? (
          <p className="text-body text-muted">Loading directory…</p>
        ) : errorList ? (
          <p className="text-body text-danger">{errorList}</p>
        ) : customers.length === 0 ? (
          <BrandedEmptyState
            title="No customers registered"
            description="Use the button above to add the first customer into the CRM database."
          />
        ) : (
          <>
            <div className="table-container" style={{ maxHeight: '400px' }}>
              <DataTable
                columns={[
                  { key: 'avatar',           label: '' },
                  { key: 'name',             label: 'Customer Name' },
                  { key: 'email',            label: 'Email' },
                  { key: 'phone',            label: 'Phone' },
                  { key: 'city',             label: 'City' },
                  { key: 'totalSpend',       label: 'Total Spend',   sortable: true },
                  { key: 'totalOrders',      label: 'Orders',        sortable: true },
                  { key: 'lastPurchaseDate', label: 'Last Purchase' },
                  { key: 'actions',          label: '' },
                ]}
                data={paginatedCustomers}
                renderRow={(item) => {
                  const fullName = `${item.firstName} ${item.lastName}`.trim();
                  const initials = fullName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
                  const colors = ['#4F8CFF','#8B5CF6','#10B981','#F59E0B','#22D3EE'];
                  const colorIdx = fullName.charCodeAt(0) % colors.length;
                  return (
                    <tr key={item.id}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                      style={{ transition: 'background 150ms', cursor: 'default' }}
                    >
                      <td style={{ width: 38 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: `${colors[colorIdx]}22`, border: `1px solid ${colors[colorIdx]}40`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700, color: colors[colorIdx],
                        }}>{initials}</div>
                      </td>
                      <td className="font-semibold" style={{ fontSize: '13px' }}>{fullName}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.email}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.phone}</td>
                      <td>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                          background: 'rgba(79,140,255,0.1)', color: '#4F8CFF',
                          border: '1px solid rgba(79,140,255,0.2)',
                        }}>{item.city}</span>
                      </td>
                      <td className="font-medium" style={{ fontSize: '13px' }}>₹{Number(item.totalSpend).toLocaleString('en-IN')}</td>
                      <td style={{ fontSize: '13px' }}>{item.totalOrders}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {item.lastPurchaseDate ? new Date(item.lastPurchaseDate).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <button className="btn-remove" onClick={() => handleDelete(item.id)}
                          style={{ fontSize: '11px', padding: '3px 8px' }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                }}
              />
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '8px 0' }}>
                <button 
                  className="btn btn-sm"
                  onClick={handlePrevPage} 
                  disabled={currentPage === 1}
                  style={{ minWidth: '70px' }}
                >
                  Previous
                </button>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Display surrounding pages
                    let pageNum = i + 1;
                    if (currentPage > 3) {
                      pageNum = currentPage - 3 + i;
                    }
                    if (pageNum + (5 - i - 1) > totalPages) {
                      pageNum = totalPages - 4 + i;
                    }
                    pageNum = Math.max(pageNum, 1);
                    if (pageNum > totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : ''}`}
                        onClick={() => handlePageSelect(pageNum)}
                        style={{ width: '32px', height: '32px', padding: 0 }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button 
                  className="btn btn-sm" 
                  onClick={handleNextPage} 
                  disabled={currentPage === totalPages}
                  style={{ minWidth: '70px' }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </PremiumGlassCard>

      {/* Optimized Modal Component */}
      <AddCustomerModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateCustomerSubmit} 
      />

      {/* OCR Invoice Import Modal */}
      <OcrImportModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        onSuccess={handleOcrSuccess}
      />

    </div>
  );
};

export default Customers;
