import { FormBlock } from '../services/client-updates.service';

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const questionBlock = (text: string): FormBlock => ({
  id: makeId('q'),
  type: 'paragraph',
  content: text,
});

const sectionHeading = (title: string): FormBlock => ({
  id: makeId('section'),
  type: 'heading',
  content: title,
});

export const getRapidProspectOnboardingTemplateBlocks = (): FormBlock[] => [
  sectionHeading('SECTION 1 — Business Snapshot'),
  questionBlock('What does your business offer?\n(Briefly describe your main product or service)'),
  questionBlock('What is your primary goal right now?\n(e.g. more leads, more sales, better follow-ups, save time, etc.)'),
  questionBlock('What would success look like in the next 30–60 days?'),

  sectionHeading('SECTION 2 — Your Customers'),
  questionBlock('Who is your ideal customer?\n(Describe the type of people or businesses you want to attract)'),
  questionBlock('What problem are they trying to solve when they come to you?'),
  questionBlock('Why do they choose you over competitors?'),

  sectionHeading('SECTION 3 — Leads & Sales Process'),
  questionBlock('Where do your leads usually come from?\n(Website, ads, referrals, social media, etc.)'),
  questionBlock('What typically happens when someone contacts you?\n(Step-by-step if possible)'),
  questionBlock('How do you usually close a deal?\n(Call, message, email, etc.)'),
  questionBlock('Where do you feel opportunities are being missed right now?'),

  sectionHeading('SECTION 4 — Communication Style (CRITICAL)'),
  questionBlock('How would you describe your tone?\n(Select all that apply in your answer: Formal, Casual, Friendly, Professional)'),
  questionBlock('Do you prefer messages to be:\n(Short and direct / Balanced / Detailed)'),
  questionBlock('Are there any words, phrases, or styles you like to use often?'),
  questionBlock('Are there any words or styles you want us to avoid?'),
  questionBlock('(Optional) Share examples of past messages or emails you like.\n(Paste links/text here, and you can also upload files where prompted.)'),

  sectionHeading('SECTION 5 — Tools & Access'),
  questionBlock('Which platforms are you currently using?\n(Email, CRM, Calendar, Social Media — include details)'),
  questionBlock('How would you prefer to grant access?\n(Add as team member / Temporary login / Share securely later)'),
];
