export const escapeHtml = (value: unknown) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildExportHtml = (title: string, rows: Record<string, string>[], headers: string[]) => `
  <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #12151c; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        p.meta { color: #6b7280; font-size: 12px; margin-top: 0; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e4e7ec; font-size: 13px; }
        th { background: #f2f4f7; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; color: #6b7280; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">Generated ${escapeHtml(new Date().toLocaleString())} &middot; ${rows.length} item(s)</p>
      <table>
        <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((r: Record<string, string>) => `<tr>${headers.map(h => `<td>${escapeHtml(r[h] || 'N/A')}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </body>
  </html>
`;

export const exportToPdf = (title: string, rows: Record<string, string>[]) => {
  if (!rows || rows.length === 0) return false;
  const headers = Object.keys(rows[0]);
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    alert('Please allow pop-ups to export the PDF.');
    return false;
  }

  try {
    printWindow.document.write(buildExportHtml(title, rows, headers));
    printWindow.document.close();
    window.setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.print();
      }
    }, 100);
    return true;
  } catch (error) {
    console.error('Failed to prepare export window', error);
    printWindow.close();
    return false;
  }
};

export const exportGroupedToPdf = (title: string, groups: { section: string, rows: Record<string, string>[] }[]) => {
  if (!groups || groups.length === 0) return false;
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    alert('Please allow pop-ups to export the PDF.');
    return false;
  }

  let html = `
  <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #12151c; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 16px; margin-top: 32px; margin-bottom: 12px; border-bottom: 1px solid #e4e7ec; padding-bottom: 4px; color: #374151; }
        p.meta { color: #6b7280; font-size: 12px; margin-top: 0; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e4e7ec; font-size: 13px; }
        th { background: #f2f4f7; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; color: #6b7280; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">Generated ${escapeHtml(new Date().toLocaleString())}</p>
  `;

  groups.forEach(group => {
    if (group.rows.length === 0) return;
    const headers = Object.keys(group.rows[0]);
    html += `
      <h2>${escapeHtml(group.section)} (${group.rows.length})</h2>
      <table>
        <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>
          ${group.rows.map(r => `<tr>${headers.map(h => `<td>${escapeHtml(r[h] || 'N/A')}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;
  });

  html += `</body></html>`;

  try {
    printWindow.document.write(html);
    printWindow.document.close();
    window.setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.print();
      }
    }, 100);
    return true;
  } catch (error) {
    console.error('Failed to prepare export window', error);
    printWindow.close();
    return false;
  }
};
