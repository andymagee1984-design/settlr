import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveSale, declineSale, fallOverSale, submitSale, progressSale } from '../../api/sales'
import type { Sale } from '../../api/sales'

interface Props {
  sale: Sale
  action: ActionType
  onClose: () => void
}

export type ActionType = 'approve' | 'decline' | 'fall_over' | 'submit' | 'progress'

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
  boxSizing: 'border-box' as const,
}

const labelStyle = {
  fontSize: 12, fontWeight: 500 as const,
  color: '#374151', marginBottom: 4, display: 'block',
}

const ACTION_CONFIG: Record<ActionType, { title: string; confirmLabel: string; confirmBg: string }> = {
  approve:   { title: 'Approve Sale',        confirmLabel: 'Approve',   confirmBg: '#16a34a' },
  decline:   { title: 'Decline Sale',        confirmLabel: 'Decline',   confirmBg: '#dc2626' },
  fall_over: { title: 'Mark as Fallen Over', confirmLabel: 'Fall Over', confirmBg: '#dc2626' },
  submit:    { title: 'Submit for Approval', confirmLabel: 'Submit',    confirmBg: '#111827' },
  progress:  { title: 'Progress Sale',       confirmLabel: 'Progress',  confirmBg: '#111827' },
}

const PROGRESS_LABELS: Record<string, { dateLabel: string; fileLabel: string; nextStatus: string }> = {
  reserved:        { dateLabel: 'Contract Issued Date', fileLabel: 'Contract Document',    nextStatus: 'Contract Issued' },
  contract_issued: { dateLabel: 'Exchange Date',        fileLabel: 'Signed Contract',      nextStatus: 'Exchanged' },
  exchanged:       { dateLabel: 'Settlement Date',      fileLabel: 'Settlement Statement', nextStatus: 'Settled' },
}

const FALL_OVER_REASONS = [
  { value: 'tubed_buyer',   label: 'Tubed — Buyer Decision' },
  { value: 'tubed_finance', label: 'Tubed — Finance' },
  { value: 'cancelled',     label: 'Cancelled' },
]

export default function SaleActionModal({ sale, action, onClose }: Props) {
  const queryClient = useQueryClient()
  const config = ACTION_CONFIG[action]

  const [declineReason, setDeclineReason] = useState('')
  const [fallOverReason, setFallOverReason] = useState('tubed_buyer')
  const [dateValue, setDateValue] = useState('')
  const [fileValue, setFileValue] = useState<File | null>(null)
  const [idVerified, setIdVerified] = useState(false)

  // Submit for approval fields
  const [depositAmount, setDepositAmount] = useState('')
  const [depositType, setDepositType] = useState('eft')
  const [depositDate, setDepositDate] = useState('')
  const [depositTime, setDepositTime] = useState('')
  const [depositFile, setDepositFile] = useState<File | null>(null)

  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      switch (action) {
        case 'approve':
          return approveSale(sale.id)
        case 'decline':
          if (!declineReason.trim()) throw new Error('Decline reason is required.')
          return declineSale(sale.id, declineReason)
        case 'fall_over':
          return fallOverSale(sale.id, fallOverReason)
        case 'submit': {
          if (!depositAmount || !depositDate || !depositTime || !depositFile) {
            throw new Error('All deposit fields and attachment are required.')
          }
          const fd = new FormData()
          fd.append('amount', depositAmount)
          fd.append('deposit_type', depositType)
          fd.append('deposit_date', depositDate)
          fd.append('deposit_time', depositTime)
          fd.append('attachment', depositFile)
          fd.append('id_verified', idVerified ? 'true' : 'false')
          return submitSale(sale.id, fd)
        }
        case 'progress': {
          if (!dateValue || !fileValue) {
            throw new Error('A date and document are required to progress.')
          }
          const fd = new FormData()
          fd.append('date_value', dateValue)
          fd.append('file_value', fileValue)
          return progressSale(sale.id, fd)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['lots'] })
      onClose()
    },
    onError: (e: any) => {
      setError(e?.message ?? e?.response?.data?.detail ?? 'Something went wrong.')
    },
  })

  const progressConfig = PROGRESS_LABELS[sale.status]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{config.title}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Lot {sale.lot_number} — {sale.project_name} — {sale.primary_buyer_name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, padding: 0 }}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>

          {/* Approve */}
          {action === 'approve' && (
            <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
              Approving this sale will move it to <strong>Reserved</strong> status and notify the agent.
            </p>
          )}

          {/* Decline */}
          {action === 'decline' && (
            <div>
              <label style={labelStyle}>Reason for declining *</label>
              <textarea
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Explain why the sale is being declined…"
              />
            </div>
          )}

          {/* Fall over */}
          {action === 'fall_over' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: '#374151', background: '#fef2f2', padding: '10px 12px', borderRadius: 6 }}>
                <i className="ti ti-alert-triangle" style={{ marginRight: 6, color: '#dc2626' }} />
                This is irreversible. The lot will immediately return to Available.
              </div>
              <div>
                <label style={labelStyle}>Reason *</label>
                <select style={inputStyle} value={fallOverReason} onChange={(e) => setFallOverReason(e.target.value)}>
                  {FALL_OVER_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Submit for approval */}
          {action === 'submit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Deposit amount *</label>
                  <input style={inputStyle} type="number" value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)} placeholder="1000.00" />
                </div>
                <div>
                  <label style={labelStyle}>Deposit type *</label>
                  <select style={inputStyle} value={depositType} onChange={(e) => setDepositType(e.target.value)}>
                    <option value="eft">EFT</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Deposit date *</label>
                  <input style={inputStyle} type="date" value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Deposit time *</label>
                  <input style={inputStyle} type="time" value={depositTime}
                    onChange={(e) => setDepositTime(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Deposit evidence (receipt / transfer confirmation) *</label>
                <input style={inputStyle} type="file" accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setDepositFile(e.target.files?.[0] ?? null)} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={idVerified}
                  onChange={(e) => setIdVerified(e.target.checked)} />
                ID verified — confirm identity has been checked
              </label>
            </div>
          )}

          {/* Progress */}
          {action === 'progress' && progressConfig && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                Progressing to <strong>{progressConfig.nextStatus}</strong>.
              </p>
              <div>
                <label style={labelStyle}>{progressConfig.dateLabel} *</label>
                <input style={inputStyle} type="date" value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>{progressConfig.fileLabel} *</label>
                <input style={inputStyle} type="file" accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setFileValue(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', borderRadius: 6, fontSize: 13, color: '#dc2626' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
            background: '#f3f4f6', color: '#374151', border: 'none', fontWeight: 500,
          }}>
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{
              padding: '8px 20px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              background: config.confirmBg, color: '#fff', border: 'none', cursor: 'pointer',
              opacity: mutation.isPending ? 0.6 : 1,
            }}
          >
            {mutation.isPending ? 'Saving…' : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}