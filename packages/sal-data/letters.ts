/**
 * Standard letters (Templates & Forms, SAL-OPS-02, L-01 to L-10, and the
 * Appointment Letter F-05), quoted verbatim, with their spelling. Text in
 * [brackets] is filled in before sending; the Nexus offers a field for
 * each one. In F-05, three repeated "[date]" labels are named apart so
 * each can be filled separately, and the brackets nested inside "[For team
 * roles: …]" are shown as (task), (mentor) and (director) so the sentence
 * is one placeholder. The letters exist in English only: an Arabic version
 * is TODO(content) in PROGRESS.md.
 */

export interface Letter {
  readonly code: string;
  readonly key: LetterKey;
  /** Paragraphs; a line starting with "• " is a list item. */
  readonly paragraphs: readonly string[];
  readonly subject: string;
  readonly to: string;
}

export const letterKeys = [
  "l01",
  "l02",
  "l03",
  "l04",
  "f05",
  "l05",
  "l06",
  "l07",
  "l08",
  "l09",
  "l10",
] as const;

export type LetterKey = (typeof letterKeys)[number];

export const letters: Record<LetterKey, Letter> = {
  f05: {
    code: "F-05",
    key: "f05",
    paragraphs: [
      "Dear [name],",
      "I am delighted to offer you the role of [role] in the Society of Arts and Letters, for the rest of the [2026–27] term, ending with the handover on [May 13, 2027].",
      "You will report to [name, role], and the role needs about [hours] a week in term. Your role card is attached; it sets out what the role does, what it decides and what doing well looks like. [For team roles: The first three weeks are your Apprenticeship: (task), with (mentor) as your mentor. At the end, you and (director) will decide together whether to continue.]",
      "Your first steps:",
      "• Reply to accept by [reply-by date]",
      "• Sign the Member Pledge (F-02) and the Conflict of Interest Declaration (F-18)",
      "• Meet [director] for a coffee before [coffee-by date]",
      "• Come to the Council meeting on [Council meeting date] at [time], [room]",
      "Your appointment will be confirmed by the Council on [Council meeting date] and announced on @auibsal. You may step back at any time by telling your director; nobody will think less of you for it.",
      "Thank you for giving your time to the Society. We are lucky to have you.",
      "With best wishes,",
      "[Name]",
      "[Vice President / President], Society of Arts and Letters",
      "Acceptance",
      "I accept the role of ______________________ and agree to the Member Pledge and the Policy Manual.",
      "Signature ______________________   Date ____________",
    ],
    subject: "Appointment Letter",
    to: "[name]",
  },
  l01: {
    code: "L-01",
    key: "l01",
    paragraphs: [
      "Dear Mr. Najm,",
      "On behalf of the Society of Arts and Letters, I am pleased to submit our Constitution, Bylaws and Policy Manual for the Office of Student Life’s review, together with our Roles & Staffing Handbook and Strategic Plan for 2026–2029.",
      "We plan to ratify the Constitution at our Founding General Assembly on Charter Day, Tuesday, October 13, and would be grateful for any changes the Office requires before then. [Our Faculty Advisor is (name) / We are confirming our Faculty Advisor by October 8.]",
      "The documents set out how SAL is governed, how our officers are elected, how we handle money, consent and safety, and how the Society will continue after its founding members graduate. I would welcome a short meeting to walk you through them.",
      "With thanks for your support,",
      "Shaheen Farjo",
      "Founder & President, Society of Arts and Letters",
    ],
    subject: "Society of Arts and Letters: Constitution and registration",
    to: "Ali Najm, Office of Student Life",
  },
  l02: {
    code: "L-02",
    key: "l02",
    paragraphs: [
      "Dear [Dr. name],",
      "I am writing to ask whether you would consider serving as Faculty Advisor to the Society of Arts and Letters for the 2026–27 academic year.",
      "SAL cultivates literature and creative expression at AUIB. This year we are launching a bilingual literary journal, a campus video series and a charity book drive, and we are adopting a Constitution so the Society can outlast its founders.",
      "The role takes about two hours a month: joining one Council meeting a month, signing the approvals the University requires, reviewing our accounts each semester, and being a trusted first contact on sensitive matters. It does not involve directing our creative or editorial choices. The full role description is attached.",
      "We would be honoured to have your guidance, and would be glad to meet at your convenience before October 8.",
      "With warm regards,",
      "Shaheen Farjo",
      "Founder & President",
    ],
    subject: "An invitation to advise the Society of Arts and Letters",
    to: "[Dr. name], [department]",
  },
  l03: {
    code: "L-03",
    key: "l03",
    paragraphs: [
      "Dear members,",
      "On Tuesday, October 13, at [time] in [room], we will hold our Founding General Assembly and adopt the Society’s first Constitution.",
      "Everyone who attends and signs becomes a Founding Member, with their name on the Founders’ Roll, kept in our archive for as long as the Society exists. You will also type your six words on the Society Typewriter.",
      "The draft Constitution is here: [link]. Please read it and bring your questions. Tea will be served.",
      "See you there,",
      "The Society of Arts and Letters",
    ],
    subject: "Charter Day: Tuesday, October 13",
    to: "All SAL members (Telegram and email)",
  },
  l04: {
    code: "L-04",
    key: "l04",
    paragraphs: [
      "The Society of Arts and Letters is looking for people to help run it.",
      "From Sunday, October 18, every role is open: directors for Letters, Programmes & Events and Membership; social media and design leads; event coordinators; the masthead of our new literary journal; the crew of our campus video series; and volunteers for Second Chapter, our charity book fair.",
      "You do not need to be a member, a writer or an artist. You need to be curious and honest about your time. Team roles start with a three-week Apprenticeship, so you can try before you commit.",
      "Director applications close Monday, October 26. Journal masthead applications close Thursday, October 29.",
      "Role cards and the form: [link] · Questions: @auibsal",
      "The Society of Arts and Letters",
    ],
    subject: "Every role. One call. Your name here.",
    to: "All students (Saturday, October 17, 6:00 PM)",
  },
  l05: {
    code: "L-05",
    key: "l05",
    paragraphs: [
      "Dear [name],",
      "Welcome to the Society of Arts and Letters. You are now one of us.",
      "Three things to do this month: join The Common Room on Telegram [link]; come to [next event, date, room] and type your six words on the typewriter; and come to one more activity this semester, which makes you a Voting Member.",
      "Your Member Handbook is attached. [Buddy name] will say hello before your first event. If you have an idea you want to make happen, tell us. That is what we are here for.",
      "See you soon,",
      "[Name], Director of Membership & Community",
    ],
    subject: "Welcome to SAL",
    to: "[name]",
  },
  l06: {
    code: "L-06",
    key: "l06",
    paragraphs: [
      "Dear [name],",
      "Thank you for applying for [role] and for the time you gave the interview. This time, the panel has offered the role to another applicant. It was a close decision.",
      "[What stood out in your application was …] We would love you to be part of SAL, and we think you would be a strong [alternative role]. If you are interested, reply to this email and we will set up the Apprenticeship.",
      "Either way, the next Open Call is in [January], and we hope to see you at [next event].",
      "With thanks,",
      "[Name], Vice President",
    ],
    subject: "Your application for [role]",
    to: "[name]",
  },
  l07: {
    code: "L-07",
    key: "l07",
    paragraphs: [
      "Dear [name],",
      "On behalf of the Society of Arts and Letters, thank you for partnering with us on [programme]. Together we [result: numbers, people reached, money raised].",
      "[One specific thing they did that made a difference.] We have shared the results with our members and the Office of Student Life, and we hope to work with you again [when].",
      "With gratitude,",
      "[Name], President",
    ],
    subject: "Thank you from the Society of Arts and Letters",
    to: "[partner contact]",
  },
  l08: {
    code: "L-08",
    key: "l08",
    paragraphs: [
      "Dear [name],",
      "The Council of the Society of Arts and Letters has voted to invite you to become an Honorary Member of the Society, in recognition of [reason].",
      "Honorary Members are our friends and guests: we hope you will join us at the Majlis, at Charter Night each October, and whenever you wish. We would be delighted to present your certificate at [event].",
      "With respect and thanks,",
      "[Name], President, on behalf of the Council",
    ],
    subject: "Honorary Membership of the Society of Arts and Letters",
    to: "[name]",
  },
  l09: {
    code: "L-09",
    key: "l09",
    paragraphs: [
      "Dear members,",
      "The [opening / Annual / Extraordinary] General Assembly of the Society of Arts and Letters will meet on [date] at [time] in [room] [and online: link].",
      "Agenda: [1. President’s report · 2. Treasurer’s accounts · 3. Programme reports · 4. Motions · 5. Any other business].",
      "Motions must reach the General Secretary by [date, 5 days before], seconded by a Voting Member (Form F-09).",
      "Voting Members may vote in person or online with AUIB sign-in. The quorum is one-fifth of Voting Members or fifteen, whichever is fewer.",
      "[Name], General Secretary",
    ],
    subject: "General Assembly: [date]",
    to: "All members (at least 7 days before; 14 if the Constitution may change)",
  },
  l10: {
    code: "L-10",
    key: "l10",
    paragraphs: [
      "Dear members,",
      "Elections for the Society’s officers will be held this spring. The offices are President, Vice President, General Secretary and Treasurer, for the [2027–28] year.",
      "Nominations: [Sun, Apr 4 – Sun, Apr 11] · The Candidates’ Reading: [Tue, Apr 13] · Voting: [Wed, Apr 14 – Thu, Apr 15], online with AUIB sign-in · Results: [Thu, Apr 15] · AGM and the Ribbon: [Tue, Apr 20].",
      "Every Voting Member on the register today may vote and stand. The nomination form (F-21), eligibility rules and the Elections Code are here: [link].",
      "The Elections Committee: [names]",
    ],
    subject: "SAL elections: nominations open [date]",
    to: "All members",
  },
};

const PLACEHOLDER = /\[([^[\]]+)\]/g;

/** Every [placeholder] in a letter, in order of first appearance. */
export const placeholders = (letter: Letter) => {
  const seen = new Set<string>();
  for (const text of [letter.to, letter.subject, ...letter.paragraphs]) {
    for (const match of text.matchAll(PLACEHOLDER)) {
      seen.add(match[1]);
    }
  }
  return [...seen];
};

/**
 * Splits text into plain parts and placeholders, filled from `values`
 * where given, so the page can mark what is still to fill in.
 */
export const fill = (text: string, values: Record<string, string>) => {
  const parts: { filled: boolean; text: string; placeholder?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ filled: true, text: text.slice(last, index) });
    }
    const value = values[match[1]]?.trim();
    parts.push({
      filled: Boolean(value),
      placeholder: match[1],
      text: value || match[0],
    });
    last = index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ filled: true, text: text.slice(last) });
  }
  return parts;
};

/** The finished letter as plain text, for copying into an email. */
export const letterText = (letter: Letter, values: Record<string, string>) => {
  const join = (text: string) =>
    fill(text, values)
      .map((p) => p.text)
      .join("");
  return [
    `To: ${join(letter.to)}`,
    `Subject: ${join(letter.subject)}`,
    "",
    ...letter.paragraphs.map(join),
  ].join("\n\n");
};
