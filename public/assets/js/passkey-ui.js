import { createPasskey, signWithPasskey, passkeysSupported } from './passkeys.js'

async function post(path, body, csrf) {
  const headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
  if (csrf) headers['X-CSRF-Token'] = csrf
  const response = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body ?? {}), credentials: 'same-origin' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || data.message || 'Something went wrong. Please try again.')
  return data
}

function showError(target, message) {
  if (!target) return
  target.textContent = message
  target.hidden = false
}

const supported = passkeysSupported()

document.querySelectorAll('[data-passkey-signin]').forEach((button) => {
  if (!supported) return
  button.hidden = false
  const errorBox = document.querySelector('[data-passkey-error]')
  button.addEventListener('click', async () => {
    button.disabled = true
    if (errorBox) errorBox.hidden = true
    try {
      const assertion = await signWithPasskey(await post('/auth/passkey/options'))
      if (!assertion) return
      const result = await post('/auth/passkey', { ...assertion, redirect: button.dataset.redirect || '/' })
      window.location.assign(result.redirect + '#comments')
    } catch (error) {
      showError(errorBox, error.message)
    } finally {
      button.disabled = false
    }
  })
})

document.querySelectorAll('[data-passkey-add]').forEach((button) => {
  if (!supported) {
    document.querySelector('[data-passkey-unsupported]')?.removeAttribute('hidden')
    return
  }
  button.hidden = false
  const errorBox = document.querySelector('[data-passkey-error]')
  const csrf = button.dataset.csrf
  button.addEventListener('click', async () => {
    button.disabled = true
    if (errorBox) errorBox.hidden = true
    try {
      const registration = await createPasskey(await post('/account/passkeys/options', {}, csrf))
      if (!registration) return
      await post('/account/passkeys', registration, csrf)
      window.location.reload()
    } catch (error) {
      showError(errorBox, error.message)
    } finally {
      button.disabled = false
    }
  })
})
