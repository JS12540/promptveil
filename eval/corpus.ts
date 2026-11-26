export type Label = { type: string; action: 'mask' | 'block'; start: number; end: number };
export type Case = { family: string; language: 'en' | 'mixed'; text: string; labels: Label[] };

const contexts = [
  ['Summarize the support handoff. ', ' Verify that the amount remains ₹25,000.'],
  ['Before drafting my reply, check this entry. ', ' Keep the note to one sentence.'],
  ['The audit extract follows. ', ' Summarize the next step without repeating fields.'],
  ['🧪 Build a redacted summary for the training exercise. ', ' Expected total is 2.75%.'],
  ['For the Friday review: ', ' Indicate that the meeting is at 15:30.'],
  ['Review this sample transaction. ', ' Explain why the invoice is pending.'],
  ['Note: test case for the onboarding exercise. ', ' Explain the workflow.'],
  ['Check the following.\n', '\nReturn only your recommendation.'],
  ['Rewrite the body of the message. ', ' Include the subtotal of INR 2,500.'],
  ['Is this entry ready for the sample report? ', ' Flag any missing dates.'],
  ['From our documentation example: ', ' Keep any public amount intact.'],
  ['नई टिप्पणी की समीक्षा करें। ', ' कृपया कुल राशि ₹25,000 रखें।'],
  ['Is example ko short karo. ', ' Sirf summary chahiye.'],
  ['Rephrase this service ticket. ', ' Add steps for follow-up.'],
  ['Use this entry in a toy workflow. ', ' Do not change the ticket priority.'],
  ['Compare with the previous sample. ', ' Exchange rate is 82.3.'],
  ['Find the action in this synthetic note. ', ' Keep the first sentence.'],
  ['Format this mock entry as a compact bullet. ', ' Assume UTC.'],
  ['Repurpose this fictional update. ', ' Explain in plain English.'],
  ['Extract the intent of the following example: ', ' Skip redundant wording.'],
  ['For a classroom exercise, inspect this line: ', ' Clarify the expected output.'],
  ['Review the item from this demo: ', ' Report a high-level category.'],
  ['Give a concise summary for this request. ', ' Units are irrelevant to the request.'],
  ['Please translate the following mock data. ', ' Preserve currency and date format.'],
  ['Prepare sample onboarding notes. ', ' Avoid adding new facts.'],
] as const;

const benign = [
  (n: number) => `Could I invest ₹${25_000 + n} and keep 5% in cash?`,
  (n: number) => `Calculate returns on ${1234567800 + n} rupees over 2 years.`,
  (n: number) => `class CustomerID { static revision = ${n}; }`,
  (n: number) => `Expected output: Account number is optional for public records (test ${n}).`,
  (n: number) => `I earned ${25000 + n} this month. Suggest a budgeting method.`,
  (n: number) => `What are PAN and Aadhaar? Explain the difference in ${n + 2} sentences.`,
  (n: number) => `The variable definition is API_KEY=YOUR_API_KEY (version ${n}).`,
  (n: number) => `Explain UPI and IFSC. Do I need a routing code if the amount is ₹${n + 50}?`,
  (n: number) => `Run a demo with card number 4242 4242 4242 4243 and case number ${n}.`,
  (n: number) => `Here is the delivery timestamp: 2024-02-${String(n + 1).padStart(2, '0')}. Use UTC.`,
] as const;

const identities = [
  { type: 'customer_id', format: (n: number) => ['Customer ID: ', String(72040831 + n)] },
  { type: 'account_id', format: (n: number) => ['Account number is ', String(430128960700 + n)] },
  { type: 'email', format: (n: number) => ['Reply to ', `example+${n}@promptveil.invalid`] },
  { type: 'pan', format: (n: number) => ['PAN fixture: ', `ZZZZZ${4420 + n}Z`] },
  { type: 'aadhaar', format: (n: number) => ['Aadhaar number: ', `9999 0000 ${8400 + n}`] },
  { type: 'phone', format: (n: number) => ['Phone: ', `+1 202-555-${String(100 + n % 100).padStart(4, '0')}`] },
  { type: 'card', format: (_n: number) => ['Card number is ', '4242 4242 4242 4242'] },
  { type: 'upi', format: (n: number) => ['Pay to ', `demo${n}@example`] },
  { type: 'person_name', format: (_n: number) => ['Legal name: "', 'Noor Example', '"'] },
  { type: 'street_address', format: (n: number) => ['Mailing address: "', `${300 + n} Test Lane`, '"'] },
  { type: 'date_of_birth', format: (n: number) => ['DOB: ', `${1980 + n}-02-14`] },
  { type: 'ssn', format: (n: number) => ['SSN: ', `000-12-${4100 + n}`] },
] as const;

const credentials = [
  { type: 'credential', format: (n: number) => ['Password: ', `synthetic-password-case-${n}`] },
  { type: 'private_key', format: (_n: number) => ['Literal marker: ', '-----BEGIN PRIVATE KEY-----'] },
  { type: 'credential', format: (n: number) => ['ACME_PLATFORM_API_KEY="', `fixture-never-valid-${n}`, '"'] },
  { type: 'credential', format: (n: number) => ['Authorization: Bearer ', `fixture-bearer-${n}`] },
] as const;

export const corpus: Case[] = contexts.flatMap(([before, after], index): Case[] => {
  const language: Case['language'] = index === 11 || index === 12 ? 'mixed' : 'en';
  const negatives = benign.map((format, type) => ({
    family: `benign-${type}`, language, text: before + format(index) + after, labels: [],
  }));
  const positives = [...identities, ...credentials].map(({ type, format }, position): Case => {
    const [prefix, value, closing = ''] = format(index);
    const start = before.length + prefix.length;
    return {
      family: `fixture-${type}`, language, text: before + prefix + value + closing + '.' + after,
      labels: [{ type, start, end: start + value.length, action: position < identities.length ? 'mask' : 'block' }],
    };
  });
  return [...negatives, ...positives];
});
