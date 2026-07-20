// server/database/schema.ts
import { pgTable, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ---------- TABLE DEFINITIONS (all tables first) ----------

// Organizations
export const organizations = pgTable('organizations', (t) => ({
  id: t.serial('id').primaryKey(),
  name: t.text().notNull(),
  slug: t.text().notNull().unique(),
  subscriptionPlan: t.text('subscription_plan').notNull().default('free'),
  subscriptionStatus: t.text('subscription_status').notNull().default('free'),
  billingPeriod: t.text('billing_period'),
  trialStartedAt: t.timestamp('trial_started_at', { withTimezone: true }),
  trialEndsAt: t.timestamp('trial_ends_at', { withTimezone: true }),
  subscriptionStartedAt: t.timestamp('subscription_started_at', { withTimezone: true }),
  subscriptionEndsAt: t.timestamp('subscription_ends_at', { withTimezone: true }),
  cancelAtPeriodEnd: t.boolean('cancel_at_period_end').notNull().default(false),
  paymentProvider: t.text('payment_provider'),
  providerCustomerId: t.text('provider_customer_id'),
  providerSubscriptionId: t.text('provider_subscription_id'),
  logo: t.text(),
  currency: t.text().default('USD'),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Users
export const users = pgTable('users', (t) => ({
  id: t.serial('id').primaryKey(),
  name: t.text().notNull(),
  email: t.text().notNull().unique(),
  passwordHash: t.text().notNull(),
  role: t.text().notNull().default('member'),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  avatar: t.text(),
  danDegree: t.text(),
  certificateUrl: t.text(),
  emailVerifiedAt: t.timestamp('email_verified_at', { withTimezone: true }),
  address: t.text(),
  city: t.text(),
  stateProvince: t.text('state_province'),
  country: t.text(),
  countryCode: t.varchar('country_code', { length: 2 }),
  subdivisionCode: t.text('subdivision_code'),
  postalCode: t.text('postal_code'),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Hierarchy Levels
export const hierarchyLevels = pgTable('hierarchy_levels', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull(),
  order: t.integer('order').notNull(),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Hierarchy Nodes
export const hierarchyNodes: any = pgTable('hierarchy_nodes', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  levelId: t.integer('level_id').references(() => hierarchyLevels.id, { onDelete: 'cascade' }).notNull(),
  parentId: t.integer('parent_id').references(() => hierarchyNodes.id, { onDelete: 'cascade' }),
  name: t.text().notNull(),
  countryCode: t.varchar('country_code', { length: 2 }),
  subdivisionCode: t.text('subdivision_code'),
  postalCode: t.text('postal_code'),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Dojos
export const dojos = pgTable('dojos', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  nodeId: t.integer('node_id').references(() => hierarchyNodes.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull(),
  address: t.text(),
  city: t.text(),
  stateProvince: t.text('state_province'),
  country: t.text(),
  countryCode: t.varchar('country_code', { length: 2 }),
  subdivisionCode: t.text('subdivision_code'),
  postalCode: t.text('postal_code'),
  phone: t.text(),
  email: t.text(),
  defaultFeePlanId: t.integer('default_fee_plan_id').references(() => feePlans.id, { onDelete: 'set null' }),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Belt Systems
export const beltSystems = pgTable('belt_systems', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  programId: t.integer('program_id').references(() => organizationPrograms.id, { onDelete: 'set null' }),
  name: t.text().notNull().default('Default Belt System'),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Belt Ranks
export const beltRanks = pgTable('belt_ranks', (t) => ({
  id: t.serial('id').primaryKey(),
  systemId: t.integer('system_id').references(() => beltSystems.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull(),
  level: t.text().notNull(),
  order: t.integer('order').notNull(),
  type: t.text({ enum: ['kyu', 'dan'] }).notNull(),
  danNumber: t.integer('dan_number'),
  color: t.text(),
  description: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Students
export const students = pgTable('students', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  dojoId: t.integer('dojo_id').references(() => dojos.id, { onDelete: 'set null' }),
  firstName: t.text().notNull(),
  lastName: t.text().notNull(),
  email: t.text(),
  phone: t.text(),
  dateOfBirth: t.timestamp({ withTimezone: true }),
  gender: t.text({ enum: ['male', 'female', 'other'] }),
  address: t.text(),
  city: t.text(),
  stateProvince: t.text('state_province'),
  country: t.text(),
  countryCode: t.varchar('country_code', { length: 2 }),
  subdivisionCode: t.text('subdivision_code'),
  postalCode: t.text('postal_code'),
  emergencyContact: t.text(),
  emergencyPhone: t.text(),
  medicalNotes: t.text(),
  status: t.text().default('active'),
  avatar: t.text(),
  currentBeltRankId: t.integer('current_belt_rank_id').references(() => beltRanks.id),
  joinedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Student Gradings
export const studentGradings = pgTable('student_gradings', (t) => ({
  id: t.serial('id').primaryKey(),
  studentId: t.integer('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull(),
  beltRankId: t.integer('belt_rank_id').references(() => beltRanks.id, { onDelete: 'cascade' }).notNull(),
  awardedDate: t.timestamp({ withTimezone: true }).notNull(),
  examiner: t.text(),
  certificateNumber: t.text('certificate_number'),
  certificateUrl: t.text(),
  notes: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Guardians
export const guardians = pgTable('guardians', (t) => ({
  id: t.serial('id').primaryKey(),
  studentId: t.integer('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull(),
  relationship: t.text().notNull(),
  phone: t.text(),
  email: t.text(),
  address: t.text(),
  city: t.text(),
  stateProvince: t.text('state_province'),
  country: t.text(),
  countryCode: t.varchar('country_code', { length: 2 }),
  subdivisionCode: t.text('subdivision_code'),
  postalCode: t.text('postal_code'),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Assignments
export const assignments = pgTable('assignments', (t) => ({
  id: t.serial('id').primaryKey(),
  userId: t.integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: t.text({ enum: ['owner', 'admin', 'country_head', 'state_head', 'district_head', 'city_head', 'zone_head', 'dojo_head', 'instructor', 'member'] }).notNull(),
  scopeType: t.text({ enum: ['node', 'dojo'] }).notNull(),
  scopeId: t.integer('scope_id').notNull(),
  startDate: t.timestamp({ withTimezone: true }),
  endDate: t.timestamp({ withTimezone: true }),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Dojo Schedules
export const dojoSchedules = pgTable('dojo_schedules', (t) => ({
  id: t.serial('id').primaryKey(),
  dojoId: t.integer('dojo_id').references(() => dojos.id, { onDelete: 'cascade' }).notNull(),
  dayOfWeek: t.integer('day_of_week').notNull(),
  startTime: t.text().notNull(),
  endTime: t.text().notNull(),
  name: t.text(),
  programId: t.integer('program_id').references(() => organizationPrograms.id, { onDelete: 'set null' }),
  instructorId: t.integer('instructor_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Class Sessions
export const classSessions = pgTable('class_sessions', (t) => ({
  id: t.serial('id').primaryKey(),
  dojoId: t.integer('dojo_id').references(() => dojos.id, { onDelete: 'cascade' }).notNull(),
  scheduleId: t.integer('schedule_id').references(() => dojoSchedules.id, { onDelete: 'set null' }),
  date: t.timestamp({ withTimezone: true }).notNull(),
  startTime: t.text().notNull(),
  endTime: t.text().notNull(),
  instructorId: t.integer('instructor_id').references(() => users.id, { onDelete: 'set null' }),
  name: t.text(),
  programId: t.integer('program_id').references(() => organizationPrograms.id, { onDelete: 'set null' }),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Attendance
export const attendance = pgTable('attendance', (t) => ({
  id: t.serial('id').primaryKey(),
  sessionId: t.integer('session_id').references(() => classSessions.id, { onDelete: 'cascade' }).notNull(),
  studentId: t.integer('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull(),
  status: t.text({ enum: ['present', 'absent', 'late', 'excused'] }).default('present'),
  notes: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// External governing bodies are tenant-owned directory records. They do not
// grant the external organization access to this tenant's data.
export const governingBodies = pgTable('governing_bodies', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull(),
  level: t.text({ enum: ['international', 'national', 'state', 'district', 'city', 'local', 'other'] }).notNull().default('other'),
  country: t.text(), website: t.text(), contactName: t.text('contact_name'), contactEmail: t.text('contact_email'), contactPhone: t.text('contact_phone'), notes: t.text(),
  createdAt: t.timestamp('created_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp('updated_at', { withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

export const emailVerificationTokens = pgTable('email_verification_tokens', (t) => ({
  id: t.serial('id').primaryKey(),
  userId: t.integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  tokenHash: t.text('token_hash').notNull(),
  expiresAt: t.timestamp('expires_at', { withTimezone: true }).notNull(),
  sentAt: t.timestamp('sent_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
}))

// Per-user completion state for the role-specific getting-started guide.
// Operational steps can still be completed automatically in the UI; this table
// records review steps that cannot be inferred safely from other records.
export const onboardingProgress = pgTable('onboarding_progress', (t) => ({
  id: t.serial('id').primaryKey(),
  userId: t.integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  stepKey: t.text('step_key').notNull(),
  completedAt: t.timestamp('completed_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
}), table => [
  uniqueIndex('onboarding_progress_user_step_unique').on(table.userId, table.stepKey),
])

// Platform-owned records deliberately do not belong to a customer organization.
// They remain available after a tenant is permanently deleted.
export const platformAuditLogs = pgTable('platform_audit_logs', (t) => ({
  id: t.serial('id').primaryKey(),
  actorUserId: t.integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: t.text().notNull(),
  organizationId: t.integer('organization_id'),
  organizationName: t.text('organization_name').notNull(),
  details: t.text(),
  createdAt: t.timestamp('created_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
}))

// Portal accounts are intentionally separate from staff users. They are created
// by an administrator and each one is permanently linked to one student.
export const studentPortalAccounts = pgTable('student_portal_accounts', (t) => ({
  id: t.serial('id').primaryKey(),
  studentId: t.integer('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull().unique(),
  username: t.text().notNull().unique(),
  passwordHash: t.text('password_hash').notNull(),
  isActive: t.integer('is_active').notNull().default(1),
  createdAt: t.timestamp('created_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp('updated_at', { withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Immutable organization activity trail. Scope makes every event visible only
// to owners or staff responsible for the relevant hierarchy territory / dojo.
export const auditLogs = pgTable('audit_logs', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  actorUserId: t.integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: t.text().notNull(),
  entityType: t.text('entity_type').notNull(),
  entityId: t.integer('entity_id'),
  targetLabel: t.text('target_label').notNull(),
  scopeType: t.text('scope_type', { enum: ['organization', 'node', 'dojo'] }).notNull(),
  scopeId: t.integer('scope_id'),
  details: t.text(),
  createdAt: t.timestamp('created_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
}))

export const tournaments = pgTable('tournaments', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull(),
  level: t.text().notNull(),
  venue: t.text(),
  startDate: t.timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: t.timestamp('end_date', { withTimezone: true }),
  ageCutoffDate: t.timestamp('age_cutoff_date', { withTimezone: true }),
  createdAt: t.timestamp('created_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp('updated_at', { withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Category, event, and result are intentionally free-form so each organization
// can follow its own competition rules.
export const studentAchievements = pgTable('student_achievements', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  studentId: t.integer('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull(),
  tournamentId: t.integer('tournament_id').references(() => tournaments.id, { onDelete: 'set null' }),
  tournamentName: t.text('tournament_name').notNull(),
  tournamentLevel: t.text('tournament_level').notNull(),
  venue: t.text(),
  startDate: t.timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: t.timestamp('end_date', { withTimezone: true }),
  eventType: t.text('event_type'),
  beltDivision: t.text('belt_division').default('colour'),
  ageCategory: t.text('age_category'),
  weightCategory: t.text('weight_category'),
  result: t.text(),
  placeSecured: t.integer('place_secured'),
  medalType: t.text('medal_type'),
  medalsWon: t.integer('medals_won').notNull().default(0),
  certificateUrl: t.text('certificate_url'),
  notes: t.text(),
  createdBy: t.integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: t.timestamp('created_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp('updated_at', { withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

export const affiliations = pgTable('affiliations', (t) => ({
  id: t.serial('id').primaryKey(), organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  governingBodyId: t.integer('governing_body_id').references(() => governingBodies.id, { onDelete: 'cascade' }).notNull(),
  scopeType: t.text('scope_type', { enum: ['organization', 'node', 'dojo'] }).notNull(), scopeId: t.integer('scope_id'),
  relationshipType: t.text('relationship_type', { enum: ['parent_affiliation', 'membership', 'recognition', 'license', 'accreditation'] }).notNull(), membershipNumber: t.text('membership_number'),
  status: t.text({ enum: ['pending', 'active', 'expired', 'suspended'] }).notNull().default('pending'),
  startedAt: t.timestamp('started_at', { withTimezone: true }), expiresAt: t.timestamp('expires_at', { withTimezone: true }), renewalDueAt: t.timestamp('renewal_due_at', { withTimezone: true }),
  feeAmount: t.integer('fee_amount'), feeFrequency: t.text('fee_frequency', { enum: ['one_time', 'monthly', 'quarterly', 'annual'] }), documentUrl: t.text('document_url'), notes: t.text(),
  createdAt: t.timestamp('created_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(), updatedAt: t.timestamp('updated_at', { withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

export const expenses = pgTable('expenses', (t) => ({
  id: t.serial('id').primaryKey(), organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  affiliationId: t.integer('affiliation_id').references(() => affiliations.id, { onDelete: 'set null' }), scopeType: t.text('scope_type', { enum: ['organization', 'node', 'dojo'] }).notNull(), scopeId: t.integer('scope_id'),
  category: t.text().notNull(), payee: t.text(), description: t.text().notNull(), invoiceNumber: t.text('invoice_number'), amount: t.integer().notNull(), taxAmount: t.integer('tax_amount').notNull().default(0),
  incurredAt: t.timestamp('incurred_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(), dueAt: t.timestamp('due_at', { withTimezone: true }), paidAt: t.timestamp('paid_at', { withTimezone: true }), paymentMethod: t.text('payment_method'), paymentReference: t.text('payment_reference'),
  status: t.text({ enum: ['draft', 'due', 'partially_paid', 'paid', 'overdue', 'cancelled'] }).notNull().default('due'), receiptUrl: t.text('receipt_url'), notes: t.text(), createdBy: t.integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: t.timestamp('created_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(), updatedAt: t.timestamp('updated_at', { withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Programs are tenant-owned so an organization can teach multiple arts/styles.
export const organizationPrograms = pgTable('organization_programs', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  martialArt: t.text('martial_art').notNull(),
  style: t.text().notNull(),
  displayName: t.text('display_name').notNull(),
  isPrimary: t.integer('is_primary').notNull().default(0),
  isActive: t.integer('is_active').notNull().default(1),
  createdAt: t.timestamp('created_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp('updated_at', { withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

export const instructorQualifications = pgTable('instructor_qualifications', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: t.integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  programId: t.integer('program_id').references(() => organizationPrograms.id, { onDelete: 'set null' }),
  qualification: t.text().notNull(),
  issuer: t.text(),
  certificateNumber: t.text('certificate_number'),
  expiresAt: t.timestamp('expires_at', { withTimezone: true }),
  certificateUrl: t.text('certificate_url'),
  notes: t.text(),
  createdAt: t.timestamp('created_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp('updated_at', { withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

export const dojoInstructors = pgTable('dojo_instructors', (t) => ({
  id: t.serial('id').primaryKey(),
  dojoId: t.integer('dojo_id').references(() => dojos.id, { onDelete: 'cascade' }).notNull(),
  userId: t.integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  programId: t.integer('program_id').references(() => organizationPrograms.id, { onDelete: 'set null' }),
  isPrimary: t.integer('is_primary').notNull().default(0),
  isActive: t.integer('is_active').notNull().default(1),
  createdAt: t.timestamp('created_at', { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp('updated_at', { withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// ---------- RELATIONS (all relations after all tables) ----------

export const organizationsRelations = relations(organizations, ({ many }): any => ({
  users: many(users),
  hierarchyLevels: many(hierarchyLevels),
  hierarchyNodes: many(hierarchyNodes),
  dojos: many(dojos),
  students: many(students),
  auditLogs: many(auditLogs),
}))

export const hierarchyLevelsRelations = relations(hierarchyLevels, ({ many }): any => ({
  nodes: many(hierarchyNodes),
}))

export const hierarchyNodesRelations = relations(hierarchyNodes, ({ one, many }): any => ({
  organization: one(organizations, {
    fields: [hierarchyNodes.organizationId],
    references: [organizations.id],
  }),
  level: one(hierarchyLevels, {
    fields: [hierarchyNodes.levelId],
    references: [hierarchyLevels.id],
  }),
  parent: one(hierarchyNodes, {
    fields: [hierarchyNodes.parentId],
    references: [hierarchyNodes.id],
  }),
  children: many(hierarchyNodes, { relationName: 'children' }),
  dojos: many(dojos),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  assignments: many(assignments),
  auditLogs: many(auditLogs),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, { fields: [auditLogs.organizationId], references: [organizations.id] }),
  actor: one(users, { fields: [auditLogs.actorUserId], references: [users.id] }),
}))

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  user: one(users, {
    fields: [assignments.userId],
    references: [users.id],
  }),
}))

export const beltSystemsRelations = relations(beltSystems, ({ many }) => ({
  ranks: many(beltRanks),
}))

export const beltRanksRelations = relations(beltRanks, ({ one }) => ({
  system: one(beltSystems, {
    fields: [beltRanks.systemId],
    references: [beltSystems.id],
  }),
}))

export const studentsRelations = relations(students, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [students.organizationId],
    references: [organizations.id],
  }),
  dojo: one(dojos, {
    fields: [students.dojoId],
    references: [dojos.id],
  }),
  currentBeltRank: one(beltRanks, {
    fields: [students.currentBeltRankId],
    references: [beltRanks.id],
  }),
  guardians: many(guardians),
  gradings: many(studentGradings),
  achievements: many(studentAchievements),
  attendance: many(attendance),
  documents: many(documents),
  portalAccounts: many(studentPortalAccounts),
  
}))

export const studentGradingsRelations = relations(studentGradings, ({ one }) => ({
  student: one(students, {
    fields: [studentGradings.studentId],
    references: [students.id],
  }),
  beltRank: one(beltRanks, {
    fields: [studentGradings.beltRankId],
    references: [beltRanks.id],
  }),
}))

export const guardiansRelations = relations(guardians, ({ one }) => ({
  student: one(students, {
    fields: [guardians.studentId],
    references: [students.id],
  }),
}))

export const dojosRelations = relations(dojos, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [dojos.organizationId],
    references: [organizations.id],
  }),
  node: one(hierarchyNodes, {
    fields: [dojos.nodeId],
    references: [hierarchyNodes.id],
  }),
  students: many(students),
  schedules: many(dojoSchedules),
  classSessions: many(classSessions),
}))

export const dojoSchedulesRelations = relations(dojoSchedules, ({ one }) => ({
  dojo: one(dojos, {
    fields: [dojoSchedules.dojoId],
    references: [dojos.id],
  }),
  instructor: one(users, {
    fields: [dojoSchedules.instructorId],
    references: [users.id],
  }),
}))

export const classSessionsRelations = relations(classSessions, ({ one, many }) => ({
  dojo: one(dojos, {
    fields: [classSessions.dojoId],
    references: [dojos.id],
  }),
  schedule: one(dojoSchedules, {
    fields: [classSessions.scheduleId],
    references: [dojoSchedules.id],
  }),
  instructor: one(users, {
    fields: [classSessions.instructorId],
    references: [users.id],
  }),
  attendance: many(attendance),
}))

export const attendanceRelations = relations(attendance, ({ one }) => ({
  session: one(classSessions, {
    fields: [attendance.sessionId],
    references: [classSessions.id],
  }),
  student: one(students, {
    fields: [attendance.studentId],
    references: [students.id],
  }),
}))

// ---------- Fee Plans ----------
export const feePlans = pgTable('fee_plans', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull(),
  amount: t.integer('amount').notNull(), // in smallest currency unit (e.g., paisa for INR)
  frequency: t.text({ enum: ['monthly', 'quarterly', 'annual', 'one-time'] }).default('monthly'),
  dojoId: t.integer('dojo_id').references(() => dojos.id, { onDelete: 'set null' }),
  // When set, this plan applies to every dojo below this hierarchy node.
  // Both scopeNodeId and dojoId being null means organization-wide.
  scopeNodeId: t.integer('scope_node_id').references(() => hierarchyNodes.id, { onDelete: 'set null' }),
  description: t.text(),
  isActive: t.integer('is_active').default(1),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// ---------- Student Fee Assignments ----------
export const studentFeeAssignments = pgTable('student_fee_assignments', (t) => ({
  id: t.serial('id').primaryKey(),
  studentId: t.integer('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull(),
  feePlanId: t.integer('fee_plan_id').references(() => feePlans.id, { onDelete: 'cascade' }).notNull(),
  startDate: t.timestamp({ withTimezone: true }).notNull(),
  endDate: t.timestamp({ withTimezone: true }),
  dueDay: t.integer('due_day').default(1), // day of month (1-28)
  discount: t.integer('discount').default(0), // discount amount in same currency unit
  discountReason: t.text('discount_reason'),
  status: t.text({ enum: ['active', 'expired', 'cancelled'] }).default('active'),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// ---------- Payments ----------
export const payments = pgTable('payments', (t) => ({
  id: t.serial('id').primaryKey(),
  studentId: t.integer('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull(),
  assignmentId: t.integer('assignment_id').references(() => studentFeeAssignments.id, { onDelete: 'set null' }),
  amount: t.integer('amount').notNull(),
  discountAmount: t.integer('discount_amount').notNull().default(0),
  paymentDate: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  billingPeriod: t.text('billing_period'), // YYYY-MM start month; coverage range comes from the assigned fee plan
  method: t.text({ enum: ['cash', 'bank_transfer', 'card', 'other'] }).default('cash'),
  referenceNumber: t.text(),
  receiptNumber: t.text().notNull(),
  notes: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// ---------- Relations for Financial Tables ----------
export const feePlansRelations = relations(feePlans, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [feePlans.organizationId],
    references: [organizations.id],
  }),
  dojo: one(dojos, {
    fields: [feePlans.dojoId],
    references: [dojos.id],
  }),
  scopeNode: one(hierarchyNodes, {
    fields: [feePlans.scopeNodeId],
    references: [hierarchyNodes.id],
  }),
  assignments: many(studentFeeAssignments),
}))

export const studentFeeAssignmentsRelations = relations(studentFeeAssignments, ({ one, many }) => ({
  student: one(students, {
    fields: [studentFeeAssignments.studentId],
    references: [students.id],
  }),
  feePlan: one(feePlans, {
    fields: [studentFeeAssignments.feePlanId],
    references: [feePlans.id],
  }),
  payments: many(payments),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  student: one(students, {
    fields: [payments.studentId],
    references: [students.id],
  }),
  assignment: one(studentFeeAssignments, {
    fields: [payments.assignmentId],
    references: [studentFeeAssignments.id],
  }),
}))

// ---------- Documents ----------
export const documents = pgTable('documents', (t) => ({
  id: t.serial('id').primaryKey(),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  studentId: t.integer('student_id').references(() => students.id, { onDelete: 'cascade' }),
  userId: t.integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  documentType: t.text().notNull(), // e.g. 'national_id', 'passport', 'driving_license', 'voter_registration', 'other'
  documentNumber: t.text(),
  fileUrl: t.text().notNull(),
  issuedDate: t.timestamp({ withTimezone: true }),
  expiryDate: t.timestamp({ withTimezone: true }),
  notes: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// ---------- Relations ----------
export const documentsRelations = relations(documents, ({ one }) => ({
  organization: one(organizations, {
    fields: [documents.organizationId],
    references: [organizations.id],
  }),
  student: one(students, {
    fields: [documents.studentId],
    references: [students.id],
  }),
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}))

export const studentPortalAccountsRelations = relations(studentPortalAccounts, ({ one }) => ({
  student: one(students, { fields: [studentPortalAccounts.studentId], references: [students.id] }),
}))

export const studentAchievementsRelations = relations(studentAchievements, ({ one }) => ({
  student: one(students, {
    fields: [studentAchievements.studentId],
    references: [students.id],
  }),
  organization: one(organizations, {
    fields: [studentAchievements.organizationId],
    references: [organizations.id],
  }),
  tournament: one(tournaments, {
    fields: [studentAchievements.tournamentId],
    references: [tournaments.id],
  }),
  createdByUser: one(users, {
    fields: [studentAchievements.createdBy],
    references: [users.id],
  }),
}))

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tournaments.organizationId],
    references: [organizations.id],
  }),
  achievements: many(studentAchievements),
}))

export const governingBodiesRelations = relations(governingBodies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [governingBodies.organizationId],
    references: [organizations.id],
  }),
  affiliations: many(affiliations),
}))

export const affiliationsRelations = relations(affiliations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [affiliations.organizationId],
    references: [organizations.id],
  }),
  governingBody: one(governingBodies, {
    fields: [affiliations.governingBodyId],
    references: [governingBodies.id],
  }),
  expenses: many(expenses),
}))

export const expensesRelations = relations(expenses, ({ one }) => ({
  organization: one(organizations, {
    fields: [expenses.organizationId],
    references: [organizations.id],
  }),
  affiliation: one(affiliations, {
    fields: [expenses.affiliationId],
    references: [affiliations.id],
  }),
  createdByUser: one(users, {
    fields: [expenses.createdBy],
    references: [users.id],
  }),
}))
