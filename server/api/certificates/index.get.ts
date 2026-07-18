import { eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { getAccessibleDojoIds } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (!['owner', 'admin'].includes(session.user.role)) throw createError({ statusCode: 403, statusMessage: 'Only organization administrators can view certificates' })

  const organizationId = session.user.organizationId
  const query = getQuery(event)
  const dojoId = Number(query.dojoId) || null
  const hierarchyId = Number(query.hierarchyId) || null
  const type = String(query.type || 'all')
  const search = String(query.search || '').trim().toLowerCase()
  const accessibleDojoIds = await getAccessibleDojoIds(session.user.id, organizationId)
  const nodes = await db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, organizationId) })
  const selectedNodeIds = new Set<number>()
  const addDescendants = (nodeId: number) => {
    selectedNodeIds.add(nodeId)
    nodes.filter(node => node.parentId === nodeId).forEach(node => addDescendants(node.id))
  }
  if (hierarchyId) addDescendants(hierarchyId)

  const [gradings, achievements] = await Promise.all([
    db.query.studentGradings.findMany({ with: { student: { with: { dojo: true } }, beltRank: true } }),
    db.query.studentAchievements.findMany({ where: eq(tables.studentAchievements.organizationId, organizationId), with: { student: { with: { dojo: true } } } })
  ])
  const inScope = (student: { organizationId: number, dojoId: number | null, dojo: { nodeId: number } | null }) => student.organizationId === organizationId
    && (accessibleDojoIds === null || (student.dojoId !== null && accessibleDojoIds.includes(student.dojoId)))
    && (!dojoId || student.dojoId === dojoId)
    && (!hierarchyId || (student.dojo !== null && selectedNodeIds.has(student.dojo.nodeId)))
  const certificates = [
    ...gradings.filter(grading => inScope(grading.student) && (grading.certificateNumber || grading.certificateUrl)).map(grading => ({
      id: `grading-${grading.id}`, type: 'grading', typeLabel: 'Grading certificate', issuedAt: grading.awardedDate, certificateNumber: grading.certificateNumber, certificateUrl: grading.certificateUrl,
      title: grading.beltRank?.name || 'Belt grading', details: grading.examiner ? `Examiner: ${grading.examiner}` : null,
      studentId: grading.student.id, studentName: `${grading.student.firstName} ${grading.student.lastName}`, dojoName: grading.student.dojo?.name || 'Unassigned'
    })),
    ...achievements.filter(achievement => inScope(achievement.student) && achievement.certificateUrl).map(achievement => ({
      id: `achievement-${achievement.id}`, type: 'achievement', typeLabel: 'Tournament certificate', issuedAt: achievement.startDate, certificateNumber: null, certificateUrl: achievement.certificateUrl,
      title: achievement.tournamentName, details: [achievement.eventType, achievement.result || 'Participation', achievement.medalType].filter(Boolean).join(' · '),
      studentId: achievement.student.id, studentName: `${achievement.student.firstName} ${achievement.student.lastName}`, dojoName: achievement.student.dojo?.name || 'Unassigned'
    }))
  ].filter(certificate => (type === 'all' || certificate.type === type) && (!search || `${certificate.studentName} ${certificate.title} ${certificate.certificateNumber || ''} ${certificate.dojoName}`.toLowerCase().includes(search)))
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
  return certificates
})
