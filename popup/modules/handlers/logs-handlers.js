// Logs viewing and export handlers
async function handleViewLogs() {
  chrome.runtime.sendMessage({ action: 'getLogs' }, (response) => {
    if (response && response.logs) {
      const logsWindow = window.open('', 'Logs', 'width=800,height=600');
      logsWindow.document.write(`
        <html>
          <head>
            <title>FlirtEasy Logs</title>
            <style>
              body { font-family: 'Segoe UI', sans-serif; padding: 20px; background: #1a1a1a; color: #e0e0e0; }
              .log-entry { margin-bottom: 16px; padding: 12px; background: #2a2a2a; border-radius: 8px; border-left: 3px solid #666; }
              .log-entry.INFO { border-left-color: #3b82f6; }
              .log-entry.WARN { border-left-color: #f59e0b; }
              .log-entry.ERROR { border-left-color: #ef4444; }
              .log-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
              .log-level { font-weight: 600; }
              .log-level.INFO { color: #3b82f6; }
              .log-level.WARN { color: #f59e0b; }
              .log-level.ERROR { color: #ef4444; }
              .log-time { color: #888; font-size: 12px; }
              .log-message { margin-bottom: 8px; }
              .log-data { background: #1a1a1a; padding: 8px; border-radius: 4px; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
              .prompt-section { margin-top: 8px; padding: 8px; background: #1f2937; border-radius: 4px; }
              .prompt-label { color: #10b981; font-weight: 600; font-size: 11px; margin-bottom: 4px; }
            </style>
          </head>
          <body>
            <h2>FlirtEasy Activity Logs</h2>
            ${response.logs.map(log => {
        let dataHtml = '';
        if (log.data) {
          if (log.data.userContext !== undefined) {
            // AI Prompt log
            dataHtml = `
                    <div class="prompt-section">
                      <div class="prompt-label">USER CONTEXT:</div>
                      <div>${log.data.userContext || '(none)'}</div>
                    </div>
                    <div class="prompt-section">
                      <div class="prompt-label">SYSTEM PROMPT:</div>
                      <div>${log.data.systemPrompt || ''}</div>
                    </div>
                    <div class="prompt-section">
                      <div class="prompt-label">USER PROMPT:</div>
                      <div>${log.data.userPrompt || ''}</div>
                    </div>
                  `;
          } else if (typeof log.data === 'object') {
            dataHtml = `<div class="log-data">${JSON.stringify(log.data, null, 2)}</div>`;
          } else {
            dataHtml = `<div class="log-data">${log.data}</div>`;
          }
        }
        return `
                <div class="log-entry ${log.level}">
                  <div class="log-header">
                    <span class="log-level ${log.level}">[${log.level}]</span>
                    <span class="log-time">${new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div class="log-message">${log.message}</div>
                  ${dataHtml}
                </div>
              `;
      }).join('')}
          </body>
        </html>
      `);
    }
  });
}

async function handleExportLogs() {
  chrome.runtime.sendMessage({ action: 'exportLogs' }, (response) => {
    if (response && response.logs) {
      const blob = new Blob([response.logs], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const date = now.toISOString().slice(0, 10); // 2024-12-24
      const time = now.toTimeString().slice(0, 5).replace(':', '-'); // 14-30
      a.download = `flirteasy-logs-${date}-${time}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage('Logs exported successfully!', 'success');
    }
  });
}
