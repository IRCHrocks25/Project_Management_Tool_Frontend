import React, { useMemo, useState } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import './MBTIAssessment.css';

type Dimension = 'EI' | 'SN' | 'TF' | 'JP';

interface Question {
  dim: Dimension;
  dir: 1 | -1;
  text: string;
  label: string;
}

interface Compatibility {
  types: string;
  cat: 'great' | 'good' | 'challenging';
  note: string;
}

interface Profile {
  title: string;
  tagline: string;
  desc: string;
  traits: string[];
  compat: Compatibility[];
}

const QUESTIONS: Question[] = [
  { dim: 'EI', dir: 1, text: 'At a team event, you naturally gravitate toward meeting new people and joining group conversations.', label: 'Extraversion / Introversion' },
  { dim: 'EI', dir: -1, text: 'After a full day of meetings, you need quiet time alone to recharge before you feel like yourself again.', label: 'Extraversion / Introversion' },
  { dim: 'EI', dir: 1, text: 'You tend to think out loud - working through ideas by discussing them with others helps you clarify your thinking.', label: 'Extraversion / Introversion' },
  { dim: 'EI', dir: -1, text: 'You prefer to fully think through a problem before sharing your conclusions with the team.', label: 'Extraversion / Introversion' },
  { dim: 'EI', dir: 1, text: 'You find group brainstorming sessions energising and often leave them with more energy than you started with.', label: 'Extraversion / Introversion' },
  { dim: 'EI', dir: -1, text: 'Working in a quiet environment with few interruptions helps you do your best thinking.', label: 'Extraversion / Introversion' },
  { dim: 'EI', dir: 1, text: 'You enjoy being the one to welcome new team members and help them feel at home.', label: 'Extraversion / Introversion' },
  { dim: 'EI', dir: -1, text: 'You find it draining to spend an entire workday in back-to-back social interactions.', label: 'Extraversion / Introversion' },
  { dim: 'EI', dir: 1, text: 'You feel comfortable speaking up in large group settings, even when you disagree with the majority.', label: 'Extraversion / Introversion' },
  { dim: 'EI', dir: -1, text: 'You prefer one-on-one or small group conversations over large team discussions.', label: 'Extraversion / Introversion' },
  { dim: 'SN', dir: 1, text: 'When learning a new tool or process, you prefer step-by-step instructions over a high-level overview.', label: 'Sensing / Intuition' },
  { dim: 'SN', dir: -1, text: 'You often find yourself thinking about future possibilities rather than focusing on the current situation.', label: 'Sensing / Intuition' },
  { dim: 'SN', dir: 1, text: 'You trust data and direct experience more than theories or hunches when making decisions.', label: 'Sensing / Intuition' },
  { dim: 'SN', dir: -1, text: 'You enjoy exploring the "why" behind a process more than perfecting the execution of it.', label: 'Sensing / Intuition' },
  { dim: 'SN', dir: 1, text: 'You pay close attention to details and notice inconsistencies that others often miss.', label: 'Sensing / Intuition' },
  { dim: 'SN', dir: -1, text: 'You often connect seemingly unrelated ideas and enjoy finding patterns across different areas.', label: 'Sensing / Intuition' },
  { dim: 'SN', dir: 1, text: 'You prefer realistic, proven solutions over experimental or untested approaches.', label: 'Sensing / Intuition' },
  { dim: 'SN', dir: -1, text: 'You are drawn to innovative approaches, even if they involve more uncertainty.', label: 'Sensing / Intuition' },
  { dim: 'SN', dir: 1, text: 'When presenting, you focus on concrete examples and specific facts rather than abstract concepts.', label: 'Sensing / Intuition' },
  { dim: 'SN', dir: -1, text: 'You enjoy thinking about how current work fits into a bigger long-term vision.', label: 'Sensing / Intuition' },
  { dim: 'TF', dir: 1, text: 'When a colleague makes a mistake, your first instinct is to identify what went wrong rather than how they feel.', label: 'Thinking / Feeling' },
  { dim: 'TF', dir: -1, text: 'You naturally consider how a decision will affect the people involved before anything else.', label: 'Thinking / Feeling' },
  { dim: 'TF', dir: 1, text: 'You believe it is more helpful to give someone honest, direct feedback than to soften it to protect their feelings.', label: 'Thinking / Feeling' },
  { dim: 'TF', dir: -1, text: 'You find it important to maintain harmony within your team, even if it means avoiding a difficult conversation.', label: 'Thinking / Feeling' },
  { dim: 'TF', dir: 1, text: 'You evaluate ideas based on their logical merit rather than who proposed them or how enthusiastically.', label: 'Thinking / Feeling' },
  { dim: 'TF', dir: -1, text: 'When a team member is struggling, your first impulse is to offer emotional support rather than practical solutions.', label: 'Thinking / Feeling' },
  { dim: 'TF', dir: 1, text: 'You tend to stay calm and objective when tensions rise in a group discussion.', label: 'Thinking / Feeling' },
  { dim: 'TF', dir: -1, text: 'It genuinely bothers you when decisions are made without considering their impact on team morale.', label: 'Thinking / Feeling' },
  { dim: 'TF', dir: 1, text: 'You prefer to separate your personal feelings from professional decisions.', label: 'Thinking / Feeling' },
  { dim: 'TF', dir: -1, text: 'You are attuned to the emotional atmosphere of a room and adjust your communication style accordingly.', label: 'Thinking / Feeling' },
  { dim: 'JP', dir: 1, text: 'You like to have a clear plan and schedule before starting a major project.', label: 'Judging / Perceiving' },
  { dim: 'JP', dir: -1, text: 'You prefer to keep your options open and adapt your approach as a project evolves.', label: 'Judging / Perceiving' },
  { dim: 'JP', dir: 1, text: 'You feel most comfortable when deadlines are set in advance and met consistently.', label: 'Judging / Perceiving' },
  { dim: 'JP', dir: -1, text: 'You often do your best work under pressure and close to a deadline.', label: 'Judging / Perceiving' },
  { dim: 'JP', dir: 1, text: 'You like to resolve open questions and make decisions as early as possible.', label: 'Judging / Perceiving' },
  { dim: 'JP', dir: -1, text: 'You enjoy keeping multiple options available, even when a decision could be made sooner.', label: 'Judging / Perceiving' },
  { dim: 'JP', dir: 1, text: 'An organized workspace and structured routine help you stay productive and focused.', label: 'Judging / Perceiving' },
  { dim: 'JP', dir: -1, text: 'You thrive in environments that are flexible and change frequently.', label: 'Judging / Perceiving' },
  { dim: 'JP', dir: 1, text: 'When given a task, you prefer to complete it fully before moving on to something else.', label: 'Judging / Perceiving' },
  { dim: 'JP', dir: -1, text: 'You enjoy juggling multiple tasks simultaneously and switching between them as your interest shifts.', label: 'Judging / Perceiving' },
];

const OPTIONS = [
  { val: 2, label: 'Strongly agree', hint: 'Very much like me' },
  { val: 1, label: 'Agree', hint: 'Somewhat like me' },
  { val: 0, label: 'Neutral', hint: 'Neither / unsure' },
  { val: -1, label: 'Disagree', hint: 'Not very like me' },
  { val: -2, label: 'Strongly disagree', hint: 'Not like me at all' },
];

const PROFILES: Record<string, Profile> = {
  INTJ: { title: 'The Architect', tagline: 'Strategic, independent, and driven by long-term vision.', desc: 'INTJs are analytical planners who combine visionary thinking with methodical execution. They excel at identifying inefficiencies and designing elegant solutions. In a team, they often serve as the quiet strategist - thinking several steps ahead and holding high standards for themselves and others. They prefer working autonomously and communicate with precision and directness.', traits: ['Strategic planning', 'Systems thinking', 'High standards', 'Independent work', 'Decisive action', 'Pattern recognition'], compat: [{ types: 'ENFP, ENTP', cat: 'great', note: "Complement the INTJ's structure with creative energy and enthusiasm." }, { types: 'ISTJ, INTP', cat: 'good', note: 'Share a preference for logic and depth - strong intellectual partnerships.' }, { types: 'ESFJ, ESFP', cat: 'challenging', note: "Differences in emotional expression and structure may require extra communication." }] },
  INTP: { title: 'The Thinker', tagline: 'Logical, curious, and endlessly analytical.', desc: 'INTPs are driven by a desire to understand how things work. They thrive on complex problems and enjoy exploring ideas from multiple angles. They are often reserved but highly insightful, bringing depth and precision to their work. In teams, they contribute original thinking and strong analytical capability, though they may need encouragement to share ideas early.', traits: ['Analytical depth', 'Conceptual thinking', 'Problem solving', 'Intellectual curiosity', 'Precision', 'Objective reasoning'], compat: [{ types: 'ENTJ, INTJ', cat: 'great', note: "Shared love of logic and strategy - complement each other's strengths." }, { types: 'INFJ, INFP', cat: 'good', note: "Balance the INTP's logic with empathy and purpose-driven perspective." }, { types: 'ESFJ, ESTJ', cat: 'challenging', note: "Structured and people-focused types may clash with INTP's independence." }] },
  ENTJ: { title: 'The Commander', tagline: 'Bold, decisive, and built to lead.', desc: 'ENTJs are natural leaders who combine strategic vision with a strong drive to achieve. They are direct, confident, and skilled at organizing teams toward ambitious goals. They excel in high-stakes environments where quick decisions matter and thrive when given authority and responsibility. In teams, they often emerge as the person who sets direction and pushes for results.', traits: ['Leadership', 'Strategic thinking', 'Decisiveness', 'Efficiency', 'Goal orientation', 'Confident communication'], compat: [{ types: 'INTP, INFP', cat: 'great', note: "Creative thinkers who offer depth to complement the ENTJ's drive." }, { types: 'ESTJ, ENTJ', cat: 'good', note: 'Shared ambition and structure - strong execution partnerships.' }, { types: 'ISFP, INFP', cat: 'challenging', note: "Sensitive types may find the ENTJ's directness overwhelming." }] },
  ENTP: { title: 'The Debater', tagline: 'Quick-witted, inventive, and always questioning.', desc: 'ENTPs are energized by ideas and debate. They love challenging assumptions, exploring unconventional angles, and generating creative solutions. They bring intellectual spark to any team and excel in brainstorming and early-stage problem-solving. They thrive in dynamic environments and can sometimes lose interest once the initial challenge is resolved.', traits: ['Creative problem solving', 'Debate & persuasion', 'Big-picture thinking', 'Adaptability', 'Intellectual agility', 'Challenging assumptions'], compat: [{ types: 'INFJ, INTJ', cat: 'great', note: "Depth and vision to match ENTP's energy - grounding and inspiring." }, { types: 'ENFP, ENTP', cat: 'good', note: 'Mutual enthusiasm for ideas creates engaging, high-energy collaboration.' }, { types: 'ISFJ, ISTJ', cat: 'challenging', note: "Rule-following and routine-oriented types may clash with ENTP's improvisation." }] },
  INFJ: { title: 'The Advocate', tagline: 'Purposeful, empathetic, and quietly visionary.', desc: 'INFJs combine deep empathy with a clear sense of purpose. They often have a strong inner vision and are motivated by meaning rather than just outcomes. In teams, they serve as a quiet anchor - sensing team dynamics, supporting others, and guiding with integrity. They do their best work when aligned with values they believe in and often go above and beyond for causes they care about.', traits: ['Empathy & insight', 'Vision & purpose', 'Strategic thinking', 'Quiet leadership', 'Integrity', 'Deep listening'], compat: [{ types: 'ENFP, ENTP', cat: 'great', note: 'Energetic and open-minded - help the INFJ externalize their ideas.' }, { types: 'INTJ, INFP', cat: 'good', note: 'Shared depth and values - natural intellectual and emotional resonance.' }, { types: 'ESTP, ESTJ', cat: 'challenging', note: "Fast-moving pragmatists may overlook the INFJ's need for meaning." }] },
  INFP: { title: 'The Mediator', tagline: 'Idealistic, creative, and values-driven.', desc: 'INFPs are motivated by a deep commitment to their personal values and a desire to make a positive impact. They bring creativity, empathy, and authenticity to their work. In teams, they contribute original ideas and a strong moral compass. They thrive in collaborative, supportive environments and may struggle with conflict or environments that feel overly transactional.', traits: ['Creative expression', 'Empathy', 'Values alignment', 'Adaptability', 'Deep listening', 'Authenticity'], compat: [{ types: 'ENFJ, ENTJ', cat: 'great', note: "Goal-oriented types who help the INFP channel ideals into action." }, { types: 'INFJ, INTP', cat: 'good', note: 'Shared depth and openness - comfortable, reflective partnerships.' }, { types: 'ESTJ, ESTP', cat: 'challenging', note: "Highly task-driven types may clash with INFP's values-first approach." }] },
  ENFJ: { title: 'The Protagonist', tagline: 'Inspiring, empathetic, and naturally motivating.', desc: 'ENFJs are natural connectors and motivators. They are warm, articulate, and deeply invested in the growth of the people around them. They lead with empathy and are skilled at building cohesion within teams. They often take on the emotional labor of the group and excel at facilitating conversations and aligning people around shared goals.', traits: ['Team cohesion', 'Empathetic leadership', 'Communication', 'Motivating others', 'Conflict resolution', 'Vision articulation'], compat: [{ types: 'INFP, ISFP', cat: 'great', note: "Creative and sensitive - deeply appreciate the ENFJ's care and direction." }, { types: 'INTJ, INFJ', cat: 'good', note: "Thoughtful depth complements the ENFJ's interpersonal energy." }, { types: 'ISTP, INTP', cat: 'challenging', note: "Reserved and logic-first types may not respond to emotional motivation." }] },
  ENFP: { title: 'The Campaigner', tagline: 'Enthusiastic, imaginative, and people-centred.', desc: 'ENFPs are energetic and creative, driven by possibilities and connection. They bring enthusiasm and fresh ideas to any team, and their genuine warmth makes others feel seen and valued. They excel in brainstorming, client-facing roles, and creative initiatives. They can sometimes struggle with follow-through on long-term detail work, but excel when partnered with structure-oriented teammates.', traits: ['Creative ideation', 'Enthusiasm & energy', 'People connection', 'Adaptability', 'Inspiring communication', 'Openness to change'], compat: [{ types: 'INTJ, INFJ', cat: 'great', note: "Strategic and grounded - help the ENFP turn big ideas into reality." }, { types: 'ENFJ, ENTP', cat: 'good', note: 'Shared passion for people and ideas - high-energy, generative pairings.' }, { types: 'ISTJ, ESTJ', cat: 'challenging', note: "Highly structured types may clash with the ENFP's open-ended style." }] },
  ISTJ: { title: 'The Logistician', tagline: 'Reliable, detailed, and thoroughly dependable.', desc: 'ISTJs are the backbone of any organization - systematic, responsible, and deeply committed to doing things right. They excel at creating order, maintaining standards, and following through on commitments. In teams, they are trusted to handle complex processes and deliver consistent results. They prefer clear expectations and established methods.', traits: ['Reliability', 'Attention to detail', 'Process orientation', 'Accountability', 'Thoroughness', 'Consistency'], compat: [{ types: 'ENFP, ESTP', cat: 'great', note: "Energetic and spontaneous - balance the ISTJ's structure with freshness." }, { types: 'ISTJ, ESTJ', cat: 'good', note: 'Shared love of structure and reliability - highly effective execution teams.' }, { types: 'ENFP, INFP', cat: 'challenging', note: "Values-first and flexible types may frustrate ISTJ's need for clear process." }] },
  ISFJ: { title: 'The Defender', tagline: 'Caring, diligent, and quietly steadfast.', desc: 'ISFJs are warm, meticulous, and deeply committed to supporting the people and systems around them. They are often the unsung heroes of a team - consistently delivering, remembering details others miss, and ensuring everyone feels supported. They thrive in stable, collaborative environments and bring loyalty and practical care to everything they do.', traits: ['Supportiveness', 'Attention to detail', 'Reliability', 'Empathy', 'Memory for detail', 'Quiet dedication'], compat: [{ types: 'ESTP, ESFP', cat: 'great', note: "Bring energy and spontaneity that complement the ISFJ's steadiness." }, { types: 'ISTJ, ISFJ', cat: 'good', note: 'Shared values of reliability and care - comfortable and productive pairings.' }, { types: 'ENTP, ENTJ', cat: 'challenging', note: "Bold and confrontational types may overwhelm the ISFJ's harmony-seeking nature." }] },
  ESTJ: { title: 'The Executive', tagline: 'Organized, decisive, and built for results.', desc: 'ESTJs are efficient, structured, and natural administrators. They excel at organizing people and processes toward measurable outcomes. They lead with confidence, value clear hierarchies, and hold their teams to high standards. In teams, they are the ones who ensure things are on track and that roles are clearly defined.', traits: ['Leadership', 'Organization', 'Execution', 'Standard setting', 'Clear communication', 'Accountability'], compat: [{ types: 'ISFP, INFP', cat: 'great', note: "Creative and people-oriented - soften the ESTJ's directness productively." }, { types: 'ISTJ, ESTJ', cat: 'good', note: 'Shared work ethic and structure - highly efficient operational pairings.' }, { types: 'INTP, INFP', cat: 'challenging', note: "Abstract thinkers may resist the ESTJ's preference for proven methods." }] },
  ESFJ: { title: 'The Consul', tagline: 'Warm, organized, and socially attuned.', desc: 'ESFJs are attentive, loyal, and genuinely invested in the wellbeing of those around them. They excel at creating inclusive, harmonious team environments and are skilled at reading and responding to social dynamics. They bring warmth, organizational skill, and a strong sense of duty to their roles.', traits: ['Team harmony', 'Social awareness', 'Organization', 'Reliability', 'Warmth', 'Practical support'], compat: [{ types: 'ISFP, INFP', cat: 'great', note: "Creative and gentle - natural appreciation for ESFJ's care and warmth." }, { types: 'ESFJ, ISFJ', cat: 'good', note: 'Shared values and social sensitivity - smooth and caring collaboration.' }, { types: 'INTP, ISTP', cat: 'challenging', note: "Logic-first loners may not engage with the ESFJ's people-focused approach." }] },
  ISTP: { title: 'The Virtuoso', tagline: 'Practical, observant, and quietly skilled.', desc: 'ISTPs are calm, resourceful, and action-oriented. They excel at diagnosing problems, learning by doing, and operating effectively under pressure. They are highly adaptable and bring a pragmatic, tool-oriented mindset to their work. They prefer working independently or in small groups and communicate concisely and directly.', traits: ['Practical problem solving', 'Adaptability', 'Calm under pressure', 'Technical skill', 'Efficiency', 'Independence'], compat: [{ types: 'ESFJ, ENFJ', cat: 'great', note: 'Warm and communicative - help ISTP build connections and navigate team dynamics.' }, { types: 'ISTJ, ISTP', cat: 'good', note: 'Shared pragmatism and independence - efficient, low-friction pairings.' }, { types: 'ENFJ, ENFP', cat: 'challenging', note: "Highly expressive types may exhaust the ISTP's preference for quiet efficiency." }] },
  ISFP: { title: 'The Adventurer', tagline: 'Gentle, creative, and deeply present.', desc: 'ISFPs are sensitive, creative, and grounded in the present moment. They bring authenticity and a quiet artistic sensibility to their work. They are observant and empathetic, and often serve as a calming presence in a team. They prefer autonomy and flexible environments and do their best work when they feel trusted and respected.', traits: ['Creativity', 'Empathy', 'Adaptability', 'Hands-on work', 'Authenticity', 'Present-focused'], compat: [{ types: 'ENFJ, ESFJ', cat: 'great', note: 'Warm and organized - provide structure that helps ISFP thrive.' }, { types: 'INFP, ISFJ', cat: 'good', note: 'Shared sensitivity and values - gentle and mutually supportive.' }, { types: 'ENTJ, ESTJ', cat: 'challenging', note: "Highly directive types may conflict with ISFP's need for autonomy." }] },
  ESTP: { title: 'The Entrepreneur', tagline: 'Bold, energetic, and built for action.', desc: 'ESTPs are dynamic, results-oriented individuals who excel in fast-paced, high-stakes environments. They are observant, pragmatic, and natural negotiators. They bring energy and urgency to any team and are at their best when solving real, immediate problems. They are charismatic communicators who can quickly read a room and adapt their approach.', traits: ['Action orientation', 'Persuasion', 'Risk tolerance', 'Adaptability', 'Practical thinking', 'Energetic presence'], compat: [{ types: 'ISFJ, ISTJ', cat: 'great', note: "Provide the structure and follow-through that grounds the ESTP's energy." }, { types: 'ESTJ, ESTP', cat: 'good', note: 'Shared drive and action focus - powerful execution pairings.' }, { types: 'INFJ, INFP', cat: 'challenging', note: "Reflective and values-driven types may struggle to match ESTP's pace." }] },
  ESFP: { title: 'The Entertainer', tagline: 'Spontaneous, energetic, and deeply people-oriented.', desc: 'ESFPs are vibrant, enthusiastic team members who bring joy and energy to any environment. They are warm, observant, and naturally collaborative. They excel in roles that involve direct interaction, creativity, and real-time problem solving. They are at their best in dynamic environments where every day looks different.', traits: ['Enthusiasm', 'People focus', 'Adaptability', 'Collaboration', 'Optimism', 'Creative expression'], compat: [{ types: 'ISTJ, ISFJ', cat: 'great', note: "Stable and reliable - provide grounding that complements ESFP's energy." }, { types: 'ENFP, ESTP', cat: 'good', note: 'Shared energy and openness - lively, action-oriented pairings.' }, { types: 'INTJ, INFJ', cat: 'challenging', note: "Strategic and reserved types may find ESFP's spontaneity disruptive." }] },
};

const dims = [
  { label: 'Mind', key: 'EI', a: 'Extraverted', b: 'Introverted', tot: 20 },
  { label: 'Energy', key: 'SN', a: 'Sensing', b: 'Intuitive', tot: 20 },
  { label: 'Nature', key: 'TF', a: 'Thinking', b: 'Feeling', tot: 20 },
  { label: 'Tactics', key: 'JP', a: 'Judging', b: 'Perceiving', tot: 20 },
] as const;

const pct = (val: number, total: number) =>
  Math.round(Math.min(100, Math.max(0, ((val + total) / (2 * total)) * 100)));

const MBTIAssessment: React.FC = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<'intro' | 'question' | 'result'>('intro');
  const [name, setName] = useState('');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const question = QUESTIONS[current];
  const currentAnswer = answers[current];

  const scores = useMemo(() => {
    const out = { EI: 0, SN: 0, TF: 0, JP: 0 };
    QUESTIONS.forEach((q, i) => {
      if (answers[i] !== undefined) out[q.dim] += q.dir * answers[i];
    });
    return out;
  }, [answers]);

  const code = useMemo(() => {
    const from = (v: number, a: string, b: string) => (v >= 0 ? a : b);
    return `${from(scores.EI, 'E', 'I')}${from(scores.SN, 'S', 'N')}${from(scores.TF, 'T', 'F')}${from(scores.JP, 'J', 'P')}`;
  }, [scores]);

  const profile = PROFILES[code] || PROFILES.INFP;

  const selectAnswer = (value: number) => {
    setAnswers((prev) => ({ ...prev, [current]: value }));
  };

  const start = () => {
    setCurrent(0);
    setAnswers({});
    setScreen('question');
  };

  const next = () => {
    if (answers[current] === undefined) return;
    if (current === QUESTIONS.length - 1) {
      setScreen('result');
      return;
    }
    setCurrent((c) => c + 1);
  };

  const prev = () => setCurrent((c) => Math.max(0, c - 1));

  const restart = () => {
    setName('');
    setCurrent(0);
    setAnswers({});
    setScreen('intro');
  };

  const exportResult = () => {
    const lines = [
      'MBTI EMPLOYEE ASSESSMENT RESULT',
      '================================',
      name ? `Name: ${name}` : '',
      `Type: ${code} - ${profile.title}`,
      profile.tagline,
      '',
      'DIMENSION SCORES',
      '-----------------',
      `Mind:    ${scores.EI >= 0 ? 'Extraverted' : 'Introverted'} (${pct(Math.abs(scores.EI), 20)}%)`,
      `Energy:  ${scores.SN >= 0 ? 'Sensing' : 'Intuitive'} (${pct(Math.abs(scores.SN), 20)}%)`,
      `Nature:  ${scores.TF >= 0 ? 'Thinking' : 'Feeling'} (${pct(Math.abs(scores.TF), 20)}%)`,
      `Tactics: ${scores.JP >= 0 ? 'Judging' : 'Perceiving'} (${pct(Math.abs(scores.JP), 20)}%)`,
      '',
      'ABOUT THIS TYPE',
      '----------------',
      profile.desc,
      '',
      'KEY STRENGTHS',
      '--------------',
      profile.traits.join(', '),
      '',
      'TEAM COMPATIBILITY',
      '-------------------',
      ...profile.compat.map((c) => `${c.types} (${c.cat}): ${c.note}`),
      '',
      `Assessment completed: ${new Date().toLocaleDateString()}`,
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(name || 'employee').replace(/\s+/g, '_')}_mbti_result.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyResult = async () => {
    const text = [
      `${name ? `${name}'s ` : ''}MBTI Result: ${code} - ${profile.title}`,
      profile.tagline,
      '',
      `Mind: ${scores.EI >= 0 ? 'Extraverted' : 'Introverted'} | Energy: ${scores.SN >= 0 ? 'Sensing' : 'Intuitive'} | Nature: ${scores.TF >= 0 ? 'Thinking' : 'Feeling'} | Tactics: ${scores.JP >= 0 ? 'Judging' : 'Perceiving'}`,
      '',
      `Strengths: ${profile.traits.join(', ')}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="mbti-page">
      <div className="mbti-wrap">
        <div className="mbti-top">
          <button className="mbti-back" onClick={() => navigate('/profile')}>
            <FaArrowLeft /> Back to Profile
          </button>
        </div>

        {screen === 'intro' && (
          <div className="mbti-screen">
            <div className="mbti-brand"><div className="mbti-brand-dot" /><span className="mbti-brand-label">Employee Assessment</span></div>
            <h1 className="mbti-hero-title">Myers-Briggs Type Indicator Assessment</h1>
            <p className="mbti-hero-sub">40 questions across four dimensions to identify your personality type. Takes approximately 8-10 minutes. Answer honestly - there are no right or wrong answers.</p>
            <div className="mbti-pillars">
              <div className="mbti-pillar"><div className="mbti-pillar-row"><span className="mbti-pillar-dim">Mind</span><span className="mbti-pillar-pair">E / I</span></div><div className="mbti-pillar-bar"><div className="mbti-pillar-fill" /></div></div>
              <div className="mbti-pillar"><div className="mbti-pillar-row"><span className="mbti-pillar-dim">Energy</span><span className="mbti-pillar-pair">S / N</span></div><div className="mbti-pillar-bar"><div className="mbti-pillar-fill" /></div></div>
              <div className="mbti-pillar"><div className="mbti-pillar-row"><span className="mbti-pillar-dim">Nature</span><span className="mbti-pillar-pair">T / F</span></div><div className="mbti-pillar-bar"><div className="mbti-pillar-fill" /></div></div>
              <div className="mbti-pillar"><div className="mbti-pillar-row"><span className="mbti-pillar-dim">Tactics</span><span className="mbti-pillar-pair">J / P</span></div><div className="mbti-pillar-bar"><div className="mbti-pillar-fill" /></div></div>
            </div>
            <div className="mbti-name-wrap">
              <label className="mbti-name-label" htmlFor="mbti-name">Your name (optional)</label>
              <input id="mbti-name" className="mbti-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Santos" />
            </div>
            <button className="mbti-btn-primary" onClick={start}>Begin assessment</button>
          </div>
        )}

        {screen === 'question' && (
          <div className="mbti-screen">
            <div className="mbti-brand"><div className="mbti-brand-dot" /><span className="mbti-brand-label">Employee Assessment</span></div>
            <div className="mbti-q-meta">
              <span>Question {current + 1} of {QUESTIONS.length}</span>
              <span className="mbti-q-badge">{question.label}</span>
            </div>
            <div className="mbti-progress-track">
              <div className="mbti-progress-fill" style={{ width: `${(current / QUESTIONS.length) * 100}%` }} />
            </div>
            <p className="mbti-q-text">{question.text}</p>
            <div className="mbti-scale-wrap">
              {OPTIONS.map((opt) => (
                <button key={opt.val} className={`mbti-scale-opt ${currentAnswer === opt.val ? 'selected' : ''}`} onClick={() => selectAnswer(opt.val)}>
                  <span className="mbti-scale-dot" />
                  <span className="mbti-scale-label">{opt.label}</span>
                  <span className="mbti-scale-hint">{opt.hint}</span>
                </button>
              ))}
            </div>
            <div className="mbti-nav">
              <div>{current > 0 && <button className="mbti-btn-outline" onClick={prev}>Back</button>}</div>
              <button className="mbti-btn-primary" onClick={next} disabled={currentAnswer === undefined}>
                {current === QUESTIONS.length - 1 ? 'See results' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {screen === 'result' && (
          <div className="mbti-screen">
            <div className="mbti-brand"><div className="mbti-brand-dot" /><span className="mbti-brand-label">Employee Assessment - Results</span></div>
            <div className="mbti-result-header">
              <div className="mbti-result-name">{name ? `${name}'s result` : 'Your result'}</div>
              <div className="mbti-code">{code}</div>
              <div className="mbti-title">{profile.title}</div>
              <div className="mbti-tagline">{profile.tagline}</div>
            </div>
            <div className="mbti-scores-grid">
              {dims.map((d) => {
                const value = scores[d.key];
                const positive = value >= 0;
                const letter = positive ? d.a : d.b;
                const strength = pct(Math.abs(value), d.tot);
                return (
                  <div className="mbti-score-card" key={d.key}>
                    <div className="mbti-score-dim">{d.label}</div>
                    <div className="mbti-score-row"><span>{letter}</span><span>{strength}%</span></div>
                    <div className="mbti-score-track"><div className="mbti-score-fill" style={{ width: `${strength}%` }} /></div>
                  </div>
                );
              })}
            </div>
            <h3 className="mbti-section-title">About this type</h3>
            <p className="mbti-desc">{profile.desc}</p>
            <h3 className="mbti-section-title">Key strengths</h3>
            <div className="mbti-traits-grid">
              {profile.traits.map((t) => <span className="mbti-trait-pill" key={t}>{t}</span>)}
            </div>
            <h3 className="mbti-section-title">Team compatibility</h3>
            <div className="mbti-compat-grid">
              {profile.compat.map((c) => (
                <div className={`mbti-compat-card ${c.cat}`} key={`${c.types}-${c.cat}`}>
                  <div className="mbti-compat-head">
                    <span>{c.types}</span>
                    <span className={`mbti-compat-badge ${c.cat}`}>{c.cat === 'great' ? 'Great match' : c.cat === 'good' ? 'Good match' : 'Needs care'}</span>
                  </div>
                  <div className="mbti-compat-note">{c.note}</div>
                </div>
              ))}
            </div>
            <div className="mbti-actions">
              <button className="mbti-btn-primary" onClick={exportResult}>Download summary</button>
              <button className="mbti-btn-outline" onClick={copyResult}>Copy to clipboard</button>
              <button className="mbti-btn-outline" onClick={restart}>Retake assessment</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MBTIAssessment;
