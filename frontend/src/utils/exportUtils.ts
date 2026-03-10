import { jsPDF } from 'jspdf'

export type ReportSection = {
  heading: string
  content: unknown
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}

function primitiveToText(value: unknown): string {
  if (value == null) return 'N/A'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function tryParseJsonString(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) return value
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function toReadableLines(value: unknown, indent = 0): string[] {
  const pad = ' '.repeat(indent)

  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    return [`${pad}${primitiveToText(value)}`]
  }

  if (typeof value === 'string') {
    const parsed = tryParseJsonString(value)
    if (parsed !== value) {
      return toReadableLines(parsed, indent)
    }
    return [`${pad}${value}`]
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}N/A`]
    const lines: string[] = []
    for (const item of value) {
      if (
        item == null
        || typeof item === 'string'
        || typeof item === 'number'
        || typeof item === 'boolean'
      ) {
        lines.push(`${pad}- ${primitiveToText(item)}`)
      } else {
        lines.push(`${pad}-`)
        lines.push(...toReadableLines(item, indent + 2))
      }
    }
    return lines
  }

  const obj = value as Record<string, unknown>
  const entries = Object.entries(obj)
  if (entries.length === 0) return [`${pad}N/A`]

  const lines: string[] = []
  for (const [key, val] of entries) {
    const heading = `${pad}${humanizeKey(key)}`
    if (
      val == null
      || typeof val === 'string'
      || typeof val === 'number'
      || typeof val === 'boolean'
    ) {
      lines.push(`${heading}: ${primitiveToText(val)}`)
    } else {
      lines.push(`${heading}:`)
      lines.push(...toReadableLines(val, indent + 2))
    }
  }
  return lines
}

function sectionText(content: unknown): string {
  return toReadableLines(content).join('\n')
}

function escapeRtf(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\n/g, '\\line ')
}

export function downloadDocReport(
  title: string,
  sections: ReportSection[],
  fileBaseName?: string,
): void {
  const generatedAt = new Date().toLocaleString()

  const body = [
    '{\\rtf1\\ansi\\deff0',
    '{\\fonttbl{\\f0 Arial;}}',
    '\\fs32\\b ' + escapeRtf(title) + '\\b0\\fs20\\par',
    'Generated at: ' + escapeRtf(generatedAt) + '\\par\\par',
    ...sections.map((s) => {
      const heading = '\\b ' + escapeRtf(s.heading) + '\\b0\\par'
      const text = escapeRtf(sectionText(s.content)) + '\\par\\par'
      return heading + text
    }),
    '}',
  ].join('')

  const blob = new Blob([body], { type: 'application/rtf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileBaseName || slugify(title)}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadPdfReport(
  title: string,
  sections: ReportSection[],
  fileBaseName?: string,
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxWidth = pageWidth - margin * 2
  let y = margin

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, margin, y)
  y += 20

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Generated at: ${new Date().toLocaleString()}`, margin, y)
  y += 18

  for (const section of sections) {
    ensureSpace(22)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(section.heading, margin, y)
    y += 14

    const text = sectionText(section.content)
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.setFont('courier', 'normal')
    doc.setFontSize(9)

    for (const line of lines) {
      ensureSpace(12)
      doc.text(line, margin, y)
      y += 11
    }

    y += 10
  }

  doc.save(`${fileBaseName || slugify(title)}.pdf`)
}
