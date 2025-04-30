export async function analyzeWithGPT(parsedData: any) {
    const response = await fetch('/api/analyze-resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(parsedData)
    });
  
    if (!response.ok) {
      throw new Error('Failed to analyze resume with GPT');
    }
  
    return await response.json();
  }