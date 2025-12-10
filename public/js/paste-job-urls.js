document.getElementById('processBtn').addEventListener('click', async () => {
  const textarea = document.getElementById('jobUrls');
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('results');
  statusDiv.textContent = '';
  resultsDiv.innerHTML = '';

  let urls = textarea.value
    .split(/\s|,|;/)
    .map(u => u.trim())
    .filter(u => u.startsWith('http'));

  if (urls.length === 0) {
    statusDiv.textContent = 'Please paste at least one valid job URL.';
    statusDiv.className = 'status error';
    return;
  }

  statusDiv.textContent = `Processing ${urls.length} job URL(s)...`;
  statusDiv.className = 'status';
  document.getElementById('processBtn').disabled = true;

  try {
    const response = await fetch('/.netlify/functions/paste-job-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls })
    });
    const data = await response.json();
    resultsDiv.innerHTML = '';
    if (data.success && Array.isArray(data.results)) {
      data.results.forEach(job => {
        const div = document.createElement('div');
        div.className = 'job-result ' + (job.saved ? 'success' : 'error');
        div.innerHTML = `<strong>${job.title || 'No title'}</strong><br>
          <span>${job.company || ''}</span><br>
          <a href="${job.url}" target="_blank">${job.url}</a><br>
          <small>${job.description ? job.description.substring(0, 200) : ''}</small><br>
          <span>${job.saved ? 'Saved to database' : 'Not saved'}${job.error ? ' - ' + job.error : ''}</span>`;
        resultsDiv.appendChild(div);
      });
      statusDiv.textContent = `Done! Processed ${data.count} job URL(s).`;
      statusDiv.className = 'status success';
    } else {
      statusDiv.textContent = 'Error: ' + (data.message || 'Unknown error');
      statusDiv.className = 'status error';
    }
  } catch (err) {
    statusDiv.textContent = 'Error: ' + err.message;
    statusDiv.className = 'status error';
  }
  document.getElementById('processBtn').disabled = false;
}); 