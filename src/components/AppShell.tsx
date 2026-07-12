import { type ReactNode, useState } from 'react'
import { Home, Target, Route, Zap, MoreHorizontal, Lock, ShieldCheck, type LucideIcon } from 'lucide-react'

export type NavTab = 'home' | 'focus' | 'missions' | 'rosie' | 'more'

export interface MoreItem {
  id: string
  label: string
  icon: LucideIcon
  onClick: () => void
  badge?: number
}

interface AppShellProps {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
  rosieAlertCount: number
  saving: boolean
  onLock: () => void
  children: ReactNode
  moreItems?: MoreItem[]
}

interface NavTabDef {
  id: NavTab
  label: string
  icon: LucideIcon
  ariaLabel: string
}

const NAV_TABS: NavTabDef[] = [
  { id: 'home',     label: 'HOME',     icon: Home,          ariaLabel: 'Home' },
  { id: 'focus',    label: 'FOCUS',    icon: Target,        ariaLabel: 'Focus and priorities' },
  { id: 'missions', label: 'MISSIONS', icon: Route,         ariaLabel: 'Missions' },
  { id: 'rosie',    label: 'ROSIE',    icon: Zap,           ariaLabel: 'Rosie cognitive partner' },
  { id: 'more',     label: 'MORE',     icon: MoreHorizontal, ariaLabel: 'More options' },
]

export default function AppShell({
  activeTab,
  onTabChange,
  rosieAlertCount,
  saving,
  onLock,
  children,
  moreItems = [],
}: AppShellProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  function handleTabChange(tab: NavTab) {
    if (tab === 'more') {
      setMoreOpen(v => !v)
    } else {
      setMoreOpen(false)
      onTabChange(tab)
    }
  }

  function handleMoreItem(item: MoreItem) {
    setMoreOpen(false)
    item.onClick()
  }

  return (
    <div className="appShell" data-testid="app-shell">
      {/* Mobile header — hidden on desktop */}
      <header className="mobileHeader" data-testid="mobile-header" role="banner">
        <div className="mobileHeaderBrand">
          <p className="mobileHeaderEyebrow">iMOS</p>
          {saving && <span className="savingBadge" aria-live="polite">SECURING</span>}
        </div>
        <div className="mobileHeaderActions">
          <div className="encryptedBadge" aria-label="Encrypted mode active">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>ENCRYPTED</span>
          </div>
          <button
            className="mobileHeaderLock"
            onClick={onLock}
            aria-label="Lock vault"
            data-testid="mobile-lock-button"
          >
            <Lock size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="appLayout">
        {/* Desktop navigation rail — shown on ≥768px */}
        <nav
          className="desktopNav"
          role="navigation"
          aria-label="Desktop primary navigation"
          data-testid="desktop-nav"
        >
          <div className="desktopNavBrand">
            <p className="eyebrow">INDIVIDUAL MISSION OPERATING SYSTEM</p>
            <h1 className="desktopNavTitle">iMOS</h1>
            {saving && <span className="savingBadge" aria-live="polite">SECURING</span>}
          </div>

          <div className="desktopNavItems" role="list">
            {NAV_TABS.filter(t => t.id !== 'more').map(tab => {
              const Icon = tab.icon
              const isRosie = tab.id === 'rosie'
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  role="listitem"
                  className={`desktopNavItem${isActive ? ' active' : ''}`}
                  onClick={() => onTabChange(tab.id)}
                  aria-label={tab.ariaLabel}
                  aria-current={isActive ? 'page' : undefined}
                  data-testid={`desktop-nav-${tab.id}`}
                >
                  <div className="desktopNavItemIcon">
                    <Icon size={20} aria-hidden="true" />
                    {isRosie && rosieAlertCount > 0 && (
                      <span className="navBadge" aria-label={`${rosieAlertCount} alerts`}>{rosieAlertCount}</span>
                    )}
                  </div>
                  <span className="desktopNavLabel">{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="desktopNavFooter">
            {moreItems.length > 0 && (
              <div className="desktopNavMore" role="list">
                <p className="desktopNavMoreLabel">MORE</p>
                {moreItems.map(item => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      role="listitem"
                      className="desktopNavMoreItem"
                      onClick={item.onClick}
                      aria-label={item.label}
                      data-testid={`desktop-more-${item.id}`}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span>{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="navBadge" aria-label={`${item.badge} items`}>{item.badge}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="desktopNavEncrypted" aria-label="Encrypted mode active">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>ENCRYPTED MODE</span>
            </div>
            <button
              className="desktopNavLock"
              onClick={onLock}
              aria-label="Lock vault"
              data-testid="desktop-lock-button"
            >
              <Lock size={16} aria-hidden="true" />
              LOCK
            </button>
          </div>
        </nav>

        {/* Main content area */}
        <main className="appContent" data-testid="app-content">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation — hidden on desktop */}
      <nav
        className="bottomNav"
        role="navigation"
        aria-label="Mobile primary navigation"
        data-testid="bottom-nav"
      >
        <div className="bottomNavInner">
          {NAV_TABS.map(tab => {
            const Icon = tab.icon
            const isRosie = tab.id === 'rosie'
            const isMore  = tab.id === 'more'
            const isActive = isMore ? moreOpen : activeTab === tab.id
            return (
              <button
                key={tab.id}
                className={`bottomNavItem${isActive ? ' active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
                aria-label={tab.ariaLabel}
                aria-current={isActive && !isMore ? 'page' : undefined}
                aria-expanded={isMore ? moreOpen : undefined}
                data-testid={`bottom-nav-${tab.id}`}
              >
                <div className="bottomNavIcon">
                  <Icon size={22} aria-hidden="true" />
                  {isRosie && rosieAlertCount > 0 && (
                    <span className="navBadge" aria-label={`${rosieAlertCount} alerts`}>{rosieAlertCount}</span>
                  )}
                </div>
                <span className="bottomNavLabel">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* More drawer — mobile only */}
      {moreOpen && (
        <>
          <div
            className="moreDrawerBackdrop"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
            data-testid="more-drawer-backdrop"
          />
          <div
            className="moreDrawer"
            role="dialog"
            aria-label="More options"
            data-testid="more-drawer"
          >
            <div className="moreDrawerHandle" aria-hidden="true" />
            <p className="moreDrawerTitle">MORE</p>
            <div className="moreDrawerItems">
              {moreItems.map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    className="moreDrawerItem"
                    onClick={() => handleMoreItem(item)}
                    aria-label={item.label}
                    data-testid={`more-item-${item.id}`}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="navBadge moreDrawerBadge" aria-label={`${item.badge} items`}>{item.badge}</span>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              className="moreDrawerClose"
              onClick={() => setMoreOpen(false)}
              aria-label="Close more options"
            >
              CLOSE
            </button>
          </div>
        </>
      )}
    </div>
  )
}
