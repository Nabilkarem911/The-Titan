export async function contractDraft(params: { type: 'nda' | 'freelance' | 'saas' | 'employment' | 'custom'; parties: { partyA: string; partyB: string }; terms?: Record<string, string>; customClauses?: string[] }): Promise<string> {
  const { type, parties, terms = {}, customClauses = [] } = params;
  const date = new Date().toISOString().split('T')[0];

  const templates: Record<string, string> = {
    nda: `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on ${date} by and between:

Party A: ${parties.partyA} ("Disclosing Party")
Party B: ${parties.partyB} ("Receiving Party")

1. DEFINITION OF CONFIDENTIAL INFORMATION
All non-public information shared between the parties, including but not limited to: business plans, technical data, trade secrets, customer lists, and financial information.

2. OBLIGATIONS
The Receiving Party agrees to:
- Keep all Confidential Information strictly confidential
- Use Confidential Information only for the agreed purpose
- Not disclose to third parties without prior written consent
- Return or destroy all materials upon request

3. DURATION
This agreement shall remain in effect for ${terms.duration ?? '2 years'} from the date of signing.

4. EXCLUSIONS
This agreement does not apply to information that:
- Is publicly available
- Was known prior to disclosure
- Is independently developed
- Is required by law to disclose

5. GOVERNING LAW
This agreement shall be governed by the laws of ${terms.jurisdiction ?? 'the agreed jurisdiction'}.`,

    freelance: `FREELANCE SERVICE AGREEMENT

Date: ${date}
Client: ${parties.partyA}
Freelancer: ${parties.partyB}

1. SCOPE OF WORK: ${terms.scope ?? '[To be defined]'}
2. COMPENSATION: ${terms.compensation ?? '[To be agreed]'}
3. TIMELINE: ${terms.timeline ?? '[To be agreed]'}
4. INTELLECTUAL PROPERTY: All work product shall be owned by the Client upon full payment.
5. CONFIDENTIALITY: Both parties agree to maintain confidentiality of project details.
6. TERMINATION: Either party may terminate with ${terms.noticePeriod ?? '14 days'} written notice.
7. LIABILITY: Limited to the total contract value.`,

    saas: `SOFTWARE AS A SERVICE AGREEMENT

Date: ${date}
Provider: ${parties.partyA}
Customer: ${parties.partyB}

1. SERVICE DESCRIPTION: ${terms.service ?? '[Service details]'}
2. SUBSCRIPTION: ${terms.plan ?? 'Monthly'} at ${terms.price ?? '[Price]'}
3. SLA: ${terms.uptime ?? '99.9%'} uptime guarantee
4. DATA PROTECTION: Provider shall handle data in accordance with applicable privacy laws
5. SUPPORT: ${terms.support ?? 'Email support within 24 hours'}
6. TERMINATION: Customer may cancel with 30 days notice
7. LIMITATION OF LIABILITY: Provider liability limited to fees paid in the prior 12 months`,

    employment: `EMPLOYMENT AGREEMENT

Date: ${date}
Employer: ${parties.partyA}
Employee: ${parties.partyB}

1. POSITION: ${terms.position ?? '[Position]'}
2. COMPENSATION: ${terms.salary ?? '[Salary]'} per ${terms.period ?? 'month'}
3. START DATE: ${terms.startDate ?? '[Start date]'}
4. WORKING HOURS: ${terms.hours ?? 'Standard business hours'}
5. BENEFITS: ${terms.benefits ?? 'As per company policy'}
6. PROBATION: ${terms.probation ?? '3 months'}
7. NOTICE PERIOD: ${terms.noticePeriod ?? '30 days'}
8. CONFIDENTIALITY: Employee agrees to maintain confidentiality during and after employment
9. NON-COMPETE: ${terms.nonCompete ?? '6 months post-employment within the same industry'}`,
  };

  let contract = templates[type] ?? `CUSTOM AGREEMENT\n\nDate: ${date}\nParty A: ${parties.partyA}\nParty B: ${parties.partyB}\n\n${terms.body ?? '[Custom terms]'}`;

  if (customClauses.length > 0) {
    contract += '\n\nADDITIONAL CLAUSES:\n' + customClauses.map((c, i) => `${i + 1}. ${c}`).join('\n');
  }

  contract += `\n\n---\nSIGNATURES:\n\n${parties.partyA}: _____________________ Date: _________\n\n${parties.partyB}: _____________________ Date: _________\n\nDISCLAIMER: This is a template for reference purposes only. Consult a qualified legal professional before signing any agreement.`;

  return JSON.stringify({ type, contract, wordCount: contract.split(/\s+/).length, parties });
}
