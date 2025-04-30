import React from 'react'

export default function ResumeTemplate({ data }: { data: any }) {
  return (
    <div className="bg-white text-gray-800 p-8 rounded-lg shadow-lg">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">{data.name || 'Your Name'}</h1>
      </header>
      
      <section className="mb-8">
        <h2 className="text-xl font-bold border-b pb-2 mb-4">Skills</h2>
        <div className="flex flex-wrap gap-2">
          {data.skills?.map((skill: string) => (
            <span key={skill} className="bg-gray-100 px-3 py-1 rounded">
              {skill}
            </span>
          ))}
        </div>
      </section>
      
      <section>
        <h2 className="text-xl font-bold border-b pb-2 mb-4">Experience</h2>
        {data.experience?.map((exp: any) => (
          <div key={exp.id} className="mb-6">
            <h3 className="font-bold">{exp.title}</h3>
            <p>{exp.company} • {exp.duration}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
