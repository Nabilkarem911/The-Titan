export interface SSOConfig {
  provider: 'saml' | 'oidc' | 'oauth2';
  clientId: string;
  clientSecret: string;
  issuer: string;
  redirectUri: string;
  scopes: string[];
}

export interface SSOUser {
  externalId: string;
  email: string;
  name: string;
  groups: string[];
  metadata: Record<string, unknown>;
}

export class SSOProvider {
  private config: SSOConfig;

  constructor(config: SSOConfig) {
    this.config = config;
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      response_type: 'code',
      state,
    });

    return `${this.config.issuer}/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; idToken?: string; refreshToken?: string }> {
    const response = await fetch(`${this.config.issuer}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) throw new Error(`SSO token exchange failed: ${response.status}`);

    const data = await response.json() as Record<string, string>;
    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
    };
  }

  async getUserInfo(accessToken: string): Promise<SSOUser> {
    const response = await fetch(`${this.config.issuer}/userinfo`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error(`SSO userinfo failed: ${response.status}`);

    const data = await response.json() as Record<string, unknown>;
    return {
      externalId: String(data.sub ?? ''),
      email: String(data.email ?? ''),
      name: String(data.name ?? data.preferred_username ?? ''),
      groups: Array.isArray(data.groups) ? data.groups.map(String) : [],
      metadata: data,
    };
  }
}
