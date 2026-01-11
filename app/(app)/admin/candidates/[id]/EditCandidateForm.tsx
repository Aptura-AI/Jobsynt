'use client';

import { useState } from 'react';

type Candidate = {
  id: string;
  experience_years?: number;
  location?: string | null;
  primary_skills?: string[] | null;
  secondary_skills?: string[] | null;
  [key: string]: any;
};

type EditCandidateFormProps = {
  candidate: Candidate;
};

export default function EditCandidateForm({ candidate }: EditCandidateFormProps) {
  // Local state for form fields
  const [experience, setExperience] = useState<string>(candidate.experience_years?.toString() || '');
  const [location, setLocation] = useState<string>(candidate.location || '');
  const [primarySkill, setPrimarySkill] = useState<string>(
    candidate.primary_skills && candidate.primary_skills.length > 0 
      ? candidate.primary_skills[0] 
      : ''
  );
  const [secondarySkills, setSecondarySkills] = useState<string[]>(
    candidate.secondary_skills || []
  );
  const [additionalSkills, setAdditionalSkills] = useState<string[]>([]);

  // Handle secondary skills input (comma-separated or individual)
  const handleSecondarySkillsChange = (value: string) => {
    const skills = value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    setSecondarySkills(skills);
  };

  // Handle additional skills input
  const handleAdditionalSkillsChange = (value: string) => {
    const skills = value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    setAdditionalSkills(skills);
  };

  // Add individual skill to secondary skills
  const addSecondarySkill = () => {
    const skill = prompt('Enter a secondary skill:');
    if (skill && skill.trim()) {
      setSecondarySkills([...secondarySkills, skill.trim()]);
    }
  };

  // Remove secondary skill
  const removeSecondarySkill = (index: number) => {
    setSecondarySkills(secondarySkills.filter((_, i) => i !== index));
  };

  // Add individual skill to additional skills
  const addAdditionalSkill = () => {
    const skill = prompt('Enter an additional skill:');
    if (skill && skill.trim()) {
      setAdditionalSkills([...additionalSkills, skill.trim()]);
    }
  };

  // Remove additional skill
  const removeAdditionalSkill = (index: number) => {
    setAdditionalSkills(additionalSkills.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-ink mb-4">Edit Candidate Profile</h3>
      </div>

      <div className="space-y-4">
        {/* Experience Field */}
        <div>
          <label htmlFor="experience" className="block text-sm font-medium text-ink mb-1">
            Experience (Years) <span className="text-red-500">*</span>
          </label>
          <input
            id="experience"
            type="number"
            min="0"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Enter years of experience"
          />
        </div>

        {/* Location Field */}
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-ink mb-1">
            Location
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Enter location"
          />
        </div>

        {/* Primary Skill Field (Required) */}
        <div>
          <label htmlFor="primary_skill" className="block text-sm font-medium text-ink mb-1">
            Primary Skill <span className="text-red-500">*</span>
          </label>
          <input
            id="primary_skill"
            type="text"
            value={primarySkill}
            onChange={(e) => setPrimarySkill(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Enter primary skill (required)"
          />
          {!primarySkill && (
            <p className="mt-1 text-xs text-red-500">Primary skill is required</p>
          )}
        </div>

        {/* Secondary Skills Field (Multi-input) */}
        <div>
          <label htmlFor="secondary_skills" className="block text-sm font-medium text-ink mb-1">
            Secondary Skills
          </label>
          <input
            id="secondary_skills"
            type="text"
            value={secondarySkills.join(', ')}
            onChange={(e) => handleSecondarySkillsChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Enter secondary skills (comma-separated)"
          />
          <p className="mt-1 text-xs text-muted">Separate multiple skills with commas</p>
          
          {/* Display secondary skills as tags */}
          {secondarySkills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {secondarySkills.map((skill, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-sm"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSecondarySkill(index)}
                    className="text-slate-500 hover:text-slate-700"
                    aria-label={`Remove ${skill}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          
          <button
            type="button"
            onClick={addSecondarySkill}
            className="mt-2 text-sm text-primary hover:underline"
          >
            + Add skill
          </button>
        </div>

        {/* Additional Skills Field (Multi-input) */}
        <div>
          <label htmlFor="additional_skills" className="block text-sm font-medium text-ink mb-1">
            Additional Skills
          </label>
          <input
            id="additional_skills"
            type="text"
            value={additionalSkills.join(', ')}
            onChange={(e) => handleAdditionalSkillsChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Enter additional skills (comma-separated)"
          />
          <p className="mt-1 text-xs text-muted">Separate multiple skills with commas</p>
          
          {/* Display additional skills as tags */}
          {additionalSkills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {additionalSkills.map((skill, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-sm"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeAdditionalSkill(index)}
                    className="text-slate-500 hover:text-slate-700"
                    aria-label={`Remove ${skill}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          
          <button
            type="button"
            onClick={addAdditionalSkill}
            className="mt-2 text-sm text-primary hover:underline"
          >
            + Add skill
          </button>
        </div>
      </div>

      {/* Save Button (Disabled) */}
      <div className="pt-4 border-t border-slate-200">
        <button
          type="button"
          disabled
          className="px-4 py-2 bg-slate-300 text-slate-500 rounded-md font-semibold cursor-not-allowed"
        >
          Save Changes
        </button>
        <p className="mt-2 text-xs text-muted">Save functionality will be enabled in the next step</p>
      </div>
    </div>
  );
}
