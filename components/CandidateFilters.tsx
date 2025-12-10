import Input from './Input';
import Select from './Select';
import TagInput from './TagInput';

type CandidateFilterValues = {
  search: string;
  location: string;
  minExperience: number | null;
  skills: string[];
};

type CandidateFiltersProps = CandidateFilterValues & {
  onChange: (payload: Partial<CandidateFilterValues>) => void;
};

export default function CandidateFilters({ search, location, minExperience, skills, onChange }: CandidateFiltersProps) {
  return (
    <div className="card p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Search"
          placeholder="Search name or title"
          value={search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
        <Input label="Location" placeholder="City or remote" value={location} onChange={(e) => onChange({ location: e.target.value })} />
        <Select
          label="Minimum experience"
          value={minExperience?.toString() || ''}
          onChange={(e) => onChange({ minExperience: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Any</option>
          <option value="3">3+ years</option>
          <option value="5">5+ years</option>
          <option value="7">7+ years</option>
          <option value="10">10+ years</option>
        </Select>
      </div>
      <div className="mt-4">
        <TagInput label="Skills" values={skills} onChange={(values) => onChange({ skills: values })} />
      </div>
    </div>
  );
}

