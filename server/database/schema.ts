// server/database/schema.ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// ---------- TABLE DEFINITIONS (all tables first) ----------

// Organizations
export const organizations = sqliteTable('organizations', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  name: t.text().notNull(),
  slug: t.text().notNull().unique(),
  logo: t.text(),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Users
export const users = sqliteTable('users', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  name: t.text().notNull(),
  email: t.text().notNull().unique(),
  passwordHash: t.text().notNull(),
  role: t.text().notNull().default('member'),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  avatar: t.text(),
  danDegree: t.text(),
  certificateUrl: t.text(),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Hierarchy Levels
export const hierarchyLevels = sqliteTable('hierarchy_levels', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull(),
  order: t.integer('order').notNull(),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Hierarchy Nodes
export const hierarchyNodes: any = sqliteTable('hierarchy_nodes', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  levelId: t.integer('level_id').references(() => hierarchyLevels.id, { onDelete: 'cascade' }).notNull(),
  parentId: t.integer('parent_id').references(() => hierarchyNodes.id, { onDelete: 'cascade' }),
  name: t.text().notNull(),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Dojos
export const dojos = sqliteTable('dojos', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  nodeId: t.integer('node_id').references(() => hierarchyNodes.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull(),
  address: t.text(),
  phone: t.text(),
  email: t.text(),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Belt Systems
export const beltSystems = sqliteTable('belt_systems', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull().default('Default Belt System'),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Belt Ranks
export const beltRanks = sqliteTable('belt_ranks', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  systemId: t.integer('system_id').references(() => beltSystems.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull(),
  level: t.text().notNull(),
  order: t.integer('order').notNull(),
  type: t.text({ enum: ['kyu', 'dan'] }).notNull(),
  danNumber: t.integer('dan_number'),
  color: t.text(),
  description: t.text(),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Students
export const students = sqliteTable('students', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  organizationId: t.integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  dojoId: t.integer('dojo_id').references(() => dojos.id, { onDelete: 'set null' }),
  firstName: t.text().notNull(),
  lastName: t.text().notNull(),
  email: t.text(),
  phone: t.text(),
  dateOfBirth: t.integer({ mode: 'timestamp_ms' }),
  gender: t.text({ enum: ['male', 'female', 'other'] }),
  address: t.text(),
  emergencyContact: t.text(),
  emergencyPhone: t.text(),
  medicalNotes: t.text(),
  status: t.text().default('active'),
  avatar: t.text(),
  currentBeltRankId: t.integer('current_belt_rank_id').references(() => beltRanks.id),
  joinedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Student Gradings
export const studentGradings = sqliteTable('student_gradings', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  studentId: t.integer('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull(),
  beltRankId: t.integer('belt_rank_id').references(() => beltRanks.id, { onDelete: 'cascade' }).notNull(),
  awardedDate: t.integer({ mode: 'timestamp_ms' }).notNull(),
  examiner: t.text(),
  certificateUrl: t.text(),
  notes: t.text(),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Guardians
export const guardians = sqliteTable('guardians', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  studentId: t.integer('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull(),
  name: t.text().notNull(),
  relationship: t.text().notNull(),
  phone: t.text(),
  email: t.text(),
  address: t.text(),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Assignments
export const assignments = sqliteTable('assignments', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  userId: t.integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: t.text({ enum: ['owner', 'admin', 'state_head', 'district_head', 'city_head', 'dojo_head', 'instructor', 'member'] }).notNull(),
  scopeType: t.text({ enum: ['node', 'dojo'] }).notNull(),
  scopeId: t.integer('scope_id').notNull(),
  startDate: t.integer({ mode: 'timestamp_ms' }),
  endDate: t.integer({ mode: 'timestamp_ms' }),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Dojo Schedules
export const dojoSchedules = sqliteTable('dojo_schedules', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  dojoId: t.integer('dojo_id').references(() => dojos.id, { onDelete: 'cascade' }).notNull(),
  dayOfWeek: t.integer('day_of_week').notNull(),
  startTime: t.text().notNull(),
  endTime: t.text().notNull(),
  name: t.text(),
  instructorId: t.integer('instructor_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Class Sessions
export const classSessions = sqliteTable('class_sessions', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  dojoId: t.integer('dojo_id').references(() => dojos.id, { onDelete: 'cascade' }).notNull(),
  scheduleId: t.integer('schedule_id').references(() => dojoSchedules.id, { onDelete: 'set null' }),
  date: t.integer({ mode: 'timestamp_ms' }).notNull(),
  startTime: t.text().notNull(),
  endTime: t.text().notNull(),
  instructorId: t.integer('instructor_id').references(() => users.id, { onDelete: 'set null' }),
  name: t.text(),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// Attendance
export const attendance = sqliteTable('attendance', (t) => ({
  id: t.integer('id').primaryKey({ autoIncrement: true }),
  sessionId: t.integer('session_id').references(() => classSessions.id, { onDelete: 'cascade' }).notNull(),
  studentId: t.integer('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull(),
  status: t.text({ enum: ['present', 'absent', 'late', 'excused'] }).default('present'),
  notes: t.text(),
  createdAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: t.integer({ mode: 'timestamp_ms' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
}))

// ---------- RELATIONS (all relations after all tables) ----------

export const organizationsRelations = relations(organizations, ({ many }): any => ({
  users: many(users),
  hierarchyLevels: many(hierarchyLevels),
  hierarchyNodes: many(hierarchyNodes),
  dojos: many(dojos),
  students: many(students),
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
  attendance: many(attendance),
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