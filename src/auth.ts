import crypto from "node:crypto";
import type { Response } from "express";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  InvalidGrantError,
  InvalidScopeError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";

const ACCESS_TOKEN_TTL_S = 3600; // 1 hour
const REFRESH_TOKEN_TTL_S = 30 * 24 * 3600; // 30 days
const AUTH_CODE_TTL_S = 600; // 10 minutes

interface AuthCodeRecord {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
  expiresAt: number;
}

interface TokenRecord {
  clientId: string;
  scopes: string[];
  expiresAt: number;
}

const clients = new Map<string, OAuthClientInformationFull>();
const authCodes = new Map<string, AuthCodeRecord>();
const accessTokens = new Map<string, TokenRecord>();
const refreshTokens = new Map<string, TokenRecord>();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateAuthCode(
  params: Omit<AuthCodeRecord, "expiresAt">
): string {
  const code = generateToken();
  authCodes.set(code, {
    ...params,
    expiresAt: Math.floor(Date.now() / 1000) + AUTH_CODE_TTL_S,
  });
  return code;
}

export const clientsStore: OAuthRegisteredClientsStore = {
  async getClient(clientId: string) {
    return clients.get(clientId);
  },
  async registerClient(client: OAuthClientInformationFull) {
    clients.set(client.client_id, client);
    return client;
  },
};

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderAuthFormHtml(opts: {
  serverUrl: string;
  clientName: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string;
  state: string;
  error?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize — Yontrack MCP</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 80px auto; padding: 0 1rem; color: #111; }
    h1 { font-size: 1.4rem; margin-bottom: .5rem; }
    label { display: block; margin: 1.2rem 0 .3rem; font-weight: 600; }
    input[type=password] { width: 100%; padding: .5rem .6rem; box-sizing: border-box; border: 1px solid #bbb; border-radius: 4px; font-size: 1rem; }
    .actions { margin-top: 1.5rem; }
    button { width: 100%; padding: .65rem; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; background: #0066cc; color: #fff; }
    button:hover { background: #0052a3; }
    .error { color: #c00; background: #fff0f0; border: 1px solid #fcc; border-radius: 4px; padding: .5rem .8rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>Authorize Access</h1>
  <p><strong>${escHtml(opts.clientName)}</strong> is requesting access to Yontrack MCP.</p>
  ${opts.error ? `<div class="error">${escHtml(opts.error)}</div>` : ""}
  <form method="POST" action="${escHtml(opts.serverUrl)}/authorize/login">
    <input type="hidden" name="client_id" value="${escHtml(opts.clientId)}">
    <input type="hidden" name="redirect_uri" value="${escHtml(opts.redirectUri)}">
    <input type="hidden" name="code_challenge" value="${escHtml(opts.codeChallenge)}">
    <input type="hidden" name="scopes" value="${escHtml(opts.scopes)}">
    <input type="hidden" name="state" value="${escHtml(opts.state)}">
    <label for="password">Server password</label>
    <input type="password" id="password" name="password" required autofocus>
    <div class="actions">
      <button type="submit">Authorize</button>
    </div>
  </form>
</body>
</html>`;
}

export function createOAuthProvider(serverUrl: string): OAuthServerProvider {
  return {
    get clientsStore() {
      return clientsStore;
    },

    async authorize(
      client: OAuthClientInformationFull,
      params: AuthorizationParams,
      res: Response
    ) {
      const html = renderAuthFormHtml({
        serverUrl,
        clientName: client.client_name ?? client.client_id,
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        scopes: (params.scopes ?? []).join(" "),
        state: params.state ?? "",
      });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
    },

    async challengeForAuthorizationCode(
      client: OAuthClientInformationFull,
      authorizationCode: string
    ) {
      const record = authCodes.get(authorizationCode);
      if (!record || record.clientId !== client.client_id) {
        throw new InvalidGrantError("Invalid authorization code");
      }
      return record.codeChallenge;
    },

    async exchangeAuthorizationCode(
      client: OAuthClientInformationFull,
      authorizationCode: string
    ) {
      const record = authCodes.get(authorizationCode);
      if (!record || record.clientId !== client.client_id) {
        throw new InvalidGrantError("Invalid authorization code");
      }
      if (record.expiresAt < Date.now() / 1000) {
        authCodes.delete(authorizationCode);
        throw new InvalidGrantError("Authorization code has expired");
      }
      authCodes.delete(authorizationCode);

      const now = Math.floor(Date.now() / 1000);
      const accessToken = generateToken();
      const refreshToken = generateToken();

      accessTokens.set(accessToken, {
        clientId: client.client_id,
        scopes: record.scopes,
        expiresAt: now + ACCESS_TOKEN_TTL_S,
      });
      refreshTokens.set(refreshToken, {
        clientId: client.client_id,
        scopes: record.scopes,
        expiresAt: now + REFRESH_TOKEN_TTL_S,
      });

      return {
        access_token: accessToken,
        token_type: "bearer",
        expires_in: ACCESS_TOKEN_TTL_S,
        refresh_token: refreshToken,
        scope: record.scopes.join(" ") || undefined,
      };
    },

    async exchangeRefreshToken(
      client: OAuthClientInformationFull,
      refreshToken: string,
      scopes?: string[]
    ) {
      const record = refreshTokens.get(refreshToken);
      if (!record || record.clientId !== client.client_id) {
        throw new InvalidGrantError("Invalid refresh token");
      }
      if (record.expiresAt < Date.now() / 1000) {
        refreshTokens.delete(refreshToken);
        throw new InvalidGrantError("Refresh token has expired");
      }

      const requestedScopes = scopes?.length ? scopes : record.scopes;
      const invalid = requestedScopes.filter((s) => !record.scopes.includes(s));
      if (invalid.length > 0) {
        throw new InvalidScopeError("Requested scopes exceed original grant");
      }

      refreshTokens.delete(refreshToken);
      const now = Math.floor(Date.now() / 1000);
      const newAccessToken = generateToken();
      const newRefreshToken = generateToken();

      accessTokens.set(newAccessToken, {
        clientId: client.client_id,
        scopes: requestedScopes,
        expiresAt: now + ACCESS_TOKEN_TTL_S,
      });
      refreshTokens.set(newRefreshToken, {
        clientId: client.client_id,
        scopes: requestedScopes,
        expiresAt: now + REFRESH_TOKEN_TTL_S,
      });

      return {
        access_token: newAccessToken,
        token_type: "bearer",
        expires_in: ACCESS_TOKEN_TTL_S,
        refresh_token: newRefreshToken,
        scope: requestedScopes.join(" ") || undefined,
      };
    },

    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const record = accessTokens.get(token);
      if (!record) {
        throw new Error("Invalid access token");
      }
      return {
        token,
        clientId: record.clientId,
        scopes: record.scopes,
        expiresAt: record.expiresAt,
      };
    },

    async revokeToken(
      _client: OAuthClientInformationFull,
      request: OAuthTokenRevocationRequest
    ) {
      accessTokens.delete(request.token);
      refreshTokens.delete(request.token);
    },
  };
}
