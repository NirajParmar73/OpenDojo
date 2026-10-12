export type EventStatus = 'draft' | 'open' | 'closed' | 'completed' | 'cancelled'
export type BookingStatus = 'provisional' | 'pending' | 'confirmed' | 'waitlisted' | 'cancelled'
export interface EventPrices {
  student: number
  parent: number
  transportOut: number
  transportReturn: number
  accommodation: number
  taxBps: number
}
export interface EventRegistrationForm {
  id: string
  token: string
  name: string
  audience: string
  description: string
  studentFee: number
  companionFee: number
  taxBps: number
  includesTraining: boolean
  includesMeals: boolean
  includesAccommodation: boolean
  includesTransportOut: boolean
  includesTransportReturn: boolean
  enabled: boolean
}
export type EventRegistrationFormSnapshot = Omit<EventRegistrationForm, 'token' | 'enabled'>
export interface EventGuestProfile {
  dateOfBirth: string
  membershipNumber: string
  dojoName: string
  city?: string
  state: string
  country: string
  instructorName?: string
  currentGrade?: string
}
export type EventQuestionType = 'text' | 'textarea' | 'select' | 'checkbox' | 'date'
export interface EventQuestion {
  id: string
  label: string
  type: EventQuestionType
  required: boolean
  help: string
  options: string[]
}
export interface EventFormSettings {
  title: string
  introduction: string
  accentColor: string
  privacyNotice: string
  submitLabel: string
  confirmationMessage: string
  letterHeading: string
  letterBody: string
  contactText: string
  requirePhoto: boolean
  requirePhysicalCopy: boolean
  physicalCopyInstructions: string
  questions: EventQuestion[]
}
export interface EventAnswer {
  id: string
  label: string
  value: string | boolean
}
export const defaultEventFormSettings: EventFormSettings = {
  title: '', introduction: '', accentColor: '#0f766e', privacyNotice: '',
  submitLabel: 'Send registration', confirmationMessage: '',
  letterHeading: 'Invitation to participate', letterBody: '', contactText: '',
  requirePhoto: true, requirePhysicalCopy: true,
  physicalCopyInstructions: 'Download, print and sign the registration form, then submit it to the event organizer or your dojo.', questions: [],
}
export interface EventAttendee {
  id: string
  type: 'student' | 'parent'
  underFive?: boolean
  dateOfBirth?: string
  currentGrade?: string
  membershipNumber?: string
  photoPath?: string
  studentId?: number | null
  name: string
  relationship: string
  phone: string
  email: string
  meal: string
  medicalNotes: string
  transportOut: boolean
  transportReturn: boolean
  accommodation: boolean
  room: string
  busOut: string
  busReturn: string
  checkedInAt: string | null
}
export interface EventConsent {
  name: string
  phone: string
  accepted: boolean
  acceptedAt?: string | null
  terms?: string
}
