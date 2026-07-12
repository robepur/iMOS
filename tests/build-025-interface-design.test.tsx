/**
 * Build 025 — Mobile First Interface and Design Foundation
 *
 * Tests verify: shell structure, navigation, accessibility, design tokens,
 * responsive patterns, and preservation of all existing behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { BUILD } from '../src/constants'
import AppShell, { type NavTab, type MoreItem } from '../src/components/AppShell'
import VaultGate from '../src/features/vault/VaultGate'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── helpers ──────────────────────────────────────────────────────────────────

const noop = () => {}
const noopAsync = async () => {}

function makeMoreItems(): MoreItem[] {
  return [
    { id: 'vault',       label: 'VAULT',       icon: () => null as any, onClick: noop },
    { id: 'secrets',     label: 'SECRETS',     icon: () => null as any, onClick: noop },
    { id: 'recovery',    label: 'RECOVERY',    icon: () => null as any, onClick: noop },
    { id: 'review',      label: 'REVIEW',      icon: () => null as any, onClick: noop },
    { id: 'knowledge',   label: 'KNOWLEDGE',   icon: () => null as any, onClick: noop },
    { id: 'reflections', label: 'REFLECTIONS', icon: () => null as any, onClick: noop },
    { id: 'timeline',    label: 'TIMELINE',    icon: () => null as any, onClick: noop },
    { id: 'feedback',    label: 'FEEDBACK',    icon: () => null as any, onClick: noop },
  ]
}

function renderShell(
  activeTab: NavTab = 'home',
  onTabChange = noop,
  rosieAlertCount = 0,
) {
  return render(
    <AppShell
      activeTab={activeTab}
      onTabChange={onTabChange}
      rosieAlertCount={rosieAlertCount}
      saving={false}
      onLock={noop}
      moreItems={makeMoreItems()}
    >
      <div data-testid="shell-content">Content</div>
    </AppShell>
  )
}

// ── Build metadata ────────────────────────────────────────────────────────────

describe('Build 025 metadata', () => {
  it('BUILD constant is 025', () => {
    expect(BUILD).toBe('025')
  })

  it('design tokens file exists', () => {
    const tokensPath = resolve(__dirname, '../src/design/tokens.css')
    const css = readFileSync(tokensPath, 'utf8')
    expect(css).toContain('--navy-900')
    expect(css).toContain('--red-600')
    expect(css).toContain('--gold-500')
    expect(css).toContain('--touch-min')
    expect(css).toContain('--text-primary')
    expect(css).toContain('--border-subtle')
  })

  it('design tokens define all required colour groups', () => {
    const tokensPath = resolve(__dirname, '../src/design/tokens.css')
    const css = readFileSync(tokensPath, 'utf8')
    expect(css).toContain('--white-100')
    expect(css).toContain('--white-70')
    expect(css).toContain('--white-05')
    expect(css).toContain('--surface-nav')
    expect(css).toContain('--surface-header')
    expect(css).toContain('--nav-height-mobile')
    expect(css).toContain('--nav-width-desktop')
  })

  it('design tokens define typography scale', () => {
    const tokensPath = resolve(__dirname, '../src/design/tokens.css')
    const css = readFileSync(tokensPath, 'utf8')
    expect(css).toContain('--text-xs')
    expect(css).toContain('--text-md')
    expect(css).toContain('--text-hero')
    expect(css).toContain('--tracking-tactical')
  })

  it('design tokens define spacing scale', () => {
    const tokensPath = resolve(__dirname, '../src/design/tokens.css')
    const css = readFileSync(tokensPath, 'utf8')
    expect(css).toContain('--space-1')
    expect(css).toContain('--space-4')
    expect(css).toContain('--space-10')
  })

  it('design tokens define motion rules with reduced-motion support', () => {
    const tokensPath = resolve(__dirname, '../src/design/tokens.css')
    const css = readFileSync(tokensPath, 'utf8')
    expect(css).toContain('--motion-duration-normal')
    expect(css).toContain('prefers-reduced-motion: reduce')
  })
})

// ── AppShell structure ────────────────────────────────────────────────────────

describe('AppShell structure', () => {
  it('renders without crashing', () => {
    renderShell()
    expect(screen.getByTestId('app-shell')).toBeDefined()
  })

  it('renders mobile header', () => {
    renderShell()
    expect(screen.getByTestId('mobile-header')).toBeDefined()
  })

  it('renders content area', () => {
    renderShell()
    expect(screen.getByTestId('app-content')).toBeDefined()
    expect(screen.getByTestId('shell-content')).toBeDefined()
  })

  it('renders bottom navigation', () => {
    renderShell()
    expect(screen.getByTestId('bottom-nav')).toBeDefined()
  })

  it('renders desktop navigation', () => {
    renderShell()
    expect(screen.getByTestId('desktop-nav')).toBeDefined()
  })

  it('mobile lock button is present and has aria-label', () => {
    renderShell()
    const lockBtn = screen.getByTestId('mobile-lock-button')
    expect(lockBtn.getAttribute('aria-label')).toBe('Lock vault')
  })

  it('shows saving badge when saving is true', () => {
    render(
      <AppShell activeTab="home" onTabChange={noop} rosieAlertCount={0} saving={true} onLock={noop}>
        <div />
      </AppShell>
    )
    const badges = screen.getAllByText('SECURING')
    expect(badges.length).toBeGreaterThan(0)
  })
})

// ── Bottom navigation ─────────────────────────────────────────────────────────

describe('Bottom navigation', () => {
  it('has exactly 5 navigation tabs', () => {
    renderShell()
    const nav = screen.getByTestId('bottom-nav')
    const buttons = within(nav).getAllByRole('button')
    expect(buttons).toHaveLength(5)
  })

  it('renders all required tab labels', () => {
    renderShell()
    const nav = screen.getByTestId('bottom-nav')
    const labels = ['HOME', 'FOCUS', 'MISSIONS', 'ROSIE', 'MORE']
    labels.forEach(label => {
      expect(within(nav).getByText(label)).toBeDefined()
    })
  })

  it('navigation labels are short enough to avoid wrapping', () => {
    renderShell()
    const nav = screen.getByTestId('bottom-nav')
    within(nav).getAllByRole('button').forEach(btn => {
      const labelEl = btn.querySelector('.bottomNavLabel')
      if (labelEl) {
        expect((labelEl.textContent ?? '').length).toBeLessThanOrEqual(10)
      }
    })
  })

  it('each bottom nav button has an aria-label', () => {
    renderShell()
    const nav = screen.getByTestId('bottom-nav')
    within(nav).getAllByRole('button').forEach(btn => {
      expect(btn.getAttribute('aria-label')).toBeTruthy()
    })
  })

  it('active tab has aria-current=page (non-more tabs)', () => {
    renderShell('home')
    const homeBtn = screen.getByTestId('bottom-nav-home')
    expect(homeBtn.getAttribute('aria-current')).toBe('page')
  })

  it('inactive tabs do not have aria-current', () => {
    renderShell('home')
    const focusBtn = screen.getByTestId('bottom-nav-focus')
    expect(focusBtn.getAttribute('aria-current')).toBeNull()
  })

  it('tapping a tab calls onTabChange', () => {
    const onTabChange = vi.fn()
    renderShell('home', onTabChange)
    fireEvent.click(screen.getByTestId('bottom-nav-focus'))
    expect(onTabChange).toHaveBeenCalledWith('focus')
  })

  it('tapping rosie tab with alerts shows badge', () => {
    renderShell('home', noop, 3)
    const rosieBtn = screen.getByTestId('bottom-nav-rosie')
    expect(within(rosieBtn).getByText('3')).toBeDefined()
  })
})

// ── Desktop navigation ────────────────────────────────────────────────────────

describe('Desktop navigation', () => {
  it('has primary destination items (excluding More)', () => {
    renderShell()
    const nav = screen.getByTestId('desktop-nav')
    const expectedIds = ['home', 'focus', 'missions', 'rosie']
    expectedIds.forEach(id => {
      expect(screen.getByTestId(`desktop-nav-${id}`)).toBeDefined()
    })
  })

  it('desktop nav items have aria-labels', () => {
    renderShell()
    const expectedIds = ['home', 'focus', 'missions', 'rosie']
    expectedIds.forEach(id => {
      const btn = screen.getByTestId(`desktop-nav-${id}`)
      expect(btn.getAttribute('aria-label')).toBeTruthy()
    })
  })

  it('active desktop nav item has aria-current=page', () => {
    renderShell('rosie')
    const rosieBtn = screen.getByTestId('desktop-nav-rosie')
    expect(rosieBtn.getAttribute('aria-current')).toBe('page')
  })

  it('desktop lock button has aria-label', () => {
    renderShell()
    const lockBtn = screen.getByTestId('desktop-lock-button')
    expect(lockBtn.getAttribute('aria-label')).toBe('Lock vault')
  })

  it('more items appear in desktop nav', () => {
    renderShell()
    expect(screen.getByTestId('desktop-more-vault')).toBeDefined()
    expect(screen.getByTestId('desktop-more-secrets')).toBeDefined()
  })

  it('tapping desktop nav item calls onTabChange', () => {
    const onTabChange = vi.fn()
    renderShell('home', onTabChange)
    fireEvent.click(screen.getByTestId('desktop-nav-missions'))
    expect(onTabChange).toHaveBeenCalledWith('missions')
  })
})

// ── More drawer ───────────────────────────────────────────────────────────────

describe('More drawer', () => {
  it('drawer is not visible initially', () => {
    renderShell()
    expect(screen.queryByTestId('more-drawer')).toBeNull()
  })

  it('tapping More tab opens drawer', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('bottom-nav-more'))
    expect(screen.getByTestId('more-drawer')).toBeDefined()
  })

  it('drawer contains all more items', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('bottom-nav-more'))
    const labels = ['VAULT', 'SECRETS', 'RECOVERY', 'REVIEW', 'KNOWLEDGE', 'REFLECTIONS', 'TIMELINE', 'FEEDBACK']
    labels.forEach(label => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    })
  })

  it('more drawer has dialog role and aria-label', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('bottom-nav-more'))
    const drawer = screen.getByTestId('more-drawer')
    expect(drawer.getAttribute('role')).toBe('dialog')
    expect(drawer.getAttribute('aria-label')).toBeTruthy()
  })

  it('clicking backdrop closes drawer', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('bottom-nav-more'))
    expect(screen.getByTestId('more-drawer')).toBeDefined()
    fireEvent.click(screen.getByTestId('more-drawer-backdrop'))
    expect(screen.queryByTestId('more-drawer')).toBeNull()
  })

  it('clicking a more item calls its onClick and closes drawer', () => {
    const vaultClick = vi.fn()
    render(
      <AppShell activeTab="home" onTabChange={noop} rosieAlertCount={0} saving={false} onLock={noop}
        moreItems={[{ id: 'vault', label: 'VAULT', icon: () => null as any, onClick: vaultClick }]}>
        <div />
      </AppShell>
    )
    fireEvent.click(screen.getByTestId('bottom-nav-more'))
    fireEvent.click(screen.getByTestId('more-item-vault'))
    expect(vaultClick).toHaveBeenCalled()
    expect(screen.queryByTestId('more-drawer')).toBeNull()
  })

  it('tapping More again closes drawer', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('bottom-nav-more'))
    expect(screen.getByTestId('more-drawer')).toBeDefined()
    fireEvent.click(screen.getByTestId('bottom-nav-more'))
    expect(screen.queryByTestId('more-drawer')).toBeNull()
  })
})

// ── Accessibility ─────────────────────────────────────────────────────────────

describe('Accessibility', () => {
  it('bottom nav has role=navigation and aria-label', () => {
    renderShell()
    const navs = screen.getAllByRole('navigation')
    const bottomNav = navs.find(n => n.getAttribute('data-testid') === 'bottom-nav')
    expect(bottomNav).toBeDefined()
    expect(bottomNav!.getAttribute('aria-label')).toBe('Primary navigation')
  })

  it('desktop nav has role=navigation and aria-label', () => {
    renderShell()
    const nav = screen.getByTestId('desktop-nav')
    expect(nav.getAttribute('role')).toBe('navigation')
    expect(nav.getAttribute('aria-label')).toBe('Primary navigation')
  })

  it('mobile header has role=banner', () => {
    renderShell()
    const header = screen.getByTestId('mobile-header')
    expect(header.getAttribute('role')).toBe('banner')
  })

  it('encrypted badge has aria-label', () => {
    renderShell()
    const badge = screen.getAllByLabelText('Encrypted mode active')
    expect(badge.length).toBeGreaterThan(0)
  })

  it('rosie alert badge has descriptive aria-label', () => {
    renderShell('home', noop, 5)
    const badge = screen.getByLabelText('5 alerts')
    expect(badge).toBeDefined()
  })
})

// ── VaultGate mobile first ────────────────────────────────────────────────────

describe('VaultGate', () => {
  it('renders vault creation screen', () => {
    render(<VaultGate state="setup" error="" onCreate={noopAsync} onUnlock={noopAsync} />)
    expect(screen.getByText('Create your vault.')).toBeDefined()
  })

  it('renders vault unlock screen', () => {
    render(<VaultGate state="locked" error="" onCreate={noopAsync} onUnlock={noopAsync} />)
    expect(screen.getByText('Vault locked.')).toBeDefined()
  })

  it('setup screen has passphrase and confirm inputs', () => {
    render(<VaultGate state="setup" error="" onCreate={noopAsync} onUnlock={noopAsync} />)
    const inputs = screen.getAllByRole('textbox').length + document.querySelectorAll('input[type="password"]').length
    expect(inputs).toBeGreaterThanOrEqual(2)
  })

  it('locked screen has single passphrase input', () => {
    render(<VaultGate state="locked" error="" onCreate={noopAsync} onUnlock={noopAsync} />)
    const inputs = document.querySelectorAll('input[type="password"]')
    expect(inputs).toHaveLength(1)
  })

  it('renders error message when error prop is set', () => {
    render(<VaultGate state="locked" error="Invalid passphrase." onCreate={noopAsync} onUnlock={noopAsync} />)
    expect(screen.getByText('Invalid passphrase.')).toBeDefined()
  })
})

// ── Preservation of existing behavior ────────────────────────────────────────

describe('Existing behavior preserved', () => {
  it('AppShell renders children inside content area', () => {
    renderShell()
    const content = screen.getByTestId('app-content')
    expect(within(content).getByTestId('shell-content')).toBeDefined()
  })

  it('onLock is called when lock button is clicked', () => {
    const onLock = vi.fn()
    render(
      <AppShell activeTab="home" onTabChange={noop} rosieAlertCount={0} saving={false} onLock={onLock}>
        <div />
      </AppShell>
    )
    fireEvent.click(screen.getByTestId('mobile-lock-button'))
    expect(onLock).toHaveBeenCalled()
  })

  it('onLock is also called from desktop lock button', () => {
    const onLock = vi.fn()
    render(
      <AppShell activeTab="home" onTabChange={noop} rosieAlertCount={0} saving={false} onLock={onLock}>
        <div />
      </AppShell>
    )
    fireEvent.click(screen.getByTestId('desktop-lock-button'))
    expect(onLock).toHaveBeenCalled()
  })

  it('all 5 nav destinations are reachable from bottom nav', () => {
    const destinations: NavTab[] = ['home', 'focus', 'missions', 'rosie']
    destinations.forEach(dest => {
      expect(screen.queryByTestId(`bottom-nav-${dest}`)).not.toBeNull()
    })
    expect(screen.queryByTestId('bottom-nav-more')).not.toBeNull()
  })

  it('Rosie is accessible via dedicated nav tab', () => {
    const onTabChange = vi.fn()
    renderShell('home', onTabChange)
    fireEvent.click(screen.getByTestId('bottom-nav-rosie'))
    expect(onTabChange).toHaveBeenCalledWith('rosie')
  })

  it('no horizontal overflow class on shell root', () => {
    renderShell()
    const shell = screen.getByTestId('app-shell')
    expect(shell.className).not.toContain('overflow-x-visible')
  })
})
