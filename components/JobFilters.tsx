import React from 'react';
import Input from './Input';
import Select from './Select';
import TagInput from './TagInput';

type JobFilterValues = {
  search: string;
  location: string;
  experience: string;
  workMode: string;
  skills: string[];
};

type JobFiltersProps = JobFilterValues & {
  onChange: (payload: Partial<JobFilterValues>) => void;
};

export default function JobFilters({ search, location, experience, workMode, skills, onChange }: JobFiltersProps) {
  return (
    <div className="card p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Search"
          placeholder="Search title, company, keywords"
          value={search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
        <Input label="Location" placeholder="Remote, city, region" value={location} onChange={(e) => onChange({ location: e.target.value })} />
        <Select label="Experience" value={experience} onChange={(e) => onChange({ experience: e.target.value })}>
          <option value="">Any</option>
          <option value="4-7">4-7 years</option>
          <option value="5-8">5-8 years</option>
          <option value="6-9">6-9 years</option>
          <option value="6-10">6-10 years</option>
          <option value="7-10">7-10 years</option>
          <option value="8-12">8-12 years</option>
        </Select>
        <Select label="Work mode" value={workMode} onChange={(e) => onChange({ workMode: e.target.value })}>
          <option value="">Any</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </Select>
      </div>
      <div className="mt-4">
        <TagInput label="Skills" values={skills} onChange={(values) => onChange({ skills: values })} />
      </div>
    </div>
  );
}

