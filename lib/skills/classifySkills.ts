/**
 * Skill Classification & Validation Logic
 * 
 * CORE PRINCIPLE:
 * Candidate-provided skills are INTENT, not FACT.
 * AI must validate against resume content and professional history.
 * Platform ownership always outweighs keyword overlap.
 * 
 * HIERARCHY:
 * 1. Primary Skills define ELIGIBILITY
 * 2. Secondary and Adjacent skills only influence ranking within the same platform
 */

// Known tech stacks and their ecosystems
export const TECH_ECOSYSTEMS: Record<string, {
  name: string;
  aliases: string[];
  ecosystem: string[];
  competitors: string[];
}> = {
  // Enterprise HCM/ERP Platforms
  'oracle_hcm': {
    name: 'Oracle HCM',
    aliases: ['Oracle Cloud HCM', 'Oracle Fusion HCM', 'Oracle HR', 'Oracle'],
    ecosystem: ['Core HR', 'Payroll', 'OTL', 'Benefits', 'Absence Management', 'Recruiting', 'Talent Management', 'Learning', 'Workforce Compensation', 'Performance Management', 'OTBI', 'HDL', 'HCM Extracts', 'Fast Formulas', 'BIP Reports'],
    competitors: ['Workday', 'SAP SuccessFactors', 'SAP HCM', 'ADP', 'UKG'],
  },
  'workday': {
    name: 'Workday',
    aliases: ['Workday HCM', 'Workday Financial'],
    ecosystem: ['HCM', 'Payroll', 'Time Tracking', 'Absence', 'Benefits', 'Recruiting', 'Talent', 'Learning', 'Compensation', 'Performance', 'Prism Analytics', 'EIB', 'Calculated Fields', 'Integrations', 'Studio'],
    competitors: ['Oracle HCM', 'SAP SuccessFactors', 'ADP', 'UKG'],
  },
  'sap_hcm': {
    name: 'SAP HCM',
    aliases: ['SAP SuccessFactors', 'SAP S/4HANA', 'SAP HR', 'SAP'],
    ecosystem: ['Employee Central', 'Payroll', 'Time Management', 'Benefits', 'Recruiting', 'Onboarding', 'Learning', 'Compensation', 'Performance', 'ABAP', 'Fiori', 'Integration Center'],
    competitors: ['Oracle HCM', 'Workday', 'ADP', 'UKG'],
  },
  
  // Cloud Platforms
  'aws': {
    name: 'AWS',
    aliases: ['Amazon Web Services', 'Amazon Cloud'],
    ecosystem: ['EC2', 'S3', 'Lambda', 'ECS', 'EKS', 'RDS', 'DynamoDB', 'CloudFormation', 'CDK', 'API Gateway', 'SQS', 'SNS', 'Kinesis', 'Redshift', 'Athena', 'Glue', 'Step Functions', 'EventBridge'],
    competitors: ['Azure', 'GCP', 'Google Cloud'],
  },
  'azure': {
    name: 'Azure',
    aliases: ['Microsoft Azure', 'Azure Cloud'],
    ecosystem: ['Azure Functions', 'App Service', 'AKS', 'Cosmos DB', 'SQL Database', 'Blob Storage', 'Event Hub', 'Service Bus', 'Logic Apps', 'Data Factory', 'Synapse', 'DevOps', 'ARM Templates', 'Bicep'],
    competitors: ['AWS', 'GCP', 'Google Cloud'],
  },
  'gcp': {
    name: 'GCP',
    aliases: ['Google Cloud', 'Google Cloud Platform'],
    ecosystem: ['Compute Engine', 'Cloud Functions', 'GKE', 'BigQuery', 'Cloud SQL', 'Pub/Sub', 'Dataflow', 'Cloud Storage', 'Cloud Run', 'Firestore', 'Spanner'],
    competitors: ['AWS', 'Azure'],
  },
  
  // Programming Languages / Frameworks
  'java': {
    name: 'Java',
    aliases: ['Java SE', 'Java EE', 'Jakarta EE'],
    ecosystem: ['Spring', 'Spring Boot', 'Hibernate', 'Maven', 'Gradle', 'JPA', 'JUnit', 'Mockito', 'Tomcat', 'Kafka', 'Microservices'],
    competitors: ['.NET', 'C#', 'Python', 'Node.js', 'Go'],
  },
  'dotnet': {
    name: '.NET',
    aliases: ['C#', '.NET Core', '.NET Framework', 'ASP.NET'],
    ecosystem: ['ASP.NET Core', 'Entity Framework', 'Blazor', 'WPF', 'MAUI', 'Azure SDK', 'NuGet', 'xUnit', 'MVC'],
    competitors: ['Java', 'Python', 'Node.js', 'Go'],
  },
  'python': {
    name: 'Python',
    aliases: ['Python 3', 'Python 2'],
    ecosystem: ['Django', 'Flask', 'FastAPI', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch', 'SQLAlchemy', 'Celery', 'pytest'],
    competitors: ['Java', '.NET', 'Node.js', 'Go', 'Ruby'],
  },
  'javascript': {
    name: 'JavaScript',
    aliases: ['JS', 'ECMAScript', 'TypeScript', 'TS'],
    ecosystem: ['React', 'Angular', 'Vue', 'Node.js', 'Express', 'Next.js', 'NestJS', 'Redux', 'GraphQL', 'Jest', 'Cypress'],
    competitors: ['Python', 'Java', '.NET', 'Go'],
  },
  'react': {
    name: 'React',
    aliases: ['ReactJS', 'React.js'],
    ecosystem: ['Redux', 'Next.js', 'React Router', 'React Query', 'Zustand', 'MUI', 'Tailwind', 'Styled Components', 'Jest', 'Testing Library'],
    competitors: ['Angular', 'Vue', 'Svelte'],
  },
  
  // Data & Analytics
  'salesforce': {
    name: 'Salesforce',
    aliases: ['SFDC', 'Salesforce CRM'],
    ecosystem: ['Apex', 'Lightning', 'Visualforce', 'SOQL', 'Flow', 'CPQ', 'Service Cloud', 'Marketing Cloud', 'Commerce Cloud', 'MuleSoft'],
    competitors: ['Microsoft Dynamics', 'HubSpot', 'Zoho CRM'],
  },
  'snowflake': {
    name: 'Snowflake',
    aliases: ['Snowflake Cloud', 'Snowflake Data Cloud'],
    ecosystem: ['Snowpipe', 'Streams', 'Tasks', 'Time Travel', 'Data Sharing', 'Snowpark', 'dbt'],
    competitors: ['Databricks', 'Redshift', 'BigQuery', 'Synapse'],
  },
  'databricks': {
    name: 'Databricks',
    aliases: ['Azure Databricks', 'Databricks Lakehouse'],
    ecosystem: ['Delta Lake', 'Spark', 'MLflow', 'Unity Catalog', 'SQL Analytics', 'Notebooks'],
    competitors: ['Snowflake', 'EMR', 'Dataproc', 'Synapse'],
  },
};

// Generic/domain skills that apply across platforms
export const GENERIC_SKILLS = [
  'Agile', 'Scrum', 'Kanban', 'REST API', 'GraphQL', 'SQL', 'NoSQL', 'CI/CD',
  'Git', 'Docker', 'Kubernetes', 'Microservices', 'DevOps', 'TDD', 'BDD',
  'ETL', 'Data Modeling', 'Data Warehousing', 'Reporting', 'BI',
  'Payroll Processing', 'HR Operations', 'Benefits Administration', 'Compliance',
  'System Integration', 'API Development', 'Web Services', 'SOA', 'SOAP',
  'Project Management', 'Technical Leadership', 'Architecture', 'Design Patterns',
  'Security', 'Performance Optimization', 'Troubleshooting', 'Documentation',
];

export interface ClassifiedSkills {
  primary_stack: string | null;
  ecosystem_skills: string[];
  adjacent_stacks: string[];
  generic_skills: string[];
}

export interface SkillValidationResult {
  validated_skills: ClassifiedSkills;
  confidence: 'High' | 'Medium' | 'Low';
  source: 'candidate' | 'ai_inferred' | 'mixed';
  mismatches: string[];
  notes: string[];
}

/**
 * Normalize a skill string for comparison
 */
export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Find the ecosystem a skill belongs to
 */
export function findSkillEcosystem(skill: string): string | null {
  const normalized = normalizeSkill(skill);
  
  for (const [key, ecosystem] of Object.entries(TECH_ECOSYSTEMS)) {
    // Check if skill matches the platform name or aliases
    if (normalizeSkill(ecosystem.name) === normalized) return key;
    if (ecosystem.aliases.some(a => normalizeSkill(a) === normalized)) return key;
    
    // Check if skill is in the ecosystem
    if (ecosystem.ecosystem.some(e => normalizeSkill(e) === normalized)) return key;
  }
  
  return null;
}

/**
 * Check if two skills are from competing platforms
 */
export function areCompetingPlatforms(skill1: string, skill2: string): boolean {
  const eco1 = findSkillEcosystem(skill1);
  const eco2 = findSkillEcosystem(skill2);
  
  if (!eco1 || !eco2 || eco1 === eco2) return false;
  
  const platform1 = TECH_ECOSYSTEMS[eco1];
  const platform2 = TECH_ECOSYSTEMS[eco2];
  
  return platform1.competitors.some(c => 
    normalizeSkill(c) === normalizeSkill(platform2.name) ||
    platform2.aliases.some(a => normalizeSkill(a) === normalizeSkill(c))
  );
}

/**
 * Validate candidate-provided skills against resume text
 * 
 * CRITICAL: This is the AI validation layer.
 * Candidate input is INTENT, not FACT.
 */
export function validateSkillsAgainstResume(
  candidateSkills: {
    primary_skills: string[];
    secondary_skills: string[];
    adjacent_skills: string[];
    generic_skills: string[];
  },
  resumeText: string | null,
  summary: string | null
): SkillValidationResult {
  const mismatches: string[] = [];
  const notes: string[] = [];
  
  // Combine resume and summary for analysis
  const textToAnalyze = `${resumeText || ''} ${summary || ''}`.toLowerCase();
  
  if (!textToAnalyze.trim()) {
    // No resume/summary to validate against
    return {
      validated_skills: {
        primary_stack: candidateSkills.primary_skills[0] || null,
        ecosystem_skills: candidateSkills.secondary_skills,
        adjacent_stacks: candidateSkills.adjacent_skills,
        generic_skills: candidateSkills.generic_skills,
      },
      confidence: 'Low',
      source: 'candidate',
      mismatches: ['No resume text available for validation'],
      notes: ['Skill validation based on candidate input only'],
    };
  }

  // Track evidence found for each primary skill
  const primarySkillEvidence: Record<string, number> = {};
  
  for (const primarySkill of candidateSkills.primary_skills) {
    let evidence = 0;
    const normalized = normalizeSkill(primarySkill);
    const ecosystem = findSkillEcosystem(primarySkill);
    
    // Direct mention
    if (textToAnalyze.includes(normalized)) {
      evidence += 2;
    }
    
    // Check for ecosystem skills in resume
    if (ecosystem) {
      const ecoData = TECH_ECOSYSTEMS[ecosystem];
      const ecoMentions = ecoData.ecosystem.filter(e => 
        textToAnalyze.includes(normalizeSkill(e))
      );
      evidence += ecoMentions.length;
      
      // Check for competitor mentions (indicates adjacent, not primary)
      const competitorMentions = ecoData.competitors.filter(c =>
        textToAnalyze.includes(normalizeSkill(c))
      );
      if (competitorMentions.length > ecoMentions.length) {
        mismatches.push(`${primarySkill}: More evidence of competitor platforms (${competitorMentions.join(', ')})`);
        evidence = Math.max(0, evidence - competitorMentions.length);
      }
    }
    
    primarySkillEvidence[primarySkill] = evidence;
  }

  // Determine validated primary stack
  let validatedPrimaryStack: string | null = null;
  let confidence: 'High' | 'Medium' | 'Low' = 'Low';
  let source: 'candidate' | 'ai_inferred' | 'mixed' = 'candidate';

  // Find the skill with most evidence
  const sortedByEvidence = Object.entries(primarySkillEvidence)
    .sort((a, b) => b[1] - a[1]);

  if (sortedByEvidence.length > 0) {
    const [topSkill, topEvidence] = sortedByEvidence[0];
    
    if (topEvidence >= 5) {
      validatedPrimaryStack = topSkill;
      confidence = 'High';
      source = 'mixed';
      notes.push(`Strong resume evidence for ${topSkill}`);
    } else if (topEvidence >= 2) {
      validatedPrimaryStack = topSkill;
      confidence = 'Medium';
      source = 'mixed';
      notes.push(`Moderate resume evidence for ${topSkill}`);
    } else {
      // Weak evidence - still use candidate input but flag it
      validatedPrimaryStack = topSkill;
      confidence = 'Low';
      notes.push(`Weak resume evidence for ${topSkill} - treating as candidate-stated`);
    }

    // Check if candidate-stated primary differs from resume evidence
    if (candidateSkills.primary_skills[0] && 
        candidateSkills.primary_skills[0] !== topSkill && 
        topEvidence > (primarySkillEvidence[candidateSkills.primary_skills[0]] || 0)) {
      mismatches.push(`Candidate stated ${candidateSkills.primary_skills[0]} as primary, but resume shows more ${topSkill} experience`);
    }
  }

  // Validate secondary skills - check they belong to primary ecosystem
  const validSecondarySkills: string[] = [];
  const primaryEcosystem = validatedPrimaryStack ? findSkillEcosystem(validatedPrimaryStack) : null;
  
  for (const skill of candidateSkills.secondary_skills) {
    const skillEco = findSkillEcosystem(skill);
    if (skillEco === primaryEcosystem || !skillEco) {
      validSecondarySkills.push(skill);
    } else {
      // This skill belongs to a different ecosystem
      mismatches.push(`${skill} belongs to ${TECH_ECOSYSTEMS[skillEco]?.name || 'different'} ecosystem, not ${validatedPrimaryStack}`);
      notes.push(`Moved ${skill} to adjacent skills`);
    }
  }

  return {
    validated_skills: {
      primary_stack: validatedPrimaryStack,
      ecosystem_skills: validSecondarySkills,
      adjacent_stacks: candidateSkills.adjacent_skills,
      generic_skills: candidateSkills.generic_skills,
    },
    confidence,
    source,
    mismatches,
    notes,
  };
}

/**
 * Check if a job's required skills match candidate's primary stack
 * 
 * HARD RULE: Primary stack mismatch = no High priority
 */
export function checkPrimaryStackMatch(
  candidatePrimaryStack: string | null,
  jobPrimarySkills: string[]
): {
  matches: boolean;
  explanation: string;
  priority_cap: 'High' | 'Medium' | 'Low';
} {
  if (!candidatePrimaryStack) {
    return {
      matches: false,
      explanation: 'Candidate has no defined primary stack',
      priority_cap: 'Medium',
    };
  }

  if (jobPrimarySkills.length === 0) {
    return {
      matches: true,
      explanation: 'Job has no specific primary skill requirement',
      priority_cap: 'High',
    };
  }

  const candidateEco = findSkillEcosystem(candidatePrimaryStack);
  
  for (const jobSkill of jobPrimarySkills) {
    const jobEco = findSkillEcosystem(jobSkill);
    
    // Direct match
    if (normalizeSkill(candidatePrimaryStack) === normalizeSkill(jobSkill)) {
      return {
        matches: true,
        explanation: `Primary stack match: ${candidatePrimaryStack}`,
        priority_cap: 'High',
      };
    }
    
    // Same ecosystem match
    if (candidateEco && candidateEco === jobEco) {
      return {
        matches: true,
        explanation: `Same ecosystem: ${TECH_ECOSYSTEMS[candidateEco].name}`,
        priority_cap: 'High',
      };
    }
    
    // Competing platforms - explicit mismatch
    if (candidateEco && jobEco && areCompetingPlatforms(candidatePrimaryStack, jobSkill)) {
      return {
        matches: false,
        explanation: `Platform mismatch: Role requires ${jobSkill}, candidate is ${candidatePrimaryStack}-centric`,
        priority_cap: 'Low',
      };
    }
  }

  return {
    matches: false,
    explanation: `No primary stack alignment found`,
    priority_cap: 'Medium',
  };
}

/**
 * Extract likely primary platform from job description
 */
export function extractJobPrimaryPlatform(
  jobTitle: string,
  jobDescription: string | null,
  jobMustHaveSkills: string[] = []
): string[] {
  const text = `${jobTitle} ${jobDescription || ''} ${jobMustHaveSkills.join(' ')}`.toLowerCase();
  const detected: string[] = [];

  for (const [key, ecosystem] of Object.entries(TECH_ECOSYSTEMS)) {
    const platformName = normalizeSkill(ecosystem.name);
    const aliasMatches = ecosystem.aliases.some(a => text.includes(normalizeSkill(a)));
    
    if (text.includes(platformName) || aliasMatches) {
      // Check for significant ecosystem skill mentions (3+)
      const ecoMentions = ecosystem.ecosystem.filter(e => 
        text.includes(normalizeSkill(e))
      );
      
      if (ecoMentions.length >= 2 || aliasMatches) {
        detected.push(ecosystem.name);
      }
    }
  }

  return detected;
}

