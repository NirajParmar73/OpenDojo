import { currentAppSurface } from '../../utils/tenant'

function fingerprints(value: string | undefined) {
  return (value || '').split(',').map(item => item.trim().toUpperCase()).filter(Boolean)
}

export default defineEventHandler(event => {
  const surface = currentAppSurface(event)
  const adminFingerprints = fingerprints(process.env.ANDROID_ADMIN_SHA256_FINGERPRINTS)
  const studentFingerprints = fingerprints(process.env.ANDROID_STUDENT_SHA256_FINGERPRINTS)
  const statements = []
  if (surface !== 'portal' && adminFingerprints.length) {
    statements.push({
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: 'com.opendojos.admin', sha256_cert_fingerprints: adminFingerprints }
    })
  }
  if (surface !== 'staff' && studentFingerprints.length) {
    statements.push({
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: 'com.opendojos.student', sha256_cert_fingerprints: studentFingerprints }
    })
  }
  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
  return statements
})
