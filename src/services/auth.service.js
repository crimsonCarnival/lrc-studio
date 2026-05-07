import { request } from './api.client.js';
import { gqlRequest } from './graphql.client.js';

export const authService = {
  // ── Kept as REST — involves token issuance, cookies, reCAPTCHA ──
  async register({ username, email, password, recaptchaToken }) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, recaptchaToken }),
    });
  },

  async checkIdentifier(identifier) {
    return request('/auth/check-identifier', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
  },

  async login({ identifier, password, recaptchaToken }) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, recaptchaToken }),
    });
  },

  async refresh(refreshToken) {
    return request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  async submitAppeal(appealText) {
    return request('/auth/appeal', {
      method: 'POST',
      body: JSON.stringify({ appealText }),
    });
  },

  async clearUnbanMessage() {
    return request('/auth/clear-unban-message', { method: 'POST' });
  },

  // ── Migrated to GraphQL ──
  async me() {
    const data = await gqlRequest(`
      query Me {
        me {
          id
          username
          email
          avatarUrl
          bio
          isVerified
          isBanned
          role
          createdAt
          spotify { connected spotifyId isPremium profilePictureUrl }
        }
      }
    `);
    return data.me;
  },

  async updateProfile(input) {
    const data = await gqlRequest(`
      mutation UpdateProfile($input: UpdateProfileInput!) {
        updateProfile(input: $input) {
          id
          username
          email
          avatarUrl
          bio
        }
      }
    `, { input });
    return data.updateProfile;
  },
};
