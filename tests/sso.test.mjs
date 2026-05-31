// SSO provider-resolution tests. Exercise the pure routing logic
// the login screen uses to decide whether a member signs in with a
// password, an OAuth provider, or SAML.

import test from 'node:test'
import assert from 'node:assert/strict'
import { domainFromEmail, resolveSso, authRoute, isOAuthProvider } from '../lib/sso.ts'
import { ssoConnections } from './fixtures/staff.mjs'

test('domainFromEmail extracts a lower-cased domain', () => {
    assert.equal(domainFromEmail('Ada@Acme.com'), 'acme.com')
    assert.equal(domainFromEmail('  bob@globex.COM '), 'globex.com')
})

test('domainFromEmail rejects malformed addresses', () => {
    assert.equal(domainFromEmail('notanemail'), null)
    assert.equal(domainFromEmail('missing@domain'), null)
    assert.equal(domainFromEmail('@nope.com'), null)
    assert.equal(domainFromEmail(''), null)
})

test('resolveSso matches an active connection by domain', () => {
    const match = resolveSso('ada@acme.com', ssoConnections)
    assert.ok(match)
    assert.equal(match.provider, 'azure')
})

test('resolveSso ignores inactive connections', () => {
    assert.equal(resolveSso('peter@initech.com', ssoConnections), null)
})

test('resolveSso returns null for unknown domains', () => {
    assert.equal(resolveSso('someone@gmail.com', ssoConnections), null)
})

test('authRoute routes OAuth, SAML and password correctly', () => {
    assert.equal(authRoute('ada@acme.com', ssoConnections).kind, 'oauth')
    assert.equal(authRoute('hank@globex.com', ssoConnections).kind, 'saml')
    assert.equal(authRoute('peter@initech.com', ssoConnections).kind, 'password')
    assert.equal(authRoute('someone@gmail.com', ssoConnections).kind, 'password')
})

test('isOAuthProvider distinguishes OAuth from SAML', () => {
    assert.equal(isOAuthProvider('azure'), true)
    assert.equal(isOAuthProvider('google'), true)
    assert.equal(isOAuthProvider('saml'), false)
    assert.equal(isOAuthProvider('nonsense'), false)
})
