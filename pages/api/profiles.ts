// pages/api/profiles.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const {
      name,
      location,
      visaStatus,
      otherVisa,
      validTill,
      email,
      salaryRange,
      jobType,
      preferredContract,
      relocation,
      cities,
      states,
      linkedinProfile,
      experienceLevel,
    } = req.body;

    try {
      // Insert profile data into the 'profiles' table
      const { data, error } = await supabase
        .from('profiles')
        .insert([
          {
            name,
            location,
            visa_status: visaStatus,
            other_visa: otherVisa,
            valid_till: validTill,
            email,
            salary_range: salaryRange,
            job_type: jobType,
            preferred_contract: preferredContract,
            relocation,
            cities,
            states,
            linkedin_profile: linkedinProfile,
            experience_level: experienceLevel,
          },
        ]);

      if (error) {
        throw error;
      }

      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
