import React from 'react';
import { FaArrowRight, FaColumns, FaComments, FaEnvelopeOpenText, FaKey, FaMagic, FaUsers } from 'react-icons/fa';
import { authService } from '../services/auth.service';
import './LandingPage.css';

const FEATURES = [
  { icon: <FaColumns />, title: 'Projects and tasks', body: 'Follow every client through a shared pipeline, with clear owners, due dates and approvals.' },
  { icon: <FaUsers />, title: 'Right access, right people', body: 'Project managers and department teams each get a dashboard built around their work.' },
  { icon: <FaEnvelopeOpenText />, title: 'Client updates', body: 'Keep email logs, client forms and project history together, so nothing gets lost.' },
  { icon: <FaComments />, title: 'Live team chat', body: 'Talk in real time and keep each conversation attached to the task it belongs to.' },
  { icon: <FaKey />, title: 'Products and logins', body: 'Keep internal products, documentation and shared logins in one secure place.' },
  { icon: <FaMagic />, title: 'A built-in assistant', body: 'Ask who owns a client or what is overdue, then let it open the page or do the job.' },
];

const STAGES = ['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media', 'CRM', 'SEO/GEO', 'Ready to Close'];

const PREVIEW = [
  { name: 'Copy Writing', cards: [{ client: 'Client project', task: 'Homepage copy' }, { client: 'Client project', task: 'Brand book copy' }] },
  { name: 'Design', cards: [{ client: 'Client project', task: 'Logo concepts' }, { client: 'Client project', task: 'Pitch deck slides' }] },
  { name: 'Development', cards: [{ client: 'Client project', task: 'Homepage build' }, { client: 'Client project', task: 'Landing page fixes' }] },
];

const LandingPage: React.FC = () => {
  const signedIn = authService.isAuthenticated();
  const appLink = signedIn ? '/dashboard' : '/login';

  return (
    <div className="lp">
      <nav className="lp-nav" aria-label="Main">
        <div className="lp-wrap lp-nav-inner">
          <a href="/" className="lp-brand">
            <span className="lp-mark" aria-hidden="true">K</span>
            <span>Katalyst PM</span>
          </a>
          <div className="lp-nav-actions">
            <a href="/rapid-prospect-onboarding" className="lp-nav-link">Onboarding</a>
            <a href={appLink} className="lp-btn small">{signedIn ? 'Dashboard' : 'Log in'}</a>
          </div>
        </div>
      </nav>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap">
            <h1>Every project. Every team.<br />One tool.</h1>
            <p className="lp-hero-sub">Tasks, client updates, team chat and approvals in one place. Built for how Katalyst actually works.</p>
            <div className="lp-actions">
              <a href={appLink} className="lp-btn">Open dashboard <FaArrowRight aria-hidden="true" /></a>
              <a href="#features" className="lp-btn ghost">See what's inside</a>
            </div>

            <div className="lp-preview" role="img" aria-label="Example of the project pipeline, with tasks grouped by department">
              <div className="lp-preview-head">
                Project pipeline
                <span>Example</span>
              </div>
              <div className="lp-columns">
                {PREVIEW.map((column) => (
                  <div className="lp-column" key={column.name}>
                    <h3>{column.name}</h3>
                    {column.cards.map((card, index) => (
                      <div className={`lp-card${index > 0 ? ' lp-card-only-wide' : ''}`} key={card.task}>
                        <small>{card.client}</small>
                        <b>{card.task}</b>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-section-head">
              <h2>Built for real agency work.</h2>
              <p>Fast, client-facing and full of revisions. Everything your team needs to keep work moving.</p>
            </div>
            <ul className="lp-features">
              {FEATURES.map((feature) => (
                <li className="lp-feature" key={feature.title}>
                  <div className="lp-feature-icon" aria-hidden="true">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-wrap">
            <div className="lp-section-head">
              <h2>Onboarding to launch, in one flow.</h2>
              <p>See where everything is, with no spreadsheets and no lost handoffs.</p>
            </div>
            <ul className="lp-stages">
              {STAGES.map((stage) => <li key={stage}>{stage}</li>)}
            </ul>
          </div>
        </section>

        <section className="lp-cta">
          <div className="lp-wrap">
            <h2>Run projects like Katalyst.</h2>
            <div className="lp-actions">
              <a href={appLink} className="lp-btn">Open dashboard <FaArrowRight aria-hidden="true" /></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <span>© {new Date().getFullYear()} Katalyst · Internal platform</span>
          <a href="mailto:support@katalyst-crm.com">Support</a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
