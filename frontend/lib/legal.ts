// DRAFT legal text. Have a lawyer review it before launch. Values in {{BRACES}} come from lib/appInfo.ts.
export interface LegalSection {
  heading: string;
  body: string[]; // paragraphs; a paragraph starting with "- " is a bullet
}
export interface LegalDoc {
  title: string;
  sections: LegalSection[];
}

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  sections: [
    {
      heading: 'Who we are',
      body: [
        '{{APP_NAME}} is a baby-tracking and parent-support app published by {{OWNER_NAME}} ("we", "us"). This policy explains what information the app collects, why, who can see it, and the choices you have. Last updated: {{POLICY_UPDATED}}.',
        'Questions or requests: {{SUPPORT_EMAIL}}.',
      ],
    },
    {
      heading: 'What we collect',
      body: [
        '- Account: your email address, name, and a password (stored only as a secure hash by our authentication provider). A profile photo if you add one.',
        '- About you: pronouns, your relationship to the baby, whether you are the primary caregiver, and what you want to track.',
        '- About your baby or babies: names, birth date or due date, gender, gestational age at birth and feeding type.',
        '- Activity logs: feedings, diapers, naps and sleep, pumping, milestones and mood notes, with times and any notes you type. Photos you add to a milestone are stored privately and are visible only to the members of your household.',
        '- Wellbeing: daily mood and sleep check-ins, answers and scores from the Edinburgh Postnatal Depression Scale screening, and notes you choose to write.',
        '- Community: posts you write, and your likes, saves, reports, and the members you block.',
        '- Parents near you (optional): a country, city and neighbourhood that you type yourself (we never use GPS or your phone\'s location), and a switch saying whether nearby parents may find you. It is off until you turn it on. Connection requests, the messages you exchange with parents you have accepted, and any reports you send about people.',
        '- Reminders: your reminder settings are stored on your phone only.',
        '- Notifications: if you allow them, an address for your phone (a push token) is stored so we can tell your partner when you log something, and tell you when they do. The message contains the same details that are already shared in your household, for example "Blake logged a feeding for Mia". Wellbeing entries never trigger a notification.',
        '- Offline: when there is no signal, entries you make are kept on your phone until they can be sent. They are removed from the phone once sent, or when you delete your account.',
        'We do not currently use advertising, analytics or cross-app tracking tools, and we do not collect your precise location or contacts.',
      ],
    },
    {
      heading: 'How we use it',
      body: [
        '- To run the app: sign you in, save your logs, show charts, sync between your devices and with your household.',
        '- To send reminders that you turn on (scheduled on your own phone) and notifications about your partner\'s entries (you can switch these off in Settings).',
        '- To keep the community safe, including reviewing posts and people that are reported.',
        '- Parents near you: if you switch it on, other parents who also switched it on can see your name, profile photo, city and neighbourhood, and can send you a request. They never see your babies, logs, wellbeing check-ins, email address or household members. Nobody can message you until you accept their request. Blocking someone ends the connection and deletes the chat for both of you.',
        '- Messages between parents are stored on our servers so they can be delivered. Moderators cannot read your chats; they only see the one message (and your note) that you or someone else chooses to report. Notifications about requests and messages say who wrote, never what they wrote.',
        '- To secure and fix the service.',
        'We do not sell your information, use it for advertising, or use it to build marketing profiles.',
      ],
    },
    {
      heading: 'Who can see your information',
      body: [
        '- Household: if you link with a partner, you both see the shared babies, logs, and each other\'s names. Anyone who has your invite code can join your household, so keep it private. You can leave a household at any time.',
        '- Community: your posts show your name to other signed-in users.',
        '- Wellbeing: your check-ins and screening results are private to you. They are never shown to your partner or other users.',
        '- Moderators can see reported posts and the reasons for the reports.',
        '- Our service providers (below) store and process data for us. Administrators with database access could technically read stored data. We only do so to run, secure or repair the service, or if the law requires.',
      ],
    },
    {
      heading: 'Service providers and where data is stored',
      body: [
        'Your data is stored with Supabase, which provides our database, sign-in and file storage. Our project is hosted in {{DATA_REGION}}. Sign-up and password-reset emails are sent through {{EMAIL_PROVIDER}}. Notifications are delivered through Expo\'s push service and Apple\'s and Google\'s notification systems. Apple and Google distribute the app to your phone. We share information with these providers only as needed to provide the service.',
        'Data is encrypted in transit (HTTPS) and encrypted at rest by our hosting provider. Access to your data is restricted by account-level security rules. No system is perfectly secure, so please use a strong, unique password.',
      ],
    },
    {
      heading: 'How long we keep it, and deleting your account',
      body: [
        'We keep your information while your account is open. You can delete your account in the app at any time (Settings, then Delete my account).',
        'Deleting removes your profile, survey answers, wellbeing check-ins, pumping logs, community posts, likes, saves, profile photo, place, connections, messages and notification address. If a partner is still in your household, the shared baby records stay for them, and the logs you entered are kept under your partner\'s account so their history is not lost. If you are the last member, the household, babies, all their logs and milestone photos are deleted as well.',
        'Deleted data may remain in encrypted backups for up to {{BACKUP_DAYS}} days before it is permanently erased.',
      ],
    },
    {
      heading: 'Your choices and rights',
      body: [
        '- Access and export: Settings, then Download my data, gives you a copy of your information.',
        '- Correct: you can edit your details, babies and logs in the app.',
        '- Delete: see above.',
        'Depending on where you live (for example under Canada\'s PIPEDA, the EU/UK GDPR or California law) you may have additional rights, including to object to or restrict processing and to complain to your local privacy regulator. Contact {{SUPPORT_EMAIL}} and we will respond within a reasonable time.',
      ],
    },
    {
      heading: 'Children',
      body: [
        '{{APP_NAME}} is for parents and caregivers aged 18 or over. Information about a baby is provided by their parent or caregiver. We do not knowingly collect information directly from children.',
      ],
    },
    {
      heading: 'Health information',
      body: [
        'Wellbeing tools and information in the app are for general support only and are not medical advice or a diagnosis. If you are worried about your health or your baby\'s, contact a doctor, midwife or nurse. In an emergency call your local emergency number. In Canada and the US you can call or text 9-8-8 for the Suicide Crisis Helpline.',
      ],
    },
    {
      heading: 'Changes to this policy',
      body: [
        'If we make important changes we will tell you in the app before they take effect. The date at the top shows when this policy was last updated.',
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of Service',
  sections: [
    {
      heading: 'Agreement',
      body: [
        'These terms are between you and {{OWNER_NAME}} ("we", "us") and apply to your use of {{APP_NAME}}. By creating an account or using the app you agree to them and to our Privacy Policy. If you do not agree, please do not use the app. Last updated: {{POLICY_UPDATED}}.',
      ],
    },
    {
      heading: 'Who can use the app',
      body: [
        'You must be at least 18 years old (or the age of majority where you live) and a parent, guardian or caregiver of a baby, or expecting one. You are responsible for the accuracy of the information you enter.',
      ],
    },
    {
      heading: 'Your account and household',
      body: [
        'Keep your password secure and tell us if you think your account has been accessed without permission. If you link with a partner using an invite code, you both can see and change the shared baby records. Only share your code with people you trust, and remember that anyone who has it can join.',
      ],
    },
    {
      heading: 'Not medical advice',
      body: [
        '{{APP_NAME}} helps you keep track of your baby\'s routines and your own wellbeing. It does not provide medical advice, diagnosis or treatment. The postpartum screening is not a diagnosis. Always seek the advice of a qualified health professional about medical questions, and never ignore professional advice or delay seeking it because of something in the app. If you or your baby may be in danger, call your local emergency number.',
      ],
    },
    {
      heading: 'Community rules',
      body: [
        'The community is for mutual support. You agree not to post anything that is harassing, hateful, sexually explicit, misleading, spam, illegal, or that shares someone else\'s private information. Share experiences rather than medical instructions.',
        'You can report any post, and block a member so you no longer see their posts. Our moderators review reports, and we aim to act on harmful content quickly. We may hide or remove content, and suspend or close accounts, that break these rules or that we reasonably think could cause harm.',
        'Parents near you: you must be at least 18 to use this feature. Be respectful in messages, do not ask for or share addresses, and never pressure anyone to meet. Meeting someone in person is your own decision and your own responsibility: choose a public place and tell someone you trust. You can block or report anyone at any time, and we may remove people from this feature if we receive reports about them.',
        'You keep ownership of what you post. You give us a limited licence to store and show it to other users of the app so the community can work.',
      ],
    },
    {
      heading: 'Using the service',
      body: [
        'Do not misuse the app, try to access other people\'s data, interfere with its security, or use it for anything unlawful. We work to keep the app available and accurate, but we do not promise that it will always be uninterrupted or error-free, and features may change.',
      ],
    },
    {
      heading: 'Ending your use',
      body: [
        'You can stop using the app and delete your account at any time in Settings. We may suspend or end accounts that break these terms.',
      ],
    },
    {
      heading: 'Limits of responsibility',
      body: [
        'The app is provided "as is". To the extent the law allows, we are not liable for indirect or consequential losses, or for decisions you make based on the app\'s information. Nothing in these terms limits any rights or liability that cannot be limited by law.',
      ],
    },
    {
      heading: 'Changes, law and contact',
      body: [
        'We may update these terms and will tell you in the app about important changes. These terms are governed by {{GOVERNING_LAW}}. Contact: {{SUPPORT_EMAIL}}.',
      ],
    },
  ],
};

export function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => values[k] ?? `{{${k}}}`);
}
