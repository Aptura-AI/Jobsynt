'use client';

import { useState } from 'react';
import { FiUpload, FiUser, FiBriefcase, FiMail, FiPhone, FiMapPin, FiAward, FiBook } from 'react-icons/fi';
import { parseResumeWithPdfCo } from '@/lib/pdfcoClient';
import { OpenAI } from 'openai';

export default function ProfilePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [fileName, setFileName] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // remove data prefix
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);

    try {
      // Convert to base64
      const base64 = await convertToBase64(file);

      // Send to PDF.co
      const pdfcoResult = await parseResumeWithPdfCo(base64);

      // Initialize OpenAI (using your existing config)
      const openai = new OpenAI({
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      // Send to OpenAI for structured refinement
      const prompt = `Extract the following fields from this resume JSON: firstName, middleName, lastName, city, state, email, phone, linkedin, education (array with degree, field, from, to), workExperience (array with designation, company, from, to, details), languages (list), skills (list). Return only valid JSON. Input: ${JSON.stringify(pdfcoResult)}`;

      const gptRes = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      });

      const aiJson = JSON.parse(gptRes.choices[0].message.content || '{}');
      setParsedData(aiJson);
    } catch (err) {
      console.error('Resume parsing failed', err);
      alert('Something went wrong while parsing the resume.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-purple-400 mb-2">Welcome to Jobsynt</h1>
          <p className="text-xl text-gray-300">
            Let's get started by uploading your resume
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-2xl p-8">
          {/* Resume Upload Section */}
          <div className="border-2 border-dashed border-purple-500 rounded-lg p-8 text-center mb-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <FiUpload className="w-12 h-12 text-purple-400" />
              
              {fileName ? (
                <p className="text-lg font-medium text-purple-200 truncate max-w-full">
                  {fileName}
                </p>
              ) : (
                <p className="text-lg font-medium text-gray-300">
                  Drag & drop your resume here
                </p>
              )}
              
              <input
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                id="resume-upload"
                onChange={handleFileChange}
              />
              <label 
                htmlFor="resume-upload"
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md cursor-pointer transition"
              >
                {fileName ? 'Change File' : 'Browse Files'}
              </label>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className={`px-8 py-3 rounded-md font-bold text-lg ${
                file && !loading 
                  ? 'bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/20' 
                  : 'bg-gray-600 cursor-not-allowed'
              } transition transform hover:scale-105`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Upload & Parse Resume'
              )}
            </button>
          </div>

          {/* Parsed Data Display */}
          {parsedData && (
            <div className="mt-12 bg-gray-700 rounded-xl p-6 shadow-inner">
              <h2 className="text-2xl font-bold text-purple-300 mb-6 border-b border-purple-500 pb-2">
                Your Profile Summary
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-purple-200 flex items-center">
                    <FiUser className="mr-2" /> Personal Information
                  </h3>
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <InfoItem label="Name" value={`${parsedData.firstName || ''} ${parsedData.middleName || ''} ${parsedData.lastName || ''}`.trim()} />
                    <InfoItem label="Email" value={parsedData.email} icon={<FiMail />} />
                    <InfoItem label="Phone" value={parsedData.phone} icon={<FiPhone />} />
                    <InfoItem label="Location" value={parsedData.city || parsedData.state ? `${parsedData.city || ''}${parsedData.city && parsedData.state ? ', ' : ''}${parsedData.state || ''}` : 'Not specified'} icon={<FiMapPin />} />
                    {parsedData.linkedin && <InfoItem label="LinkedIn" value={parsedData.linkedin} />}
                  </div>
                </div>

                {/* Education */}
                {parsedData.education?.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-purple-200 flex items-center">
                      <FiBook className="mr-2" /> Education
                    </h3>
                    <div className="bg-gray-800 p-4 rounded-lg space-y-3">
                      {parsedData.education.map((edu: any, index: number) => (
                        <div key={index} className="border-l-2 border-purple-500 pl-3">
                          <p className="font-medium text-white">{edu.degree}</p>
                          {edu.field && <p className="text-gray-400 text-sm">{edu.field}</p>}
                          {(edu.from || edu.to) && (
                            <p className="text-gray-500 text-xs">
                              {edu.from || '?'} - {edu.to || 'Present'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Work Experience */}
                {parsedData.workExperience?.length > 0 && (
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold text-purple-200 flex items-center">
                      <FiBriefcase className="mr-2" /> Work Experience
                    </h3>
                    <div className="bg-gray-800 p-4 rounded-lg space-y-4">
                      {parsedData.workExperience.map((exp: any, index: number) => (
                        <div key={index} className="border-l-2 border-purple-500 pl-3">
                          <p className="font-medium text-white">{exp.designation}</p>
                          <p className="text-gray-400">{exp.company}</p>
                          <p className="text-gray-500 text-sm">
                            {exp.from || '?'} - {exp.to || 'Present'}
                          </p>
                          {exp.details && <p className="text-gray-400 text-sm mt-1">{exp.details}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills */}
                {parsedData.skills?.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-purple-200 flex items-center">
                      <FiAward className="mr-2" /> Skills
                    </h3>
                    <div className="bg-gray-800 p-4 rounded-lg flex flex-wrap gap-2">
                      {parsedData.skills.map((skill: string, index: number) => (
                        <span key={index} className="bg-purple-900 text-purple-100 px-3 py-1 rounded-full text-sm">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Languages */}
                {parsedData.languages?.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-purple-200">Languages</h3>
                    <div className="bg-gray-800 p-4 rounded-lg flex flex-wrap gap-2">
                      {parsedData.languages.map((lang: string, index: number) => (
                        <span key={index} className="bg-gray-600 text-gray-100 px-3 py-1 rounded-full text-sm">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component for info items
function InfoItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs text-purple-400 uppercase tracking-wider">{label}</p>
      <p className="text-white flex items-center">
        {icon && <span className="mr-2">{icon}</span>}
        {value || 'Not specified'}
      </p>
    </div>
  );
}