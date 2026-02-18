import React from 'react';
import { 
  FaCheck, 
  FaVideo, 
  FaClipboardList, 
  FaEnvelope, 
  FaCheckCircle,
  FaEnvelopeOpen,
  FaFileAlt,
  FaExclamationTriangle
} from 'react-icons/fa';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-container">
          <div className="logo">Project Manager</div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href="#views">Views</a>
            <a href="#notifications">Notifications</a>
            <a href="#security">Security</a>
          </div>
          <div className="nav-buttons">
            <a href="/signup" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>Request Access</a>
            <a href="/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Log In</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-headline">
              Manage every client project — from onboarding to launch — in one place.
            </h1>
            <p className="hero-subheadline">
              Track stages, assign tasks, monitor revisions, send client emails, and keep your entire team aligned — without spreadsheets or chaos.
            </p>
            <div className="hero-buttons">
              <button className="btn-primary btn-large">
                <FaCheck className="btn-icon" /> Open Dashboard
              </button>
              <button className="btn-outline btn-large">
                <FaVideo className="btn-icon" /> Watch 60-sec demo
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="kanban-mockup">
              <div className="kanban-header">
                <h3>Project Pipeline</h3>
              </div>
              <div className="kanban-stages">
                <div className="kanban-column">
                  <div className="column-header">Onboarding</div>
                  <div className="kanban-card">
                    <div className="card-header">
                      <span className="client-name">ICON</span>
                      <span className="priority high">High</span>
                    </div>
                    <div className="card-body">
                      <div className="card-meta">2 days in stage</div>
                      <div className="card-badge">Last emailed: 1 day ago</div>
                    </div>
                  </div>
                </div>
                <div className="kanban-column">
                  <div className="column-header">Copy</div>
                  <div className="kanban-card">
                    <div className="card-header">
                      <span className="client-name">STAR</span>
                      <span className="priority medium">Medium</span>
                    </div>
                    <div className="card-body">
                      <div className="card-meta">5 days in stage</div>
                      <div className="card-badge">Last emailed: 2 days ago</div>
                    </div>
                  </div>
                </div>
                <div className="kanban-column">
                  <div className="column-header">Copy Revision</div>
                </div>
                <div className="kanban-column">
                  <div className="column-header">Design</div>
                  <div className="kanban-card">
                    <div className="card-header">
                      <span className="client-name">Katalyst</span>
                      <span className="priority high">High</span>
                    </div>
                    <div className="card-body">
                      <div className="card-meta">3 days in stage</div>
                      <div className="card-badge">Last emailed: Today</div>
                    </div>
                  </div>
                </div>
                <div className="kanban-column">
                  <div className="column-header">Design Revision</div>
                </div>
                <div className="kanban-column">
                  <div className="column-header">Dev</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="social-proof">
        <div className="container">
          <p className="social-proof-text">
            Built for IRCH workflows. Trusted by teams handling ICON, STAR, Katalyst, and Private clients.
          </p>
          <div className="badges">
            <div className="badge">IRCH – ICON</div>
            <div className="badge">IRCH – STAR</div>
            <div className="badge">Katalyst</div>
            <div className="badge">Private</div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section id="features" className="features">
        <div className="container">
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <FaClipboardList />
              </div>
              <h3>Workflow Clarity</h3>
              <p className="feature-subtitle">Stage-based tracking</p>
              <p className="feature-description">
                Move projects smoothly from Copy → Design → Development with clear ownership and approvals.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FaEnvelope />
              </div>
              <h3>Client Email Timeline</h3>
              <p className="feature-subtitle">Never lose track of communication</p>
              <p className="feature-description">
                Automatically logs the last time the client was emailed, what was sent, and by who.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FaCheckCircle />
              </div>
              <h3>Revisions & Deliverables</h3>
              <p className="feature-subtitle">Revision-proof your process</p>
              <p className="feature-description">
                Track revision rounds and deliverables (Logo, Brand Book, Landing Page, Speaker Kit) without manual checking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Two Views Section */}
      <section id="views" className="two-views">
        <div className="container">
          <h2 className="section-headline">Kanban for flow. List view for control.</h2>
          <div className="views-split">
            <div className="view-card">
              <h3>Kanban View</h3>
              <ul className="feature-list">
                <li><FaCheck className="list-check-icon" /> Drag & drop stages</li>
                <li><FaCheck className="list-check-icon" /> Visible bottlenecks</li>
                <li><FaCheck className="list-check-icon" /> Fast daily standups</li>
              </ul>
              <div className="view-preview kanban-preview">
                <div className="preview-stage">Onboarding → Copy → Design → Dev</div>
              </div>
            </div>
            <div className="view-card">
              <h3>List View</h3>
              <ul className="feature-list">
                <li><FaCheck className="list-check-icon" /> Filter by PM</li>
                <li><FaCheck className="list-check-icon" /> Filter by priority</li>
                <li><FaCheck className="list-check-icon" /> Sort by "days in stage"</li>
                <li><FaCheck className="list-check-icon" /> Export monthly close report</li>
              </ul>
              <div className="view-preview list-preview">
                <div className="preview-row">Project | PM | Priority | Days</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section id="notifications" className="notifications">
        <div className="container">
          <h2 className="section-headline">Stay updated without chasing people.</h2>
          <div className="notifications-content">
            <div className="notification-item">
              <div className="notification-icon">
                <FaEnvelopeOpen />
              </div>
              <div>
                <h4>Email alerts for:</h4>
                <ul>
                  <li>Task assignments</li>
                  <li>@mentions</li>
                  <li>Client approvals needed</li>
                </ul>
              </div>
            </div>
            <div className="notification-item">
              <div className="notification-icon">
                <FaFileAlt />
              </div>
              <div>
                <h4>Daily digest (optional)</h4>
                <p>Get a summary of all project updates</p>
              </div>
            </div>
            <div className="notification-item">
              <div className="notification-icon">
                <FaExclamationTriangle />
              </div>
              <div>
                <h4>Stuck-stage alerts</h4>
                <p>Know when projects need attention</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Project Detail Preview */}
      <section className="project-detail-preview">
        <div className="container">
          <h2 className="section-headline">Every project has one source of truth.</h2>
          <div className="project-detail-mockup">
            <div className="mockup-tabs">
              <div className="tab active">Overview</div>
              <div className="tab">Tasks</div>
              <div className="tab">Deliverables</div>
              <div className="tab">Emails</div>
              <div className="tab">Timeline</div>
            </div>
            <div className="mockup-content">
              <div className="mockup-main">
                <div className="mockup-section">
                  <h4>Project Details</h4>
                  <p>All project information in one place</p>
                </div>
              </div>
              <div className="mockup-sidebar">
                <div className="sidebar-item">
                  <span className="sidebar-label">Priority</span>
                  <span className="sidebar-value high">High</span>
                </div>
                <div className="sidebar-item">
                  <span className="sidebar-label">PM</span>
                  <span className="sidebar-value">Sarah Chen</span>
                </div>
                <div className="sidebar-item">
                  <span className="sidebar-label">Stage</span>
                  <span className="sidebar-value">Design</span>
                </div>
                <div className="sidebar-item">
                  <span className="sidebar-label">Days in stage</span>
                  <span className="sidebar-value">3</span>
                </div>
                <div className="sidebar-item">
                  <span className="sidebar-label">Last emailed</span>
                  <span className="sidebar-value">Today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Project Health Score Section */}
      <section className="health-score">
        <div className="container">
          <h2 className="section-headline">Project Health Score</h2>
          <p className="section-subtitle">
            Each project gets a score based on days in stage, overdue tasks, revision count, and days since last client email.
          </p>
          <div className="health-score-visual">
            <div className="score-card">
              <div className="score-circle excellent">95</div>
              <div className="score-label">Excellent</div>
              <div className="score-project">Katalyst Project</div>
            </div>
            <div className="score-card">
              <div className="score-circle good">78</div>
              <div className="score-label">Good</div>
              <div className="score-project">ICON Project</div>
            </div>
            <div className="score-card">
              <div className="score-circle warning">62</div>
              <div className="score-label">Needs Attention</div>
              <div className="score-project">STAR Project</div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="cta-section">
        <div className="container">
          <h2 className="cta-headline">Ready to run projects like a premium agency?</h2>
          <div className="cta-buttons">
            <a href="/signup" className="btn-primary btn-large" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>Go to Dashboard</a>
            <a href="/signup" className="btn-outline btn-large" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>Create New Project</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-left">
              <span>Version 1.0.0</span>
              <span>•</span>
              <a href="mailto:support@katalystpm.com">Support</a>
              <span>•</span>
              <a href="#bug">Report a bug</a>
            </div>
            <div className="footer-right">
              <span>© 2024 Katalyst Project Management</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

