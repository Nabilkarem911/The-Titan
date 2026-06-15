import { promises as dns } from 'node:dns';

export interface DnsLookupResult {
  domain: string;
  type: string;
  records: unknown[];
}

export async function dnsLookup(params: {
  domain: string;
  type?: 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME' | 'SOA' | 'ALL';
}): Promise<DnsLookupResult> {
  const { domain, type = 'A' } = params;
  if (!domain) throw new Error('domain is required');

  let records: unknown[];

  switch (type) {
    case 'A': {
      const res = await dns.resolve4(domain);
      records = res;
      break;
    }
    case 'AAAA': {
      const res = await dns.resolve6(domain);
      records = res;
      break;
    }
    case 'MX': {
      const res = await dns.resolveMx(domain);
      records = res;
      break;
    }
    case 'TXT': {
      const res = await dns.resolveTxt(domain);
      records = res.map((r) => r.join(''));
      break;
    }
    case 'NS': {
      const res = await dns.resolveNs(domain);
      records = res;
      break;
    }
    case 'CNAME': {
      const res = await dns.resolveCname(domain);
      records = res;
      break;
    }
    case 'SOA': {
      const res = await dns.resolveSoa(domain);
      records = [res];
      break;
    }
    case 'ALL': {
      const [a, mx, ns, txt] = await Promise.allSettled([
        dns.resolve4(domain),
        dns.resolveMx(domain),
        dns.resolveNs(domain),
        dns.resolveTxt(domain),
      ]);
      records = [
        { type: 'A', data: a.status === 'fulfilled' ? a.value : [] },
        { type: 'MX', data: mx.status === 'fulfilled' ? mx.value : [] },
        { type: 'NS', data: ns.status === 'fulfilled' ? ns.value : [] },
        { type: 'TXT', data: txt.status === 'fulfilled' ? txt.value.map((r) => r.join('')) : [] },
      ];
      break;
    }
    default:
      throw new Error(`Unsupported DNS type: ${type}`);
  }

  return { domain, type, records };
}
