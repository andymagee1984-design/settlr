/// <reference types="@types/google.maps" />
// src/components/AddressAutocomplete.tsx
//
// Drop-in replacement for any address <input> field.
// Uses Google Places Autocomplete API restricted to Australian addresses.
//
// Usage:
//   <AddressAutocomplete
//     value={form.address}
//     onChange={(address) => setForm(f => ({ ...f, address }))}
//     inputStyle={inputStyle}   // optional — pass your existing inputStyle object
//     placeholder="Start typing an address…"
//   />
//
// Requirements:
//   VITE_GOOGLE_PLACES_KEY must be set in .env
//
// The Google Places script is loaded once on first mount via a singleton
// loader — subsequent mounts reuse the already-loaded script.

import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Script loader — loads the Google Places API once, caches the promise
// ─────────────────────────────────────────────────────────────────────────────

let scriptPromise: Promise<void> | null = null

function loadGooglePlacesScript(): Promise<void> {
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    // Already loaded
    if (window.google?.maps?.places) {
      resolve()
      return
    }

    const key = import.meta.env.VITE_GOOGLE_PLACES_KEY
    if (!key) {
      console.error('AddressAutocomplete: VITE_GOOGLE_PLACES_KEY is not set.')
      reject(new Error('Missing Google Places API key'))
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Places script'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  value: string
  onChange: (address: string) => void
  placeholder?: string
  inputStyle?: React.CSSProperties
  disabled?: boolean
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Start typing an address…',
  inputStyle,
  disabled = false,
}: Props) {
  const inputRef    = useRef<HTMLInputElement>(null)
  const autoRef     = useRef<google.maps.places.Autocomplete | null>(null)
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const [ready, setReady]   = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  // Load script and init autocomplete on mount
  useEffect(() => {
    let cancelled = false

    loadGooglePlacesScript()
      .then(() => {
        if (cancelled || !inputRef.current) return
        setReady(true)

        autoRef.current = new window.google.maps.places.Autocomplete(
          inputRef.current,
          {
            componentRestrictions: { country: 'au' },
            fields: ['formatted_address'],
            types: ['address'],
          }
        )

        listenerRef.current = autoRef.current.addListener('place_changed', () => {
          const place = autoRef.current?.getPlace()
          if (place?.formatted_address) {
            onChange(place.formatted_address)
          }
        })
      })
      .catch((err) => {
        if (!cancelled) setError('Address lookup unavailable')
        console.error('AddressAutocomplete:', err)
      })

    return () => {
      cancelled = true
      if (listenerRef.current) {
        window.google?.maps?.event?.removeListener(listenerRef.current)
      }
    }
  }, [])

  // Base style matches the CRM form input pattern
  const baseStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    border: `1.5px solid ${focused ? '#3d4a5c' : '#e8e2dd'}`,
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    color: '#2c2420',
    background: disabled ? '#f9f6f4' : '#fff',
    outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: 'var(--font-body)',
    ...inputStyle,
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={ready ? placeholder : 'Loading…'}
        disabled={disabled || !!error}
        style={baseStyle}
        autoComplete="off"
      />
      {error && (
        <p style={{ fontSize: 11, color: '#c0533a', margin: '3px 0 0' }}>
          {error} — type address manually
        </p>
      )}
    </div>
  )
}