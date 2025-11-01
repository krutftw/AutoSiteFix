import type { AuditRunResult } from '@autositefix/auditor';

export const fixtureAuditResult: AuditRunResult = {
  startedAt: '2024-04-01T12:00:00.000Z',
  completedAt: '2024-04-01T12:30:00.000Z',
  pages: [
    {
      url: 'https://example.com',
      lighthouse: {
        scores: {
          performance: 92,
          accessibility: 87,
          seo: 78
        },
        details: {} as AuditRunResult['pages'][number]['lighthouse']['details']
      },
      axe: {
        violations: [
          {
            id: 'color-contrast',
            impact: 'serious',
            description: 'Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds.',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.6/color-contrast',
            nodes: [
              {
                html: '<button style="color:#777;background:#777">Click me</button>',
                target: ['button.primary'],
                failureSummary: 'Element has insufficient color contrast.'
              }
            ]
          }
        ]
      },
      fetchedAt: '2024-04-01T12:05:00.000Z'
    },
    {
      url: 'https://example.com/about',
      lighthouse: {
        scores: {
          performance: 88,
          accessibility: 95,
          seo: 90
        },
        details: {} as AuditRunResult['pages'][number]['lighthouse']['details']
      },
      axe: {
        violations: []
      },
      fetchedAt: '2024-04-01T12:20:00.000Z'
    }
  ]
};
