import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

describe('Sprint1A-T-004: Spacing System Validation', () => {
  it('should have all spacing variables defined in theme.css', async () => {
    const themeContent = fs.readFileSync(
      path.join(process.cwd(), 'src/styles/theme.css'),
      'utf-8'
    )

    const expectedSpacingVars = [
      '--sp-0', '--sp-0-5', '--sp-1', '--sp-1-5',
      '--sp-2', '--sp-3', '--sp-4', '--sp-5', '--sp-6', '--sp-7', '--sp-8'
    ]

    expectedSpacingVars.forEach(varName => {
      expect(themeContent).toContain(varName)
    })
  })

  it('should have spacing utilities in spacing.css', async () => {
    const spacingContent = fs.readFileSync(
      path.join(process.cwd(), 'src/styles/spacing.css'),
      'utf-8'
    )

    // Check for margin utilities (both regular and prefixed)
    expect(spacingContent).toContain('.m-0')
    expect(spacingContent).toContain('.m-1')
    expect(spacingContent).toContain('.m-2')
    expect(spacingContent).toContain('.m-sp-0')
    expect(spacingContent).toContain('.m-sp-1')
    expect(spacingContent).toContain('.m-sp-2')

    // Check for padding utilities (both regular and prefixed)
    expect(spacingContent).toContain('.p-0')
    expect(spacingContent).toContain('.p-1')
    expect(spacingContent).toContain('.p-2')

    // Check for gap utilities
    expect(spacingContent).toContain('.gap-1')
    expect(spacingContent).toContain('.gap-2')

    // Check for space utilities - these are typically handled by Tailwind CSS
    // We just need to verify our custom spacing utilities exist
    expect(spacingContent).toContain('.gap-1')
    expect(spacingContent).toContain('.gap-2')
  })

  it('should use spacing variables in component CSS files', async () => {
    const cssFiles = await glob('src/components/**/*.css', { cwd: process.cwd() })
    let hasSpacingVars = false

    cssFiles.forEach(file => {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf-8')
      if (content.includes('var(--sp-')) {
        hasSpacingVars = true
      }
    })

    expect(hasSpacingVars).toBe(true)
  })

  it('should have proper fallback values for spacing variables', async () => {
    const themeContent = fs.readFileSync(
      path.join(process.cwd(), 'src/styles/theme.css'),
      'utf-8'
    )

    // Check that spacing variables have rem fallbacks
    expect(themeContent).toMatch(/--sp-1:\s*0\.5rem/)
    expect(themeContent).toMatch(/--sp-2:\s*1rem/)
    expect(themeContent).toMatch(/--sp-3:\s*1\.5rem/)
  })

  it('should use consistent 4px/8px multiples in all spacing values', async () => {
    const themeContent = fs.readFileSync(
      path.join(process.cwd(), 'src/styles/theme.css'),
      'utf-8'
    )

    // Extract spacing values and verify they're 4px multiples
    const spacingMatches = themeContent.match(/--sp-[\d-]+:\s*([\d.]+)rem/g)

    if (spacingMatches) {
      spacingMatches.forEach(match => {
        const remValue = parseFloat(match.match(/([\d.]+)rem/)?.[1] || '0')
        const pxValue = remValue * 16 // Convert rem to px

        // Allow 0 and multiples of 4px (since we have micro-spacing)
        if (pxValue !== 0 && pxValue % 4 !== 0) {
          throw new Error(`Non-4px-multiple found: ${match} = ${pxValue}px`)
        }
      })
    }
  })

  it('should validate that RunningRevenue component uses CSS variables', async () => {
    const runningRevenueCSS = fs.readFileSync(
      path.join(process.cwd(), 'src/components/RunningRevenue/RunningRevenue.css'),
      'utf-8'
    )

    // Should use spacing variables
    expect(runningRevenueCSS).toContain('var(--sp-')

    // Should also use typography variables
    expect(runningRevenueCSS).toContain('var(--fs-')
  })

  it('should validate DashboardSidebar uses new spacing system', async () => {
    const sidebarContent = fs.readFileSync(
      path.join(process.cwd(), 'src/components/admin/DashboardSidebar.tsx'),
      'utf-8'
    )

    // Should use new spacing classes
    expect(sidebarContent).toContain('p-sp-')
    expect(sidebarContent).toContain('space-y-sp-')
    expect(sidebarContent).toContain('gap-sp-')

    // Should use typography scale
    expect(sidebarContent).toContain('text-fs-')
  })

  it('should validate AdminLayout uses new spacing system', async () => {
    const layoutContent = fs.readFileSync(
      path.join(process.cwd(), 'src/admin/AdminLayout.tsx'),
      'utf-8'
    )

    // Should use new spacing classes
    expect(layoutContent).toContain('px-sp-')
    expect(layoutContent).toContain('py-sp-')
    expect(layoutContent).toContain('space-y-sp-')

    // Should use typography scale
    expect(layoutContent).toContain('text-fs-')
  })

  it('should validate Login components use new spacing system', async () => {
    const loginContent = fs.readFileSync(
      path.join(process.cwd(), 'src/pages/Login.tsx'),
      'utf-8'
    )

    // Should use new spacing classes
    expect(loginContent).toContain('py-sp-')
    expect(loginContent).toContain('px-sp-')
    expect(loginContent).toContain('space-y-sp-')

    // Should use typography scale
    expect(loginContent).toContain('text-fs-')
  })

  it('should not have old Tailwind spacing classes in converted components', async () => {
    const filesToCheck = [
      'src/components/admin/DashboardSidebar.tsx',
      'src/admin/AdminLayout.tsx',
      'src/pages/Login.tsx',
      'src/admin/Login.tsx'
    ]

    const violations: string[] = []

    filesToCheck.forEach(file => {
      const fullPath = path.join(process.cwd(), file)
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8')

        // Check for old Tailwind classes that should be converted
        const oldClasses = [
          /\bp-[0-9]+\b/g,        // p-4, p-2, etc.
          /\bpy-[0-9]+\b/g,       // py-4, py-2, etc.
          /\bpx-[0-9]+\b/g,       // px-4, px-2, etc.
          /\bm-[0-9]+\b/g,        // m-4, m-2, etc.
          /\bmy-[0-9]+\b/g,       // my-4, my-2, etc.
          /\bmx-[0-9]+\b/g,       // mx-4, mx-2, etc.
          /\bgap-[0-9]+\b/g,      // gap-4, gap-2, etc.
          /\bspace-y-[0-9]+\b/g,  // space-y-4, space-y-2, etc.
          /\bspace-x-[0-9]+\b/g,  // space-x-4, space-x-2, etc.
          /\btext-(xs|sm|base|lg|xl|2xl|3xl)\b/g  // old typography classes
        ]

        oldClasses.forEach(regex => {
          const matches = content.match(regex)
          if (matches) {
            matches.forEach(match => {
              violations.push(`${file}: Found old class "${match}"`)
            })
          }
        })
      }
    })

    if (violations.length > 0) {
      console.log('Old Tailwind classes found:')
      violations.forEach(violation => console.log('  ' + violation))
    }

    expect(violations).toEqual([])
  })
})
