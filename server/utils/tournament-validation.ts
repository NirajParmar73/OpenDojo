import { z } from 'zod'
import { participationBelts } from '../../shared/utils/tournament-participation'

export const tournamentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  level: z.string().trim().min(1).max(100),
  venue: z.string().trim().max(300).optional(),
  startDate: z.string().date(),
  endDate: z.string().date().optional(),
  ageCutoffDate: z.string().date(),
  participantListTitle: z.string().trim().max(300).default(''),
  coachName: z.string().trim().max(200).default(''),
  registrationEnabled: z.boolean().default(true),
}).refine(body => !body.endDate || body.endDate >= body.startDate, { message: 'End date must be on or after the start date', path: ['endDate'] })

export const participantSchema = z.object({
  fullName: z.string().trim().min(2).max(150).transform(value => value.replace(/\s+/g, ' ')),
  dateOfBirth: z.string().date(),
  gender: z.enum(['M', 'F']),
  weightKg: z.number().positive().max(300),
  belt: z.enum(participationBelts),
  ageCategory: z.string().trim().min(1).max(100),
  kata: z.boolean(),
  kumite: z.boolean(),
}).refine(body => body.kata || body.kumite, { message: 'Select Kata, Kumite, or both', path: ['kata'] })

export const publicParticipantSchema = participantSchema.safeExtend({
  requestKey: z.string().uuid(),
  consent: z.literal(true),
  website: z.string().max(0).default(''),
})
