import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { apiClient } from '../../../shared/api/client'
import { checkCorporationNumber, submitProfile } from './onboardingApi'

const number = '826417395'
const values = { firstName: 'Jane', lastName: 'Smith', corporationNumber: number, phone: '+13062776103' }
const originalAdapter = apiClient.defaults.adapter
const transport = vi.fn<AxiosAdapter>()

function respond(status: number, data: unknown) {
  transport.mockImplementationOnce(async (config) => {
    const response: AxiosResponse<unknown> = { status, data, statusText: '', headers: new AxiosHeaders(), config }
    if (config.validateStatus && !config.validateStatus(status)) {
      throw new AxiosError('HTTP error', 'ERR_BAD_RESPONSE', config, undefined, response)
    }
    return response
  })
}

beforeEach(() => {
  transport.mockReset()
  apiClient.defaults.adapter = transport
})

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

test('GET uses the configured base URL, path, timeout and cancellation signal', async () => {
  const controller = new AbortController()
  respond(200, { valid: true, corporationNumber: number })
  await expect(checkCorporationNumber(number, controller.signal)).resolves.toEqual({ valid: true, corporationNumber: number })
  expect(transport).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    baseURL: 'https://fe-hometask-api.qa.vault.tryvault.com',
    url: `/corporation-number/${number}`,
    method: 'get',
    timeout: 10_000,
    signal: controller.signal,
  }))
})

test.each([200, 404])('accepts definitive business invalidity on HTTP %s', async (status) => {
  respond(status, { valid: false, message: 'Invalid corporation number' })
  await expect(checkCorporationNumber(number)).resolves.toEqual({ valid: false, message: 'Invalid corporation number' })
})

test.each([
  [200, undefined], [200, {}], [200, { valid: 'true', corporationNumber: number }],
  [200, { valid: true }], [200, { valid: true, corporationNumber: '123456789' }],
  [200, { valid: false, message: '' }], [200, { valid: false, message: '   ' }],
  [200, { valid: false, message: 'Invalid', corporationNumber: '123456789' }],
  [404, { message: 'Not found' }], [404, { valid: true, corporationNumber: number }],
])('rejects malformed or contradictory GET data (%s, %j)', async (status, data) => {
  respond(status, data)
  await expect(checkCorporationNumber(number)).rejects.toMatchObject({ kind: 'protocol' })
})

test('encodes the corporation path segment', async () => {
  respond(200, { valid: false, message: 'Invalid corporation number' })
  await checkCorporationNumber('a/b?c')
  expect(transport).toHaveBeenCalledWith(expect.objectContaining({ url: '/corporation-number/a%2Fb%3Fc' }))
})

test('POST sends only the four required properties and accepts an empty HTTP 200 body', async () => {
  const controller = new AbortController()
  respond(200, '')
  await expect(submitProfile({ ...values, extra: 'omit' } as typeof values, controller.signal)).resolves.toBeUndefined()
  const request = transport.mock.calls[0][0]
  expect(request).toMatchObject({ method: 'post', url: '/profile-details', signal: controller.signal })
  expect(JSON.parse(request.data as string)).toEqual(values)
  expect(request.headers.getContentType()).toContain('application/json')
})

test.each([201, 204])('rejects unexpected POST success status %s', async (status) => {
  respond(status, '')
  await expect(submitProfile(values)).rejects.toMatchObject({ kind: 'protocol' })
})

const operations = {
  GET: () => checkCorporationNumber(number),
  POST: () => submitProfile(values),
}

describe.each(Object.entries(operations))('%s errors', (_name, request) => {
  test('preserves the backend HTTP 400 message', async () => {
    respond(400, { message: 'Invalid phone number' })
    await expect(request()).rejects.toMatchObject({ kind: 'validation', message: 'Invalid phone number' })
    expect(transport).toHaveBeenCalledTimes(1)
  })

  test('rejects a malformed HTTP 400 response', async () => {
    respond(400, { message: 123 })
    await expect(request()).rejects.toMatchObject({ kind: 'protocol' })
  })

  test.each([500, 503])('normalizes HTTP %s without retrying', async (status) => {
    respond(status, { valid: false, message: 'Service failure' })
    await expect(request()).rejects.toMatchObject({ kind: 'server' })
    expect(transport).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['ERR_NETWORK', 'network'], ['ECONNABORTED', 'timeout'], ['ETIMEDOUT', 'timeout'],
  ])('normalizes transport error %s', async (code, kind) => {
    transport.mockRejectedValueOnce(new AxiosError('Transport failure', code))
    await expect(request()).rejects.toMatchObject({ kind })
    expect(transport).toHaveBeenCalledTimes(1)
  })

  test('normalizes cancellation', async () => {
    transport.mockRejectedValueOnce(new CanceledError())
    await expect(request()).rejects.toMatchObject({ kind: 'cancelled' })
  })

  test('normalizes unexpected failures', async () => {
    transport.mockRejectedValueOnce(new Error('Unexpected'))
    await expect(request()).rejects.toMatchObject({ kind: 'protocol' })
  })
})

test('does not dispatch a POST with an already aborted signal', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(submitProfile(values, controller.signal)).rejects.toMatchObject({ kind: 'cancelled' })
  expect(transport).not.toHaveBeenCalled()
})

test('cancels an in-flight GET even when its transport resolves after abort', async () => {
  let resolveResponse!: (response: AxiosResponse<unknown>) => void
  let requestConfig!: InternalAxiosRequestConfig
  transport.mockImplementationOnce((config) => {
    requestConfig = config
    return new Promise((resolve) => { resolveResponse = resolve })
  })
  const controller = new AbortController()
  const pending = checkCorporationNumber(number, controller.signal)
  controller.abort()
  const assertion = expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
  resolveResponse({ status: 200, data: { valid: true, corporationNumber: number }, statusText: '', headers: new AxiosHeaders(), config: requestConfig })
  await assertion
})
