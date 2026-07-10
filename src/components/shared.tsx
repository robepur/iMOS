/** Shared component library — reduces duplicated UI patterns across features. */

import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

export function StatusBadge({ status }: { status: string }) {
  return <span className={`statusBadge ${status}`}>{status.toUpperCase()}</span>
}

export function SectionHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="sectionHeader">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {children}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder, ...rest }: { value: string; onChange: (v: string) => void; placeholder?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  return (
    <input
      className="searchInput"
      type="search"
      placeholder={placeholder ?? 'Search…'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  )
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="historyToolbar">{children}</div>
}

export function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="statCard">
      <span className="statLabel">{label}</span>
      <strong className="statValue">{String(value)}</strong>
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className ?? ''}`}>{children}</div>
}

export function PrimaryButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest}>{children}</button>
}

export function SecondaryButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className="secondaryButton" {...rest}>{children}</button>
}

export function DangerButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className="dangerButton" {...rest}>{children}</button>
}

export function ResultCount({ count, label }: { count: number; label: string }) {
  return <p className="resultCount">{count} {label}{count !== 1 ? 's' : ''}</p>
}
