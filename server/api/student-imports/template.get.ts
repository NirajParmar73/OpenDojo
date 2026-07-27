import { toCsv } from '../../utils/csv'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename="opendojos-student-import-template.csv"')
  return `\uFEFF${toCsv([
    ['First Name', 'Last Name', 'Email', 'Phone', 'Date of Birth', 'Joined Date', 'Dojo', 'Program', 'Current Belt', 'Fee Plan', 'Status', 'Gender', 'Address', 'City', 'State / Province', 'Country', 'Country Code', 'Postal Code', 'Emergency Contact', 'Emergency Phone', 'Medical Notes', 'Recurring Discount', 'Discount Reason', 'Guardian Name', 'Guardian Relationship', 'Guardian Phone', 'Guardian Email'],
    ['Aarav', 'Sharma', 'aarav@example.com', '9876543210', '2012-05-14', '2024-01-10', 'Main Dojo', 'Junior Karate', 'Yellow Belt', 'Junior Monthly', 'active', 'male', '', 'Ahmedabad', 'Gujarat', 'India', 'IN', '380001', 'Raj Sharma', '9876543211', '', '0', '', 'Raj Sharma', 'Father', '9876543211', 'raj@example.com'],
  ])}`
})
