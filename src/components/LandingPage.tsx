import React from "react";
import {
  FaCheck,
  FaVideo,
  FaClipboardList,
  FaEnvelope,
  FaCheckCircle,
  FaEnvelopeOpen,
  FaFileAlt,
  FaExclamationTriangle,
} from "react-icons/fa";
import "./LandingPage.css";

const LandingPage: React.FC = () => {
  return (
    <div className="lp">
      {/* Ambient background */}
      <div className="lp-bg" aria-hidden="true">
        <div className="lp-blob lp-blob-a" />
        <div className="lp-blob lp-blob-b" />
        <div className="lp-grid" />
        <div className="lp-noise" />
      </div>

      {/* Top Navigation */}
      <nav className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <div className="lp-logo">
            <span className="lp-logo-mark" aria-hidden="true" />
            <span className="lp-logo-text">Project Manager</span>
          </div>

          <div className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href="#views">Views</a>
            <a href="#notifications">Notifications</a>
            <a href="#security">Security</a>
          </div>

          <div className="lp-nav-actions">
            <a href="/signup" className="lp-btn lp-btn-ghost">
              Request Access
            </a>
            <a href="/login" className="lp-btn lp-btn-primary">
              Log In
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="lp-hero">
        <div className="lp-container lp-hero-inner">
          <div className="lp-hero-content">
            <div className="lp-pill">
              <span className="lp-pill-dot" aria-hidden="true" />
              Built for IRCH workflows • Agency-grade execution
            </div>

            <h1 className="lp-hero-title">
              Manage every client project — from onboarding to launch — in one
              place.
            </h1>

            <p className="lp-hero-subtitle">
              Track stages, assign tasks, monitor revisions, send client emails,
              and keep your entire team aligned — without spreadsheets or chaos.
            </p>

            <div className="lp-hero-cta">
              <a href="/login" className="lp-btn lp-btn-primary lp-btn-lg">
                <FaCheck className="lp-btn-icon" /> Open Dashboard
              </a>
              <button className="lp-btn lp-btn-secondary lp-btn-lg" type="button">
                <FaVideo className="lp-btn-icon" /> Watch 60-sec demo
              </button>
            </div>

            <div className="lp-hero-metrics">
              <div className="lp-metric">
                <div className="lp-metric-value">1</div>
                <div className="lp-metric-label">Source of truth per project</div>
              </div>
              <div className="lp-metric">
                <div className="lp-metric-value">0</div>
                <div className="lp-metric-label">Missed handoffs (with rules)</div>
              </div>
              <div className="lp-metric">
                <div className="lp-metric-value">24/7</div>
                <div className="lp-metric-label">Visibility across stages</div>
              </div>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="lp-hero-visual">
            <div className="lp-frame">
              <div className="lp-frame-top">
                <div className="lp-window-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="lp-frame-title">Project Pipeline</div>
                <div className="lp-frame-chip">Live</div>
              </div>

              <div className="lp-kanban">
                {/* Row 1 */}
                <div className="lp-kanban-row">
                  <div className="lp-col">
                    <div className="lp-col-head">Onboarding</div>

                    <div className="lp-card">
                      <div className="lp-card-top">
                        <span className="lp-client">ICON</span>
                        <span className="lp-priority lp-priority-high">High</span>
                      </div>
                      <div className="lp-card-mid">2 days in stage</div>
                      <div className="lp-card-bottom">
                        <span className="lp-badge">Last emailed: 1 day ago</span>
                      </div>
                    </div>
                  </div>

                  <div className="lp-col">
                    <div className="lp-col-head">Copy</div>

                    <div className="lp-card">
                      <div className="lp-card-top">
                        <span className="lp-client">STAR</span>
                        <span className="lp-priority lp-priority-med">Medium</span>
                      </div>
                      <div className="lp-card-mid">5 days in stage</div>
                      <div className="lp-card-bottom">
                        <span className="lp-badge">Last emailed: 2 days ago</span>
                      </div>
                    </div>
                  </div>

                  <div className="lp-col">
                    <div className="lp-col-head">Copy Revision</div>
                    <div className="lp-empty">—</div>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="lp-kanban-row">
                  <div className="lp-col">
                    <div className="lp-col-head">Design</div>

                    <div className="lp-card">
                      <div className="lp-card-top">
                        <span className="lp-client">Katalyst</span>
                        <span className="lp-priority lp-priority-high">High</span>
                      </div>
                      <div className="lp-card-mid">3 days in stage</div>
                      <div className="lp-card-bottom">
                        <span className="lp-badge lp-badge-hot">
                          Last emailed: Today
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="lp-col">
                    <div className="lp-col-head">Design Revision</div>
                    <div className="lp-empty">—</div>
                  </div>

                  <div className="lp-col">
                    <div className="lp-col-head">Dev</div>
                    <div className="lp-empty">—</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-hero-glow" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="lp-social">
        <div className="lp-container">
          <p className="lp-social-text">
            Built for IRCH workflows. Trusted by teams handling ICON, STAR,
            Katalyst, and private clients.
          </p>
          <div className="lp-badges">
            <div className="lp-badge-pill">IRCH – ICON</div>
            <div className="lp-badge-pill">IRCH – STAR</div>
            <div className="lp-badge-pill">Katalyst</div>
            <div className="lp-badge-pill">Private</div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section id="features" className="lp-section lp-section-muted">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Clarity, speed, and accountability.</h2>
            <p className="lp-sub">
              Everything your PMs need to keep delivery tight — without chasing.
            </p>
          </div>

          <div className="lp-grid-3">
            <div className="lp-feature">
              <div className="lp-feature-icon">
                <FaClipboardList />
              </div>
              <h3>Workflow Clarity</h3>
              <p className="lp-feature-kicker">Stage-based tracking</p>
              <p className="lp-feature-body">
                Move projects smoothly from Copy → Design → Development with clear
                ownership and approvals.
              </p>
            </div>

            <div className="lp-feature">
              <div className="lp-feature-icon">
                <FaEnvelope />
              </div>
              <h3>Client Email Timeline</h3>
              <p className="lp-feature-kicker">Never lose the thread</p>
              <p className="lp-feature-body">
                Automatically logs the last time the client was emailed, what was
                sent, and by who.
              </p>
            </div>

            <div className="lp-feature">
              <div className="lp-feature-icon">
                <FaCheckCircle />
              </div>
              <h3>Revisions & Deliverables</h3>
              <p className="lp-feature-kicker">Revision-proof delivery</p>
              <p className="lp-feature-body">
                Track revision rounds and deliverables (Logo, Brand Book, Landing
                Page, Speaker Kit) without manual checking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Two Views Section */}
      <section id="views" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Kanban for flow. List view for control.</h2>
            <p className="lp-sub">
              Fast execution in boards — precise reporting in lists.
            </p>
          </div>

          <div className="lp-split">
            <div className="lp-panel">
              <div className="lp-panel-head">
                <h3>Kanban View</h3>
                <span className="lp-chip">Operations</span>
              </div>
              <ul className="lp-list">
                <li>
                  <FaCheck className="lp-check" /> Drag & drop stages
                </li>
                <li>
                  <FaCheck className="lp-check" /> Visible bottlenecks
                </li>
                <li>
                  <FaCheck className="lp-check" /> Fast daily standups
                </li>
              </ul>

              <div className="lp-mini">
                <div className="lp-mini-row">
                  <span className="lp-mini-pill">Onboarding</span>
                  <span className="lp-mini-pill">Copy</span>
                  <span className="lp-mini-pill">Design</span>
                  <span className="lp-mini-pill">Dev</span>
                </div>
              </div>
            </div>

            <div className="lp-panel">
              <div className="lp-panel-head">
                <h3>List View</h3>
                <span className="lp-chip">Reporting</span>
              </div>
              <ul className="lp-list">
                <li>
                  <FaCheck className="lp-check" /> Filter by PM
                </li>
                <li>
                  <FaCheck className="lp-check" /> Filter by priority
                </li>
                <li>
                  <FaCheck className="lp-check" /> Sort by “days in stage”
                </li>
                <li>
                  <FaCheck className="lp-check" /> Export monthly close report
                </li>
              </ul>

              <div className="lp-mini">
                <div className="lp-mini-table">
                  <div className="lp-mini-th">Project</div>
                  <div className="lp-mini-th">PM</div>
                  <div className="lp-mini-th">Priority</div>
                  <div className="lp-mini-th">Days</div>

                  <div className="lp-mini-td">ICON</div>
                  <div className="lp-mini-td">Sarah</div>
                  <div className="lp-mini-td">High</div>
                  <div className="lp-mini-td">2</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section id="notifications" className="lp-section lp-section-muted">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Stay updated without chasing people.</h2>
            <p className="lp-sub">
              The system nudges the right person — at the right moment.
            </p>
          </div>

          <div className="lp-grid-3">
            <div className="lp-note">
              <div className="lp-note-icon">
                <FaEnvelopeOpen />
              </div>
              <div className="lp-note-body">
                <h4>Email alerts for:</h4>
                <ul>
                  <li>Task assignments</li>
                  <li>@mentions</li>
                  <li>Client approvals needed</li>
                </ul>
              </div>
            </div>

            <div className="lp-note">
              <div className="lp-note-icon">
                <FaFileAlt />
              </div>
              <div className="lp-note-body">
                <h4>Daily digest (optional)</h4>
                <p>Get a clean summary of updates across projects.</p>
              </div>
            </div>

            <div className="lp-note">
              <div className="lp-note-icon">
                <FaExclamationTriangle />
              </div>
              <div className="lp-note-body">
                <h4>Stuck-stage alerts</h4>
                <p>Know when something needs attention — before it slips.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Project Detail Preview */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Every project has one source of truth.</h2>
            <p className="lp-sub">
              Tabs for execution. Sidebar for status. No guesswork.
            </p>
          </div>

          <div className="lp-mock">
            <div className="lp-mock-tabs">
              <div className="lp-mock-tab is-active">Overview</div>
              <div className="lp-mock-tab">Tasks</div>
              <div className="lp-mock-tab">Deliverables</div>
              <div className="lp-mock-tab">Emails</div>
              <div className="lp-mock-tab">Timeline</div>
            </div>

            <div className="lp-mock-body">
              <div className="lp-mock-main">
                <div className="lp-block">
                  <h4>Project Details</h4>
                  <p>All project context and next actions in one place.</p>
                </div>

                <div className="lp-block lp-block-soft">
                  <div className="lp-row">
                    <span className="lp-dot lp-dot-ok" />
                    <span>Milestones mapped to stages</span>
                  </div>
                  <div className="lp-row">
                    <span className="lp-dot lp-dot-warn" />
                    <span>Overdue tasks highlighted automatically</span>
                  </div>
                  <div className="lp-row">
                    <span className="lp-dot lp-dot-info" />
                    <span>Client comms logged to timeline</span>
                  </div>
                </div>
              </div>

              <aside className="lp-mock-side">
                <div className="lp-side-item">
                  <span className="lp-side-k">Priority</span>
                  <span className="lp-side-v lp-side-v-high">High</span>
                </div>
                <div className="lp-side-item">
                  <span className="lp-side-k">PM</span>
                  <span className="lp-side-v">Sarah Chen</span>
                </div>
                <div className="lp-side-item">
                  <span className="lp-side-k">Stage</span>
                  <span className="lp-side-v">Design</span>
                </div>
                <div className="lp-side-item">
                  <span className="lp-side-k">Days in stage</span>
                  <span className="lp-side-v">3</span>
                </div>
                <div className="lp-side-item">
                  <span className="lp-side-k">Last emailed</span>
                  <span className="lp-side-v">Today</span>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* Project Health Score Section */}
      <section className="lp-section lp-section-muted">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Project Health Score</h2>
            <p className="lp-sub">
              Scores use days in stage, overdue tasks, revision count, and days
              since last client email.
            </p>
          </div>

          <div className="lp-scores">
            <div className="lp-score">
              <div className="lp-score-ring is-excellent">
                <div className="lp-score-num">95</div>
              </div>
              <div className="lp-score-label">Excellent</div>
              <div className="lp-score-name">Katalyst Project</div>
            </div>

            <div className="lp-score">
              <div className="lp-score-ring is-good">
                <div className="lp-score-num">78</div>
              </div>
              <div className="lp-score-label">Good</div>
              <div className="lp-score-name">ICON Project</div>
            </div>

            <div className="lp-score">
              <div className="lp-score-ring is-warning">
                <div className="lp-score-num">62</div>
              </div>
              <div className="lp-score-label">Needs Attention</div>
              <div className="lp-score-name">STAR Project</div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="lp-cta">
        <div className="lp-container lp-cta-inner">
          <h2 className="lp-cta-title">Ready to run projects like a premium agency?</h2>
          <p className="lp-cta-sub">
            Ship faster, reduce revision loops, and keep clients warm — without chaos.
          </p>
          <div className="lp-cta-actions">
            <a href="/signup" className="lp-btn lp-btn-primary lp-btn-lg">
              Go to Dashboard
            </a>
            <a href="/signup" className="lp-btn lp-btn-secondary lp-btn-lg">
              Create New Project
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-left">
            <span>Version 1.0.0</span>
            <span className="lp-sep">•</span>
            <a href="mailto:support@katalystpm.com">Support</a>
            <span className="lp-sep">•</span>
            <a href="#bug">Report a bug</a>
          </div>
          <div className="lp-footer-right">© 2024 Katalyst Project Management</div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;