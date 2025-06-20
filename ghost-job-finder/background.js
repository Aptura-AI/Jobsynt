// Background script for JobSynt Ghost Job Finder

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'ANALYZE_JOB') {
        const jobData = message.jobData;
        try {
            // Call Jobsynt API for ghost job detection
            const response = await fetch('https://your-jobsynt-api.com/api/ghost-job-check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'YOUR_API_KEY'
                },
                body: JSON.stringify({ url: jobData.url, ...jobData })
            });
            const result = await response.json();
            // Send result back to content script
            chrome.tabs.sendMessage(sender.tab.id, { type: 'GHOST_JOB_RESULT', result });
        } catch (error) {
            console.error('Ghost job detection failed:', error);
        }
    }
});
