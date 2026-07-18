import postgres from 'postgres'
import { subscriptionPlans } from '../utils/subscription'

const [organizationIdInput, plan] = process.argv.slice(2)
const organizationId = Number(organizationIdInput)

if (!Number.isInteger(organizationId) || !subscriptionPlans.includes(plan as typeof subscriptionPlans[number])) {
  console.error(`Usage: bun run subscription:set <organization-id> <${subscriptionPlans.join('|')}>`)
  process.exit(1)
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}

const database = postgres(connectionString, { max: 1 })
const result = await database`
  UPDATE organizations
  SET subscription_plan = ${plan},
      subscription_status = ${plan === 'free' ? 'free' : 'active'},
      billing_period = CASE WHEN ${plan} = 'free' THEN NULL ELSE billing_period END,
      subscription_started_at = CASE WHEN ${plan} = 'free' THEN NULL ELSE COALESCE(subscription_started_at, NOW()) END,
      subscription_ends_at = NULL,
      cancel_at_period_end = false,
      updated_at = NOW()
  WHERE id = ${organizationId}
`
await database.end()

if (result.count !== 1) {
  console.error(`Organization ${organizationId} was not found.`)
  process.exit(1)
}

console.log(`Organization ${organizationId} is now on the ${plan} plan.`)
