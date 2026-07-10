// server/database/relations.ts
import { relations } from 'drizzle-orm'
import { organizations, users, hierarchyLevels, hierarchyNodes, dojos } from './schema'

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  hierarchyLevels: many(hierarchyLevels),
  hierarchyNodes: many(hierarchyNodes),
  dojos: many(dojos),
}))

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}))

export const hierarchyLevelsRelations = relations(hierarchyLevels, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [hierarchyLevels.organizationId],
    references: [organizations.id],
  }),
  nodes: many(hierarchyNodes),
}))

export const hierarchyNodesRelations = relations(hierarchyNodes, ({ one, many }) => ({
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
  children: many(hierarchyNodes),
  dojos: many(dojos),
}))

export const dojosRelations = relations(dojos, ({ one }) => ({
  organization: one(organizations, {
    fields: [dojos.organizationId],
    references: [organizations.id],
  }),
  node: one(hierarchyNodes, {
    fields: [dojos.nodeId],
    references: [hierarchyNodes.id],
  }),
}))