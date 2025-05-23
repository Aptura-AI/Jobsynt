// netlify/functions/fetchJobs.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const { query = 'remote' } = event.queryStringParameters;
  
  // 1. Stack Overflow Jobs API (free)
  const soJobs = await fetch(`https://api.stackexchange.com/2.3/jobs?order=desc&sort=creation&tagged=${query}&site=stackoverflow`)
    .then(res => res.json());

  // 2. AngelList Jobs (RSS to JSON)
  const angelListJobs = await fetch(`https://angel.co/jobs/feed?description=${query}`)
    .then(res => res.text())
    .then(xml => parseXmlToJson(xml)); // Use an XML parser

  // 3. We Work Remotely (RSS)
  const wwrJobs = await fetch(`https://weworkremotely.com/categories/remote-jobs.rss`)
    .then(res => res.text());

  return {
    statusCode: 200,
    body: JSON.stringify({ soJobs, angelListJobs, wwrJobs }),
  };
};