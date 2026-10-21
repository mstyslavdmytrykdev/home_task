import axios from 'axios'

export const apiClient = axios.create({
  baseURL: 'https://fe-hometask-api.qa.vault.tryvault.com',
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})
