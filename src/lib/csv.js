// Build + download a CSV from a 2D array (header row first). Works on desktop
// and mobile: tries the native share sheet first (so phones can save to Files,
// email, etc.), then falls back to a normal download. Leads with a UTF-8 BOM
// and uses CRLF so Excel opens it cleanly with accents intact.
export async function downloadCsv(filename, rows2d) {
  const cell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = rows2d.map((r) => r.map(cell).join(',')).join('\r\n')
  const blob = new Blob([String.fromCharCode(0xfeff), csv], { type: 'text/csv;charset=utf-8;' })

  // Native share (mobile): best UX.
  try {
    const file = new File([blob], filename, { type: 'text/csv' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename })
      return
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return // user cancelled the share sheet
  }

  // Desktop / fallback download.
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 1000)
}
