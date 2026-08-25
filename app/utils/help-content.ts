export type HelpStep = {
  title: string
  summary: string
  details: string[]
  tip?: string
}

export type FaqItem = {
  id: string
  audience: 'Organizations' | 'Students' | 'Accounts & privacy'
  question: string
  answer: string
  links?: Array<{ label: string, to: string }>
}

export type GlossaryItem = {
  term: string
  definition: string
  example?: string
}

export const organizationSteps: HelpStep[] = [
  {
    title: 'Create your organization',
    summary: 'Set up the main workspace that holds your locations, staff, students, and records.',
    details: [
      'Choose Create your organization from the home page and enter the school or association name.',
      'Select the martial art or service you teach. OpenDojos uses this to prepare a sensible starter program and, where supported, a starter belt order.',
      'Add your first dojo location. You can change its address and contact details later.',
      'Finish setup and verify your email address if prompted.'
    ],
    tip: 'An organization is the whole school or association. A dojo is one physical training location inside it.'
  },
  {
    title: 'Review programs and belt ranks',
    summary: 'Describe what students train in and how progress is measured.',
    details: [
      'Open Settings, then Martial arts & programs. A program can be a martial art, course, or service offered to students.',
      'Keep one program when everyone follows the same curriculum. Add more only when students can enrol in genuinely different disciplines or services.',
      'Review the belt system and arrange ranks from beginner to advanced. The order controls valid grading promotions.',
      'When adding a student, enrol them in the appropriate program and select their current rank.'
    ],
    tip: 'A program answers “what does this student train in?” A belt rank answers “where are they in that program?”'
  },
  {
    title: 'Build and publish your syllabus',
    summary: 'Define exactly what candidates must know for each next belt.',
    details: [
      'Open Settings, then Syllabus. Choose the scope and belt you want to configure.',
      'Create sections such as basics, stances, combinations, kata, sparring, fitness, theory, or any category your organization uses.',
      'Add as many custom requirements as needed and decide which items are required. Enable previous-belt inheritance when your grading is cumulative.',
      'Save drafts while editing and publish only when the requirements are ready for student assessment. Existing assigned versions preserve historical progress when a syllabus later changes.',
      'Students with no assessments move to the latest publication automatically. If assessment has started, open the student’s Syllabus tab and choose Move to latest syllabus; matching section and item names keep their progress, while renamed or removed requirements must be assessed again.',
      'Owners and administrators can manage the organization syllabus. Territory and dojo managers can manage a syllabus only for their assigned scope.'
    ],
    tip: 'Start with the smallest useful syllabus. Clear item names are easier for managers to assess and for students to understand.'
  },
  {
    title: 'Set up dojos, schedules, and instructors',
    summary: 'Connect each place, class time, and teacher before recording attendance.',
    details: [
      'Open Dojos & schedules and check the details of the dojo created during setup.',
      'Add a schedule for every recurring class day and time. A schedule is the usual timetable, not an attendance record.',
      'Assign instructors to the locations where they teach.',
      'Create another dojo only for a separate operating location. Each dojo can have its own students, fees, schedules, and staff.'
    ],
    tip: 'Location groups are optional reporting and management areas. Most single-location schools do not need them.'
  },
  {
    title: 'Add students safely',
    summary: 'Create students one at a time or import an existing spreadsheet.',
    details: [
      'For one person, open Students and choose Add student. Add their dojo, program, joining date, and contact information.',
      'For an existing list, choose Import spreadsheet and download or follow the CSV column guide.',
      'Review validation messages before confirming an import. Invalid rows are not silently guessed.',
      'Avoid putting passwords, payment-card information, or unnecessary medical details in notes or spreadsheet uploads.'
    ],
    tip: 'CSV is a simple spreadsheet file. Excel and Google Sheets can both save or download a sheet as CSV.'
  },
  {
    title: 'Invite staff and control access',
    summary: 'Give each person only the workspace access needed for their responsibilities.',
    details: [
      'Open Staff & access and add the person using an email address they control.',
      'Choose an account role for broad workspace permissions, then assign local responsibilities such as instructor or dojo manager where needed.',
      'Check the assigned location or area carefully. Location-scoped staff see only records inside that scope.',
      'Remove or update access promptly when responsibilities change.'
    ],
    tip: 'A role controls what someone can do. A scope controls where they can do it.'
  },
  {
    title: 'Configure fees and record payments',
    summary: 'Define expected tuition, record money received, and issue receipts.',
    details: [
      'Open Fee plans to define recurring tuition for a location. Assign the appropriate plan to students.',
      'Open Payments when money is received. Select the student, billing period, amount, payment date, and payment method.',
      'Add grading or miscellaneous charges separately so the tuition balance remains understandable.',
      'Open Receipts to download a PDF or process a refund. Keep the original payment record for a reliable audit trail.'
    ],
    tip: 'A fee plan is the expected charge. A payment is the money actually received. They are related, but they are not the same record.'
  },
  {
    title: 'Take attendance and track progress',
    summary: 'Turn the timetable into dated class records and keep student progress current.',
    details: [
      'Open Attendance, choose the dojo and scheduled class, and create or open the session for that date.',
      'Mark each listed student present, late, absent, or excused and save the session.',
      'Open a student profile and use Syllabus to mark each published next-belt requirement ready or not ready.',
      'Students with portal access can see the same syllabus organized by section, their completed count, and what remains.'
    ],
    tip: 'A schedule repeats every week. A session is one actual class on one specific date.'
  },
  {
    title: 'Review eligibility and run a grading',
    summary: 'Move only ready candidates into an exam while keeping participation flexible.',
    details: [
      'Open Promotion readiness. Eligibility checks the published next-belt syllabus, recent attendance, pending grading fees, existing open registrations, and the next configured rank.',
      'Show eligible candidates, then choose all students, individual students, one dojo, or several dojos within your permitted scope.',
      'Enter the exam details and choose Create exams & register students. A separate exam is created for each selected dojo so its candidates stay correctly scoped.',
      'Open Grading exams afterward to confirm, withdraw, mark absent or appeared, or otherwise change whether each registered candidate is participating.',
      'After the exam, record payment and result details, mark the candidate as appeared, and award the configured next rank when the requirements are satisfied.'
    ],
    tip: 'Eligibility is rechecked when exams are created, so an old selection cannot bypass current syllabus or attendance requirements.'
  },
  {
    title: 'Use current and archived student reports',
    summary: 'Keep historical records available without exposing them to ordinary staff.',
    details: [
      'Open Students and choose Archived from the status filter to find former students. Archived records stay separate from active grading and payment candidate lists.',
      'Open the student profile to preview or print progress, attendance, achievement, and fee-history PDFs.',
      'Owners and administrators can print reports throughout the organization. Territory and dojo managers can print them only for students inside their assigned scope.',
      'Instructors and ordinary members cannot generate these reports merely because they can access a dojo. Students can still download only their own progress report through their portal.'
    ],
    tip: 'Archive a student when the historical record should remain available; delete only when your organization has a valid reason to remove the record.'
  },
  {
    title: 'Keep the workspace healthy',
    summary: 'Use a short routine to maintain accurate and trustworthy records.',
    details: [
      'Weekly: check attendance, new students, and payments that have been received.',
      'Monthly: review pending fees, expenses, staff access, and key reports.',
      'Before a grading: confirm the published syllabus, review readiness, and update any candidate who is no longer participating.',
      'When something looks wrong, note the page, time, and what you expected before contacting support. Never send a password.'
    ]
  }
]

export const studentSteps: HelpStep[] = [
  {
    title: 'Get access from your school',
    summary: 'Your organization creates your student record and enables portal access.',
    details: [
      'Ask your school or instructor whether student portal access has been enabled for you.',
      'Use the portal address and sign-in details provided by your organization. Each organization has its own workspace.',
      'If you were not given access, contact the school first. OpenDojos support cannot create a student membership without the organization.'
    ],
    tip: 'Your student record and your portal account are connected, but they are different: the record stores training information; the account lets you sign in.'
  },
  {
    title: 'Sign in for the first time',
    summary: 'Use your registered email and the temporary or chosen password.',
    details: [
      'Open the student portal link supplied by your school.',
      'Enter the email address registered on your portal account and your password.',
      'If the school provided a temporary password, change it after signing in.',
      'On a shared device, sign out when you finish and do not ask the browser to save your password.'
    ]
  },
  {
    title: 'Understand your dashboard',
    summary: 'See the training information your organization has chosen to share.',
    details: [
      'Your dashboard summarizes your profile, dojo, program, rank, and recent activity.',
      'Attendance shows dated class records. A missing class may simply not have been recorded yet.',
      'Next grading syllabus shows the requirements published for your next belt, which items are ready, and what you are still working on.',
      'Progress and achievements may also include belt history, grading results, tournaments, certificates, and a downloadable progress report depending on your organization.',
      'Fee information reflects records entered by the organization; contact them if a payment is missing or incorrect.'
    ]
  },
  {
    title: 'Check information and report mistakes',
    summary: 'Keep your contact and training information accurate without exposing sensitive data.',
    details: [
      'Review your name, contact details, dojo, program, and current rank.',
      'If something is wrong, tell your organization exactly which field or dated record needs correction.',
      'Do not send passwords, card numbers, or identity documents through ordinary chat or email.',
      'Only organization staff with suitable access can change official training and payment records.'
    ]
  },
  {
    title: 'Install the student app',
    summary: 'Add the portal to your phone or computer for quicker access.',
    details: [
      'Open the student portal in a supported browser and choose Install Student app when offered.',
      'On iPhone or iPad, use the browser Share menu and choose Add to Home Screen if an install button is not shown.',
      'The installed app is the same secure portal in an app-like window; your organization data remains online.',
      'If you use multiple school accounts, check which account is signed in before relying on the displayed records.'
    ],
    tip: 'PWA means Progressive Web App: a website that can be installed and opened like an app without an app-store download.'
  },
  {
    title: 'Solve common sign-in problems',
    summary: 'Check the simple causes first, then contact the right person.',
    details: [
      'Confirm that you are using the student portal, not the staff sign-in page.',
      'Check the exact email address registered by your organization and make sure Caps Lock is off.',
      'If your account is not enabled or your email is wrong, ask the organization to update it.',
      'For a persistent technical error, send support the page address, approximate time, device/browser, and a screenshot with private information hidden.'
    ]
  }
]

export const faqItems: FaqItem[] = [
  { id: 'what-is-opendojos', audience: 'Organizations', question: 'What is OpenDojos?', answer: 'OpenDojos is a workspace for martial-arts organizations to manage locations, staff, students, schedules, attendance, ranks, custom syllabi, grading exams, fees, expenses, tournaments, and reports. Students can use a separate portal to follow information and next-belt progress their organization makes available.' },
  { id: 'organization-vs-dojo', audience: 'Organizations', question: 'What is the difference between an organization and a dojo?', answer: 'The organization is the complete school, association, or business account. A dojo is one operating or training location inside that organization. A single organization can have one or several dojos.' },
  { id: 'need-location-groups', audience: 'Organizations', question: 'Do I need to create location groups?', answer: 'Usually not. Location groups are optional areas used to organize many dojos for reporting or delegated management. A single dojo, or a small organization that manages every location centrally, can work without them.', links: [{ label: 'Read the organization guide', to: '/help/organizations#set-up-dojos-schedules-and-instructors' }] },
  { id: 'add-students', audience: 'Organizations', question: 'How do I add students?', answer: 'Open Students to add one person manually. To move an existing spreadsheet, use Import spreadsheet and provide a CSV file. Review validation results before confirming the import.', links: [{ label: 'Student setup steps', to: '/help/organizations#add-students-safely' }] },
  { id: 'csv-meaning', audience: 'Organizations', question: 'What is a CSV file?', answer: 'CSV stands for comma-separated values. It is a simple spreadsheet format used to move rows of information between systems. In Excel use Save As; in Google Sheets use File, Download, Comma-separated values.' },
  { id: 'staff-access', audience: 'Organizations', question: 'Can staff see every student and payment?', answer: 'Not necessarily. Access depends on both the person’s role and assigned scope. A location-scoped user sees records only for assigned locations, while sensitive student PDFs are limited to owners, administrators, and responsible territory or dojo managers.' },
  { id: 'fee-plan-payment', audience: 'Organizations', question: 'Why are fee plans and payments separate?', answer: 'A fee plan describes what should be charged, such as monthly tuition. A payment records what was actually received. Keeping them separate makes unpaid balances, partial payments, receipts, and refunds understandable.' },
  { id: 'attendance-schedule', audience: 'Organizations', question: 'Does creating a schedule record attendance?', answer: 'No. A schedule is the repeating timetable. Attendance is saved in a dated class session. Create or open the session for the relevant date, mark students, and save it.' },
  { id: 'custom-syllabus', audience: 'Organizations', question: 'Can each organization or territory use a different belt syllabus?', answer: 'Yes. Owners and administrators can publish an organization syllabus, while assigned territory or dojo managers can publish requirements for their own scope. Each belt can contain custom sections and items, and cumulative syllabi can include requirements inherited from the previous belt. Unassessed students move to a new publication automatically; assessed students can be moved with the controlled update action on their Syllabus tab.' },
  { id: 'promote-student', audience: 'Organizations', question: 'How do I promote a student to the next belt?', answer: 'Publish the next-belt syllabus, assess its required items on the student profile, and open Promotion readiness. Once the student also satisfies attendance, fee, registration, and rank checks, register them for a grading exam, mark them appeared, record the result, and award the next rank.' },
  { id: 'multi-dojo-grading', audience: 'Organizations', question: 'Can I schedule eligible candidates from several dojos together?', answer: 'Yes. Promotion readiness lets you select all eligible students, selected dojos, or individual candidates across your permitted scope. One action creates a correctly scoped exam for each selected dojo and registers its candidates.' },
  { id: 'change-grading-participation', audience: 'Organizations', question: 'Can I change participation after candidates are registered?', answer: 'Yes. Open Grading exams to confirm, withdraw, mark absent, or mark a candidate as appeared. Registration does not force the student to participate, and only appeared candidates can proceed to a recorded result and rank award.' },
  { id: 'archived-student-reports', audience: 'Organizations', question: 'Can authorized staff print reports for archived students?', answer: 'Yes. Find the student with the Archived status filter and open their profile. Owners and administrators can print reports organization-wide; territory and dojo managers can print reports only within their assigned scope. Instructors and ordinary members do not receive student-report access merely from a dojo assignment.' },
  { id: 'correct-payment', audience: 'Organizations', question: 'How should I correct or refund a payment?', answer: 'Use the receipt and refund workflow so the original record remains traceable. Avoid deleting or rewriting historic financial records merely to make a total look right. Contact support if the correction is unusual.' },
  { id: 'student-login', audience: 'Students', question: 'Where do students sign in?', answer: 'Students sign in through the separate student portal for their organization, not the staff workspace. Use the portal link supplied by your school.', links: [{ label: 'Student getting started guide', to: '/help/students' }] },
  { id: 'no-student-account', audience: 'Students', question: 'Why can’t I sign in yet?', answer: 'Having a student record does not always mean portal access is enabled. Ask your organization to confirm that a portal account exists and that the registered email address is correct.' },
  { id: 'missing-attendance', audience: 'Students', question: 'Why is attendance or a payment missing?', answer: 'The organization may not have recorded it yet, or the record may need correction. Tell the school the exact date, class, or payment concerned. Organization staff control official attendance and financial records.' },
  { id: 'change-rank', audience: 'Students', question: 'Can I change my own belt rank or attendance?', answer: 'No. These are official organization records and must be changed by authorized staff. You can review them and ask the organization to correct an error.' },
  { id: 'install-app', audience: 'Students', question: 'Do I need to download an app store application?', answer: 'No. The student portal is a Progressive Web App and can be installed from a supported browser. It can then open from your home screen like an app.', links: [{ label: 'Installation instructions', to: '/help/students#install-the-student-app' }] },
  { id: 'password-safety', audience: 'Accounts & privacy', question: 'Will support ever ask for my password?', answer: 'No. Do not send your password, temporary password, full card number, or security code to OpenDojos support or organization staff. A legitimate support request can be investigated without your password.' },
  { id: 'data-visibility', audience: 'Accounts & privacy', question: 'Who can see student information?', answer: 'Authorized organization users can access information according to their role and assigned scope. Students can access their own portal information when enabled. Organizations should give staff only the access required for their work.' },
  { id: 'contact-support', audience: 'Accounts & privacy', question: 'What should I include when reporting a technical problem?', answer: 'Include your organization name, page address, approximate time, what you tried, what you expected, and the device/browser used. A screenshot can help, but hide private student, payment, and account information first.', links: [{ label: 'Contact support', to: '/contact' }] }
]

export const glossaryItems: GlossaryItem[] = [
  { term: 'Account', definition: 'The sign-in identity belonging to one person.', example: 'A student record can exist before a student portal account is enabled.' },
  { term: 'Affiliation', definition: 'A connection between the organization, dojo, instructor, or student and an outside association or governing body.' },
  { term: 'Archived student', definition: 'A former or inactive student whose historical record remains available but is excluded from active candidate workflows.' },
  { term: 'Attendance session', definition: 'The record of one actual class on a specific date.', example: 'Monday 6 July at 6:00 pm is a session; “Mondays at 6:00 pm” is a schedule.' },
  { term: 'Audit log', definition: 'A history of important actions in the workspace, used to understand who changed something and when.' },
  { term: 'Belt rank', definition: 'A configured stage in a student’s progression, arranged from beginner to advanced.' },
  { term: 'Billing period', definition: 'The time covered by a fee or payment, such as one month or one year.' },
  { term: 'Certificate', definition: 'A document confirming an achievement, rank, or result recorded by the organization.' },
  { term: 'CSV', definition: 'A simple spreadsheet file used to import rows of student information. The letters mean comma-separated values.' },
  { term: 'Dashboard', definition: 'The first summary screen showing the most useful current information and shortcuts.' },
  { term: 'Dojo', definition: 'One physical or operating training location inside an organization.' },
  { term: 'Expense', definition: 'Money spent by the organization, recorded separately from money collected.' },
  { term: 'Fee plan', definition: 'A rule describing the tuition a student is expected to pay.', example: '₹1,000 every month at the Central Dojo.' },
  { term: 'Grading exam', definition: 'A scheduled assessment where selected students attempt to move to a higher configured rank.' },
  { term: 'Grading eligibility', definition: 'The current decision that a student can be registered for their next grading after syllabus, attendance, fee, registration, and rank checks pass.' },
  { term: 'Hierarchy', definition: 'The optional structure used to arrange location groups and dojos.', example: 'State → city → dojo.' },
  { term: 'Instructor', definition: 'A staff responsibility for teaching at one or more assigned dojos.' },
  { term: 'Location group', definition: 'An optional area that groups dojos for reporting or delegated management.', example: 'A city group containing three dojos.' },
  { term: 'Organization', definition: 'The complete school, association, or business workspace containing all its locations and records.' },
  { term: 'Owner', definition: 'The primary organization account with the broadest workspace and subscription responsibilities.' },
  { term: 'Payment', definition: 'A record of money actually received from or for a student.' },
  { term: 'Permission', definition: 'A rule that decides which action an account is allowed to perform.' },
  { term: 'Portal', definition: 'The separate sign-in area where students view information shared by their organization.' },
  { term: 'Program', definition: 'A martial art, course, or service in which a student can enrol.', example: 'Karate and fitness training may be separate programs.' },
  { term: 'Progressive Web App (PWA)', definition: 'A website that can be installed from a browser and opened in an app-like window.' },
  { term: 'Receipt', definition: 'A document generated from a recorded payment.' },
  { term: 'Refund', definition: 'Money returned after a payment, recorded without erasing the original transaction.' },
  { term: 'Role', definition: 'A named set of responsibilities that controls what a person can do.', example: 'Owner, administrator, dojo manager, or instructor.' },
  { term: 'Schedule', definition: 'The repeating day and time when a class normally happens.' },
  { term: 'Scope', definition: 'The organization area or locations in which a staff member’s permissions apply.', example: 'An instructor may be scoped to one dojo.' },
  { term: 'Student record', definition: 'The organization’s stored profile for a student, including training and operational information.' },
  { term: 'Syllabus', definition: 'The organization’s published set of sections and requirements a student must prepare for a configured belt rank.' },
  { term: 'Subscription plan', definition: 'The OpenDojos service level that determines workspace limits and available capabilities.' },
  { term: 'Tenant', definition: 'A technical word for one organization’s isolated workspace. Most users can simply read it as “your organization”.' },
  { term: 'Tournament entry', definition: 'A student’s registration in a tournament event or division.' },
  { term: 'Workspace', definition: 'The private staff area used to manage an organization.' }
]

export function helpSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
