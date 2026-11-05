/** Starting points on My Space. Each `content` is TipTap JSON, sent as-is to `createPage`. */

const text = (value: string) => ({ type: 'text', text: value });
const p = (value: string) => ({ type: 'paragraph', content: [text(value)] });
const h = (level: 2 | 3, value: string) => ({ type: 'heading', attrs: { level }, content: [text(value)] });
const li = (value: string) => ({ type: 'listItem', content: [p(value)] });
const bullets = (...items: string[]) => ({ type: 'bulletList', content: items.map(li) });
const tasks = (...items: string[]) => ({
  type: 'taskList',
  content: items.map((value) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(value)] })),
});
const doc = (...content: object[]) => ({ type: 'doc', content });

export interface PageTemplate {
  key: string;
  title: string;
  description: string;
  content: ReturnType<typeof doc>;
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    key: 'client-onboarding',
    title: 'Client onboarding',
    description: 'Everything to collect and set up when a new client signs.',
    content: doc(
      h(2, 'Client details'),
      bullets('Company:', 'Main contact:', 'Email and phone:', 'Start date:'),
      h(2, 'Before kickoff'),
      tasks(
        'Signed contract received',
        'First invoice sent',
        'Project created and team assigned',
        'Access to website, domain and analytics collected',
        'Brand assets collected (logo, fonts, colours)',
      ),
      h(2, 'Kickoff'),
      tasks('Kickoff call booked', 'Goals and success measures agreed', 'Timeline shared with the client', 'Communication channel set up'),
      h(2, 'First two weeks'),
      tasks('First deliverable shared', 'Check-in call held', 'Feedback from the client recorded'),
      h(2, 'Notes'),
      p('Anything the team should know about this client.'),
    ),
  },
  {
    key: 'meeting-notes',
    title: 'Meeting notes',
    description: 'Agenda, decisions and who does what next.',
    content: doc(
      h(2, 'Details'),
      bullets('Date:', 'Attendees:', 'Purpose:'),
      h(2, 'Agenda'),
      bullets('First topic', 'Second topic'),
      h(2, 'Notes'),
      p('What was discussed.'),
      h(2, 'Decisions'),
      bullets('What was decided, and why.'),
      h(2, 'Action items'),
      tasks('Name: what they will do, by when', 'Name: what they will do, by when', 'Share these notes with everyone who attended'),
    ),
  },
  {
    key: 'launch-checklist',
    title: 'Launch checklist',
    description: 'Check the content, the tech and the follow-up before going live.',
    content: doc(
      h(2, 'Content'),
      tasks('Copy proofread on every page', 'Images compressed, with alt text', 'Contact details and legal pages correct', 'Page titles and meta descriptions written'),
      h(2, 'Technical'),
      tasks('Checked on phone, tablet and desktop', 'Forms tested, and messages arrive', 'Broken links checked', 'Analytics and tracking working', 'SSL certificate and domain set up', 'Backup taken'),
      h(2, 'Launch day'),
      tasks('Client has approved', 'Site published', 'Live site checked once more', 'Client and team told it is live'),
      h(2, 'After launch'),
      tasks('Errors and analytics checked after 24 hours', 'Handover notes sent to the client', 'Announcement posted'),
    ),
  },
  {
    key: 'weekly-todo',
    title: 'Weekly to-do',
    description: 'Top priorities and a list for each day of the week.',
    content: doc(
      h(2, 'Top priorities'),
      tasks('Most important thing this week', 'Second priority', 'Third priority'),
      h(2, 'Monday'),
      tasks('Plan the week'),
      h(2, 'Tuesday'),
      tasks('Add a task'),
      h(2, 'Wednesday'),
      tasks('Add a task'),
      h(2, 'Thursday'),
      tasks('Add a task'),
      h(2, 'Friday'),
      tasks('Review the week and move anything unfinished'),
    ),
  },
];
